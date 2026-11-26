import "server-only";

import { recordAuditEvent } from "@/lib/audit/audit-event";
import { appUrl } from "@/lib/config/base-url";
import { trialNotifyAddress } from "@/lib/config/contact";
import { sendNotificationEmail } from "@/lib/notifications/email";
import { createNotificationIfAbsent } from "@/lib/notifications/service";
import { prisma } from "@/lib/prisma";
import { deleteTenant } from "./tenant-delete";
import { graceExpired, TRIAL_GRACE_DAYS } from "./tenant-kind";
import { TrialGateError } from "./trial";

// P18 A.4/A.5: the trial lifecycle — reminders, the lock at expiry, the grace
// period, and the deletion the founder approves.
//
// Everything here is IDEMPOTENT and safe to run on a schedule, because that is
// what it is for: one daily pass. Reminders ride the P5 notification service
// (its (recipient, dedupeKey) upsert is the "send once" guarantee, and it also
// does the best-effort e-mail), locking is a no-op on an already-locked trial,
// and only ONE open deletion proposal can exist per company (a partial unique
// index, not a hopeful check).
//
// Nothing here deletes anything on its own. The daily pass proposes; a human
// approves — the same principle as every retention batch (P7d §C.4).

// A.4: the two reminder lead times, before expiry. Kept ASCENDING, because the
// selection below depends on it: the reminder owed is the TIGHTEST lead the
// trial has reached, not the widest. (With [7, 2] and one day left, picking
// the first match gave 7 — already sent — so the 2-day reminder never fired.
// Found by the slice-3 live run.)
export const TRIAL_REMINDER_LEAD_DAYS = [2, 7] as const;

export type TrialReminderResult = { considered: number; created: number };

// Send the founder's copy. Separate from the in-app notification because the
// founder is not a user of the trial tenant — they get an e-mail to the
// configured address, or nothing at all when it is unset (never a guess).
async function notifyFounder(subject: string, body: string): Promise<void> {
  const to = trialNotifyAddress();
  if (!to) return;
  await sendNotificationEmail({ to, subject, body });
}

export async function sendTrialReminders(input?: {
  now?: Date;
}): Promise<TrialReminderResult> {
  const now = input?.now ?? new Date();
  const result: TrialReminderResult = { considered: 0, created: 0 };

  const trials = await prisma.company.findMany({
    where: {
      tenantKind: "TRIAL",
      trialLockedAt: null,
      trialExpiresAt: { not: null },
    },
    select: {
      id: true,
      name: true,
      trialExpiresAt: true,
      trialContactEmail: true,
    },
  });

  for (const trial of trials) {
    const expiresAt = trial.trialExpiresAt as Date;
    const msLeft = expiresAt.getTime() - now.getTime();
    if (msLeft <= 0) continue; // expired → the lock pass handles it
    const daysLeft = Math.ceil(msLeft / 86_400_000);
    // The TIGHTEST lead time the trial has reached (the list is ascending), so
    // a job that misses a day still sends the 2-day reminder instead of
    // re-sending the 7-day one and calling it done.
    const lead = TRIAL_REMINDER_LEAD_DAYS.find((d) => daysLeft <= d);
    if (lead === undefined) continue;
    result.considered += 1;

    const admins = await prisma.platformUser.findMany({
      where: {
        companyId: trial.id,
        role: "COMPANY_ADMIN",
        disabledAt: null,
      },
      select: { id: true, email: true },
    });
    const dateLabel = expiresAt.toISOString().slice(0, 10);
    const link = appUrl("/app");
    const body = [
      `Ihr Testzugang für ${trial.name} endet am ${dateLabel}.`,
      "",
      "Wenn Sie weitermachen möchten, antworten Sie einfach auf diese E-Mail.",
      ...(link ? ["", link] : []),
    ].join("\n");

    for (const admin of admins) {
      const created = await createNotificationIfAbsent({
        recipientUserId: admin.id,
        recipientEmail: admin.email.endsWith("@employee.sld.invalid")
          ? null
          : admin.email,
        eventType: "TRIAL_EXPIRING_SOON",
        companyId: trial.id,
        subjectType: "Company",
        subjectId: trial.id,
        href: "/app",
        title: `Testzugang endet am ${dateLabel}`,
        body,
        dueAt: expiresAt,
        // One reminder per lead time per trial: a trial crossing from 7 to 2
        // days legitimately gets a second, distinct reminder.
        dedupeKey: `trial-reminder:${lead}:${trial.id}`,
        emailSubject: `Statura Labs — Testzugang endet am ${dateLabel}`,
        emailBody: body,
      });
      if (created) {
        result.created += 1;
        await notifyFounder(
          `Testzugang ${trial.name} endet in ${daysLeft} Tag(en)`,
          `${trial.name} (${trial.trialContactEmail ?? "kein Kontakt"}) endet am ${dateLabel}.`,
        );
      }
    }
  }
  return result;
}

