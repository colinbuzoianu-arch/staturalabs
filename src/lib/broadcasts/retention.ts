import { Prisma } from "@/generated/prisma/client";
import type { RetentionBatchStatus } from "@/generated/prisma/enums";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { prisma } from "@/lib/prisma";

// Broadcast-confirmation retention (slice 4). The per-person confirmation list
// is kept as proof that the information was passed on, then deleted when the
// company's retention period has run.
//
// Three rules worth stating, because they are the reason this is its own batch:
//   1) The MESSAGE survives. Only the per-person rows go; their aggregate is
//      frozen onto Broadcast.retentionSummary first, so "we told 23 people and
//      21 confirmed" remains true and provable after the names are gone.
//   2) Propose → company_admin approves → HARD DELETE. Never automatic on the
//      first run (P7d §C.4), never co-approved with person anonymisation or the
//      substance/incident batches.
//   3) Legal hold wins. A broadcast with any recipient row pointing at a person
//      on legalHold is excluded from the proposal entirely — partially deleting
//      a confirmation list would make the remainder misleading.
//
// No `import "server-only"`: a lib gate like the others, unit-testable with a
// mocked prisma; the pure maturity rule lives below and is tested directly.

export const BROADCAST_RETENTION_DEFAULT = "P5Y";

// Pure: has this broadcast's confirmation list matured? ISO-8601 duration,
// limited to the year/month forms the retention catalogue actually uses (P5Y,
// P10Y, P6M) — an unparseable value means "not matured", fail-closed, because
// deleting on a misread period is irreversible.
export function isRetentionMatured(
  publishedAt: Date | null,
  retention: string,
  now: Date,
): boolean {
  if (!publishedAt) return false;
  const match = /^P(?:(\d+)Y)?(?:(\d+)M)?$/.exec(retention.trim());
  if (!match) return false;
  const years = Number(match[1] ?? 0);
  const months = Number(match[2] ?? 0);
  if (years === 0 && months === 0) return false;
  const matureAt = new Date(publishedAt);
  matureAt.setFullYear(matureAt.getFullYear() + years);
  matureAt.setMonth(matureAt.getMonth() + months);
  return now.getTime() >= matureAt.getTime();
}

// The company's configured period for this record type, falling back to the
// active catalogue rule and then to the platform default — the same precedence
// the other retention surfaces use.
export async function resolveBroadcastRetention(
  companyId: string,
): Promise<string> {
  const setting = await prisma.companyRetentionSetting.findUnique({
    where: {
      companyId_recordType: {
        companyId,
        recordType: "BROADCAST_CONFIRMATION",
      },
    },
    select: { retention: true },
  });
  if (setting) return setting.retention;

  const active = await prisma.retentionRuleCatalogVersion.findFirst({
    where: { isActive: true },
    select: { version: true },
  });
  if (active) {
    const rule = await prisma.retentionRule.findFirst({
      where: {
        catalogVersion: active.version,
        recordType: "BROADCAST_CONFIRMATION",
      },
      select: { minRetention: true },
    });
    if (rule?.minRetention) return rule.minRetention;
  }
  return BROADCAST_RETENTION_DEFAULT;
}

export type BroadcastRetentionProposal = {
  batchId: string | null;
  items: { broadcastId: string; title: string; recipientCount: number }[];
  skippedForLegalHold: number;
};

