import type { SubstanceRetentionBatchModel } from "@/generated/prisma/models";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { resolveEffectiveRetention } from "@/lib/people/retention";
import { prisma } from "@/lib/prisma";
import {
  computeSubstanceDeletionCandidates,
  type SubstanceRecordCandidateInput,
} from "./substance-retention";

// P8 §3.4 (SLD_P8_GEFAHRSTOFFE_APPROVED.md): the substance-record deletion
// workflow. Same propose -> review -> approve pattern as person anonymisation,
// but a SEPARATE batch (SubstanceRetentionBatch) so the two are never
// co-approved and the people compartment stays untouched. SDS and SubstanceUse
// rows are NOT person data, so approval HARD-DELETES them (the REACH Art. 36
// retention period has passed) rather than anonymising. Every step is audited.

// Resolve the company's effective SDS / SUBSTANCE_USE retention. SDS has a
// statutory floor (REACH Art. 36, P10Y) a company setting may extend but not
// shorten; SUBSTANCE_USE is a policy default (P10Y) a company may change.
async function companyRetentions(
  companyId: string,
): Promise<{ sds: string | null; use: string | null }> {
  const settings = await prisma.companyRetentionSetting.findMany({
    where: { companyId },
  });
  const byType = new Map(settings.map((s) => [s.recordType, s.retention]));
  const sds = resolveEffectiveRetention({
    companySettingRetention: byType.get("SDS") ?? null,
    catalogBasis: "STATUTORY",
    catalogMinRetention: "P10Y",
  });
  const use = resolveEffectiveRetention({
    companySettingRetention: byType.get("SUBSTANCE_USE") ?? null,
    catalogBasis: "POLICY_DEFAULT",
    catalogMinRetention: "P10Y",
  });
  return { sds: sds.retention, use: use.retention };
}

async function candidateInputs(
  companyId: string,
): Promise<SubstanceRecordCandidateInput[]> {
  const { sds: sdsRetention, use: useRetention } =
    await companyRetentions(companyId);
  const [sheets, uses] = await Promise.all([
    prisma.safetyDataSheet.findMany({
      where: { substance: { companyId } },
      select: { id: true, lastUsedAt: true },
    }),
    prisma.substanceUse.findMany({
      where: { substance: { companyId } },
      select: { id: true, activeTo: true },
    }),
  ]);
  return [
    ...sheets.map(
      (s): SubstanceRecordCandidateInput => ({
        recordType: "SDS",
        recordId: s.id,
        lastUsedAt: s.lastUsedAt,
        retention: sdsRetention,
      }),
    ),
    ...uses.map(
      (u): SubstanceRecordCandidateInput => ({
        recordType: "SUBSTANCE_USE",
        recordId: u.id,
        lastUsedAt: u.activeTo,
        retention: useRetention,
      }),
    ),
  ];
}

// Build a proposal batch of matured substance records. Returns null when there
// are no candidates (no empty batch is created).
export async function generateSubstanceRetentionProposal(
  companyId: string,
  actorUserId: string,
  now: Date = new Date(),
): Promise<SubstanceRetentionBatchModel | null> {
  const candidates = computeSubstanceDeletionCandidates(
    await candidateInputs(companyId),
    now,
  );
  if (candidates.length === 0) return null;

  const batch = await prisma.$transaction(async (tx) => {
    const b = await tx.substanceRetentionBatch.create({
      data: { companyId, status: "PROPOSED" },
    });
    for (const c of candidates) {
      await tx.substanceRetentionItem.create({
        data: {
          batchId: b.id,
          recordType: c.recordType,
          recordId: c.recordId,
          maturedAt: c.maturedAt,
        },
      });
    }
    return b;
  });
  await recordAuditEvent({
    actorUserId,
    action: "substance_retention.propose",
    entityType: "SubstanceRetentionBatch",
    entityId: batch.id,
    companyId,
    diff: { candidates: candidates.length },
  });
  return batch;
}

// Approve a PROPOSED batch: hard-delete each item's record (re-verifying it
// still belongs to the company), stamp the item, mark the batch APPROVED.
export async function approveSubstanceRetentionBatch(
  batchId: string,
  companyId: string,
  actorUserId: string,
): Promise<{ deleted: number; skipped: number }> {
  const batch = await prisma.substanceRetentionBatch.findUnique({
    where: { id: batchId },
    include: { items: true },
  });
  if (!batch || batch.companyId !== companyId || batch.status !== "PROPOSED") {
    return { deleted: 0, skipped: 0 };
  }
  let deleted = 0;
  let skipped = 0;
  for (const item of batch.items) {
    const ok = await deleteSubstanceRecord(
      item.recordType,
      item.recordId,
      companyId,
    );
    if (!ok) {
      skipped++;
      continue;
    }
    await prisma.substanceRetentionItem.update({
      where: { id: item.id },
      data: { deletedAt: new Date() },
    });
    deleted++;
  }
  await prisma.substanceRetentionBatch.update({
    where: { id: batchId },
    data: {
      status: "APPROVED",
      approvedByUserId: actorUserId,
      approvedAt: new Date(),
    },
  });
  await recordAuditEvent({
    actorUserId,
    action: "substance_retention.approve",
    entityType: "SubstanceRetentionBatch",
    entityId: batchId,
    companyId,
    diff: { deleted, skipped },
  });
  return { deleted, skipped };
}

// Delete one matured record, re-checking company scope. Returns false when the
// record is gone or out of scope (skipped, not an error).
async function deleteSubstanceRecord(
  recordType: string,
  recordId: string,
  companyId: string,
): Promise<boolean> {
  if (recordType === "SDS") {
    const sds = await prisma.safetyDataSheet.findUnique({
      where: { id: recordId },
      select: { substance: { select: { companyId: true } } },
    });
    if (!sds || sds.substance.companyId !== companyId) return false;
    await prisma.safetyDataSheet.delete({ where: { id: recordId } });
    return true;
  }
  if (recordType === "SUBSTANCE_USE") {
    const use = await prisma.substanceUse.findUnique({
      where: { id: recordId },
      select: { substance: { select: { companyId: true } } },
    });
    if (!use || use.substance.companyId !== companyId) return false;
    await prisma.substanceUse.delete({ where: { id: recordId } });
    return true;
  }
  return false;
}

export async function cancelSubstanceRetentionBatch(
  batchId: string,
  companyId: string,
  actorUserId: string,
): Promise<void> {
  const res = await prisma.substanceRetentionBatch.updateMany({
    where: { id: batchId, companyId, status: "PROPOSED" },
    data: { status: "CANCELLED" },
  });
  if (res.count > 0) {
    await recordAuditEvent({
      actorUserId,
      action: "substance_retention.cancel",
      entityType: "SubstanceRetentionBatch",
      entityId: batchId,
      companyId,
    });
  }
}