export type TrialLockResult = { locked: { id: string; name: string }[] };

// Lock every trial past its expiry. The lock is what the sign-in surface reads;
// data is untouched and kept for the grace period.
export async function lockExpiredTrials(input?: {
  now?: Date;
  actorUserId?: string | null;
}): Promise<TrialLockResult> {
  const now = input?.now ?? new Date();
  const due = await prisma.company.findMany({
    where: {
      tenantKind: "TRIAL",
      trialLockedAt: null,
      trialExpiresAt: { lte: now },
    },
    select: { id: true, name: true, trialContactEmail: true },
  });

  const locked: { id: string; name: string }[] = [];
  for (const trial of due) {
    await prisma.company.update({
      where: { id: trial.id },
      data: { trialLockedAt: now },
    });
    locked.push({ id: trial.id, name: trial.name });

    const admins = await prisma.platformUser.findMany({
      where: { companyId: trial.id, role: "COMPANY_ADMIN", disabledAt: null },
      select: { id: true, email: true },
    });
    const body = [
      `Ihr Testzugang für ${trial.name} ist abgelaufen.`,
      "",
      `Ihre Daten werden noch ${TRIAL_GRACE_DAYS} Tage aufbewahrt. Wenn Sie weitermachen möchten, antworten Sie einfach auf diese E-Mail.`,
    ].join("\n");
    for (const admin of admins) {
      await createNotificationIfAbsent({
        recipientUserId: admin.id,
        recipientEmail: admin.email.endsWith("@employee.sld.invalid")
          ? null
          : admin.email,
        eventType: "TRIAL_EXPIRED",
        companyId: trial.id,
        subjectType: "Company",
        subjectId: trial.id,
        href: "/app",
        title: "Testzugang abgelaufen",
        body,
        dedupeKey: `trial-expired:${trial.id}`,
        emailSubject: "Statura Labs — Ihr Testzugang ist abgelaufen",
        emailBody: body,
      });
    }
    await notifyFounder(
      `Testzugang ${trial.name} gesperrt`,
      `${trial.name} (${trial.trialContactEmail ?? "kein Kontakt"}) ist abgelaufen und gesperrt. Daten werden ${TRIAL_GRACE_DAYS} Tage aufbewahrt.`,
    );
    await recordAuditEvent({
      actorUserId: input?.actorUserId ?? null,
      action: "trial.lock",
      entityType: "Company",
      entityId: trial.id,
      companyId: trial.id,
    });
  }
  return { locked };
}

export type TrialDeletionProposalResult = {
  proposed: { id: string; companyName: string }[];
};