// Propose: find the matured broadcasts and write a PROPOSED batch for review.
// Returns an empty proposal (and writes nothing) when nothing has matured.
export async function proposeBroadcastRetentionBatch(input: {
  companyId: string;
  actorUserId: string;
  now?: Date;
}): Promise<BroadcastRetentionProposal> {
  const now = input.now ?? new Date();
  const retention = await resolveBroadcastRetention(input.companyId);

  const candidates = await prisma.broadcast.findMany({
    where: {
      companyId: input.companyId,
      status: { in: ["PUBLISHED", "ARCHIVED"] },
      publishedAt: { not: null },
      // Nothing to delete once the list is already gone (the summary is the
      // marker that retention has already run for this message). DbNull, not
      // JsonNull: the column being SQL NULL is what "not yet run" means here,
      // and Prisma distinguishes that from a stored JSON `null`.
      retentionSummary: { equals: Prisma.DbNull },
    },
    select: {
      id: true,
      title: true,
      publishedAt: true,
      recipients: { select: { id: true, personId: true } },
    },
  });

  // Legal hold: resolve once for every person referenced by any candidate.
  const personIds = [
    ...new Set(
      candidates.flatMap((b) =>
        b.recipients
          .map((r) => r.personId)
          .filter((id): id is string => id !== null),
      ),
    ),
  ];
  const heldPersons = new Set(
    personIds.length > 0
      ? (
          await prisma.person.findMany({
            where: { id: { in: personIds }, legalHold: true },
            select: { id: true },
          })
        ).map((p) => p.id)
      : [],
  );

  const matured = candidates.filter((b) =>
    isRetentionMatured(b.publishedAt, retention, now),
  );
  const held = matured.filter((b) =>
    b.recipients.some((r) => r.personId && heldPersons.has(r.personId)),
  );
  const deletable = matured.filter((b) => !held.includes(b));

  if (deletable.length === 0) {
    return { batchId: null, items: [], skippedForLegalHold: held.length };
  }

  const batch = await prisma.broadcastRetentionBatch.create({
    data: {
      companyId: input.companyId,
      status: "PROPOSED",
      items: {
        create: deletable.map((b) => ({
          broadcastId: b.id,
          recipientCount: b.recipients.length,
          maturedAt: now,
        })),
      },
    },
    select: { id: true },
  });

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "broadcast_retention.propose",
    entityType: "BroadcastRetentionBatch",
    entityId: batch.id,
    companyId: input.companyId,
    diff: {
      items: deletable.length,
      retention,
      skippedForLegalHold: held.length,
    },
  });

  return {
    batchId: batch.id,
    items: deletable.map((b) => ({
      broadcastId: b.id,
      title: b.title,
      recipientCount: b.recipients.length,
    })),
    skippedForLegalHold: held.length,
  };
}

export type BroadcastRetentionApproval = {
  broadcastsProcessed: number;
  recipientRowsDeleted: number;
};

// Approve: freeze each broadcast's aggregate, then HARD-DELETE its recipient
// rows. One transaction per broadcast so a failure part-way cannot leave a
// message with neither its list nor its summary.
export async function approveBroadcastRetentionBatch(input: {
  batchId: string;
  companyId: string;
  actorUserId: string;
  now?: Date;
}): Promise<BroadcastRetentionApproval> {
  const now = input.now ?? new Date();
  const batch = await prisma.broadcastRetentionBatch.findUnique({
    where: { id: input.batchId },
    include: { items: true },
  });
  if (!batch || batch.companyId !== input.companyId) {
    throw new Error("Retention batch not found for this company");
  }
  if (batch.status !== "PROPOSED") {
    throw new Error(`Batch is ${batch.status}, not PROPOSED`);
  }

  let recipientRowsDeleted = 0;
  for (const item of batch.items) {
    const recipients = await prisma.broadcastRecipient.findMany({
      where: { broadcastId: item.broadcastId },
      select: { readAt: true, confirmedAt: true },
    });
    const summary = {
      recipients: recipients.length,
      read: recipients.filter((r) => r.readAt !== null).length,
      confirmed: recipients.filter((r) => r.confirmedAt !== null).length,
      deletedAt: now.toISOString(),
      retention: await resolveBroadcastRetention(input.companyId),
    };
    await prisma.$transaction(async (tx) => {
      await tx.broadcast.update({
        where: { id: item.broadcastId },
        data: { retentionSummary: summary },
      });
      const deleted = await tx.broadcastRecipient.deleteMany({
        where: { broadcastId: item.broadcastId },
      });
      recipientRowsDeleted += deleted.count;
      await tx.broadcastRetentionItem.update({
        where: { id: item.id },
        data: { deletedAt: now },
      });
    });
  }

  await prisma.broadcastRetentionBatch.update({
    where: { id: batch.id },
    data: {
      status: "APPROVED" satisfies RetentionBatchStatus,
      approvedByUserId: input.actorUserId,
      approvedAt: now,
    },
  });

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "broadcast_retention.approve",
    entityType: "BroadcastRetentionBatch",
    entityId: batch.id,
    companyId: input.companyId,
    diff: {
      broadcasts: batch.items.length,
      recipientRowsDeleted,
    },
  });

  return { broadcastsProcessed: batch.items.length, recipientRowsDeleted };
}

export async function cancelBroadcastRetentionBatch(input: {
  batchId: string;
  companyId: string;
  actorUserId: string;
}): Promise<void> {
  const batch = await prisma.broadcastRetentionBatch.findUnique({
    where: { id: input.batchId },
    select: { companyId: true, status: true },
  });
  if (!batch || batch.companyId !== input.companyId) return;
  if (batch.status !== "PROPOSED") return;
  await prisma.broadcastRetentionBatch.update({
    where: { id: input.batchId },
    data: { status: "CANCELLED" },
  });
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "broadcast_retention.cancel",
    entityType: "BroadcastRetentionBatch",
    entityId: input.batchId,
    companyId: input.companyId,
  });
}