// Propose the deletion of every locked trial whose grace period has run. Never
// deletes; writes a PROPOSED row the founder approves in /admin.
export async function proposeTrialDeletions(input?: {
  now?: Date;
  graceDays?: number;
  actorUserId?: string | null;
}): Promise<TrialDeletionProposalResult> {
  const now = input?.now ?? new Date();
  const graceDays = input?.graceDays ?? TRIAL_GRACE_DAYS;
  const locked = await prisma.company.findMany({
    where: { tenantKind: "TRIAL", trialLockedAt: { not: null } },
    select: { id: true, name: true, trialLockedAt: true },
  });

  const proposed: { id: string; companyName: string }[] = [];
  for (const trial of locked) {
    if (!graceExpired(trial.trialLockedAt, now, graceDays)) continue;
    // The partial unique index enforces one open proposal per company; check
    // first so the common case is not an exception.
    const existing = await prisma.trialDeletionProposal.findFirst({
      where: { companyId: trial.id, status: "PROPOSED" },
      select: { id: true },
    });
    if (existing) continue;

    const row = await prisma.trialDeletionProposal.create({
      data: {
        companyId: trial.id,
        companyName: trial.name,
        lockedAt: trial.trialLockedAt as Date,
        graceEndedAt: new Date(
          (trial.trialLockedAt as Date).getTime() + graceDays * 86_400_000,
        ),
      },
      select: { id: true },
    });
    proposed.push({ id: row.id, companyName: trial.name });
    await notifyFounder(
      `Löschvorschlag: Testzugang ${trial.name}`,
      `Die Aufbewahrungsfrist von ${graceDays} Tagen ist abgelaufen. Der Vorschlag liegt in /admin → Testzugänge zur Freigabe.`,
    );
    await recordAuditEvent({
      actorUserId: input?.actorUserId ?? null,
      action: "trial.deletion_proposed",
      entityType: "TrialDeletionProposal",
      entityId: row.id,
      companyId: trial.id,
      diff: { companyName: trial.name },
    });
  }
  return { proposed };
}

// Approve a proposal: archive, then delete through the P13 tenant-deletion
// path (the same audited, strictly company-scoped delete the founder can run by
// hand). Irreversible by design, which is why it needs a human.
export async function approveTrialDeletion(input: {
  proposalId: string;
  actorUserId: string;
  now?: Date;
}): Promise<{ deletedTables: number }> {
  const now = input.now ?? new Date();
  const proposal = await prisma.trialDeletionProposal.findUnique({
    where: { id: input.proposalId },
  });
  if (!proposal) throw new TrialGateError("proposal-not-found");
  if (proposal.status !== "PROPOSED") {
    throw new TrialGateError("proposal-not-open");
  }

  const company = await prisma.company.findUnique({
    where: { id: proposal.companyId },
    select: { tenantKind: true, trialLockedAt: true },
  });
  // Fail-closed: only a LOCKED TRIAL may be deleted this way. If the founder
  // extended or converted it in the meantime, the proposal is stale and the
  // tenant must survive.
  if (!company || company.tenantKind !== "TRIAL" || !company.trialLockedAt) {
    await prisma.trialDeletionProposal.update({
      where: { id: proposal.id },
      data: { status: "CANCELLED", cancelledAt: now },
    });
    throw new TrialGateError("tenant-no-longer-a-locked-trial");
  }

  await prisma.trialDeletionProposal.update({
    where: { id: proposal.id },
    data: {
      status: "APPROVED",
      approvedByUserId: input.actorUserId,
      approvedAt: now,
    },
  });
  await prisma.company.update({
    where: { id: proposal.companyId },
    data: {
      status: "ARCHIVED",
      archivedAt: now,
      archivedByUserId: input.actorUserId,
    },
  });
  const deletion = await deleteTenant({
    companyId: proposal.companyId,
    actorUserId: input.actorUserId,
  });
  await prisma.trialDeletionProposal.update({
    where: { id: proposal.id },
    data: { executedAt: new Date() },
  });
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "trial.deletion_executed",
    entityType: "TrialDeletionProposal",
    entityId: proposal.id,
    // companyId null on purpose: the company is gone, and an AuditEvent must
    // outlive what it describes.
    companyId: null,
    diff: {
      companyName: proposal.companyName,
      deletedTables: deletion.deletedTables,
    },
  });
  return { deletedTables: deletion.deletedTables };
}

export async function cancelTrialDeletion(input: {
  proposalId: string;
  actorUserId: string;
  now?: Date;
}): Promise<void> {
  const now = input.now ?? new Date();
  const proposal = await prisma.trialDeletionProposal.findUnique({
    where: { id: input.proposalId },
    select: { status: true, companyId: true },
  });
  if (!proposal || proposal.status !== "PROPOSED") return;
  await prisma.trialDeletionProposal.update({
    where: { id: input.proposalId },
    data: { status: "CANCELLED", cancelledAt: now },
  });
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "trial.deletion_cancelled",
    entityType: "TrialDeletionProposal",
    entityId: input.proposalId,
    companyId: proposal.companyId,
  });
}

// --- The founder's own actions (A.4) ---------------------------------------

// Verlängern: push the expiry out and lift any lock, so an extended trial is
// immediately usable again.
export async function extendTrial(input: {
  companyId: string;
  days: number;
  actorUserId: string;
  now?: Date;
}): Promise<{ expiresAt: Date }> {
  const now = input.now ?? new Date();
  if (!Number.isFinite(input.days) || input.days <= 0) {
    throw new TrialGateError("invalid-duration");
  }
  const company = await prisma.company.findUnique({
    where: { id: input.companyId },
    select: { tenantKind: true, trialExpiresAt: true },
  });
  if (!company) throw new TrialGateError("not-found");
  if (company.tenantKind !== "TRIAL") throw new TrialGateError("not-a-trial");

  // Extend from the later of now and the current expiry, so extending early
  // adds time rather than quietly shortening it.
  const from =
    company.trialExpiresAt && company.trialExpiresAt > now
      ? company.trialExpiresAt
      : now;
  const expiresAt = new Date(from.getTime() + input.days * 86_400_000);
  await prisma.company.update({
    where: { id: input.companyId },
    data: { trialExpiresAt: expiresAt, trialLockedAt: null },
  });
  // Any open deletion proposal is now wrong: the trial is alive again.
  await prisma.trialDeletionProposal.updateMany({
    where: { companyId: input.companyId, status: "PROPOSED" },
    data: { status: "CANCELLED", cancelledAt: now },
  });
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "trial.extend",
    entityType: "Company",
    entityId: input.companyId,
    companyId: input.companyId,
    diff: { days: input.days, expiresAt: expiresAt.toISOString() },
  });
  return { expiresAt };
}

// In Kunde umwandeln: the time limit goes, the data stays, the band disappears,
// and the AI cap returns to a customer's. The conversion stamp is KEPT as the
// record of where this customer came from (the Company_trial_fields_check
// correction in slice 1 exists precisely for this).
export async function convertTrialToCustomer(input: {
  companyId: string;
  actorUserId: string;
  now?: Date;
}): Promise<void> {
  const now = input.now ?? new Date();
  const company = await prisma.company.findUnique({
    where: { id: input.companyId },
    select: { tenantKind: true, trialContactEmail: true },
  });
  if (!company) throw new TrialGateError("not-found");
  if (company.tenantKind !== "TRIAL") throw new TrialGateError("not-a-trial");
  // The CHECK requires a contact alongside a conversion stamp; a trial always
  // has one, but fail loudly rather than hit the constraint.
  if (!company.trialContactEmail) throw new TrialGateError("no-contact");

  await prisma.company.update({
    where: { id: input.companyId },
    data: {
      tenantKind: "CUSTOMER",
      trialConvertedAt: now,
      trialExpiresAt: null,
      trialLockedAt: null,
    },
  });
  // Lift the trial AI cap: a customer is metered by their own agreement, not
  // by the trial allowance.
  await prisma.aiUsageCap.deleteMany({ where: { companyId: input.companyId } });
  await prisma.trialDeletionProposal.updateMany({
    where: { companyId: input.companyId, status: "PROPOSED" },
    data: { status: "CANCELLED", cancelledAt: now },
  });
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "trial.convert",
    entityType: "Company",
    entityId: input.companyId,
    companyId: input.companyId,
  });
}

// The daily pass: reminders, then locks, then proposals. One entry point so a
// scheduler (or the founder's button) runs them in the right order — a trial
// locked today must not also be "reminded" today.
export type TrialLifecycleRun = {
  reminders: TrialReminderResult;
  locked: number;
  proposed: number;
};

export async function runTrialLifecycle(input?: {
  now?: Date;
  actorUserId?: string | null;
}): Promise<TrialLifecycleRun> {
  const now = input?.now ?? new Date();
  const reminders = await sendTrialReminders({ now });
  const lock = await lockExpiredTrials({
    now,
    actorUserId: input?.actorUserId ?? null,
  });
  const proposals = await proposeTrialDeletions({
    now,
    actorUserId: input?.actorUserId ?? null,
  });
  return {
    reminders,
    locked: lock.locked.length,
    proposed: proposals.proposed.length,
  };
}
