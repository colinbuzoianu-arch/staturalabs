import type { RetentionBatchModel } from "@/generated/prisma/models";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { prisma } from "@/lib/prisma";
import { anonymisePerson } from "./person";
import {
  computeRetentionCandidates,
  type RetentionCandidateInput,
} from "./retention";

// P7d §C.4 (SLD_P7B_DEFERRALS_RESOLVED.md): the anonymisation workflow. The
// "daily job" is generateRetentionProposal (run on demand from the settings
// page today; a scheduled EU trigger is P13). It NEVER anonymises on its own:
// it writes a PROPOSED batch a company_admin reviews. Approval anonymises each
// person (re-checking legal hold / not-already-anonymised at approval time).
// Every step is audited; audit stores ids, never names.

// Resolve the company's effective PERSON / TRAINING_RECORD retention durations
// from CompanyRetentionSetting (fallback to the platform defaults if unset).
async function companyRetentions(
  companyId: string,
): Promise<{ person: string; training: string }> {
  const settings = await prisma.companyRetentionSetting.findMany({
    where: { companyId },
  });
  const byType = new Map(settings.map((s) => [s.recordType, s.retention]));
  return {
    person: byType.get("PERSON") ?? "P1Y",
    training: byType.get("TRAINING_RECORD") ?? "P10Y",
  };
}

async function candidateInputs(
  companyId: string,
): Promise<RetentionCandidateInput[]> {
  const { person: personRetention, training: trainingRetention } =
    await companyRetentions(companyId);
  const persons = await prisma.person.findMany({
    where: { companyId },
    select: {
      id: true,
      employmentEnd: true,
      legalHold: true,
      anonymisedAt: true,
      _count: { select: { trainingRecords: true } },
    },
  });
  return persons.map((p) => ({
    personId: p.id,
    employmentEnd: p.employmentEnd,
    hasRecords: p._count.trainingRecords > 0,
    legalHold: p.legalHold,
    anonymisedAt: p.anonymisedAt,
    personRetention,
    trainingRetention,
  }));
}

// Build a proposal batch of matured, non-held persons. Returns null when there
// are no candidates (no empty batch is created).
export async function generateRetentionProposal(
  companyId: string,
  actorUserId: string,
  now: Date = new Date(),
): Promise<RetentionBatchModel | null> {
  const candidates = computeRetentionCandidates(
    await candidateInputs(companyId),
    now,
  );
  if (candidates.length === 0) return null;

  const batch = await prisma.$transaction(async (tx) => {
    const b = await tx.retentionBatch.create({
      data: { companyId, status: "PROPOSED" },
    });
    for (const c of candidates) {
      await tx.retentionBatchItem.create({
        data: { batchId: b.id, personId: c.personId, maturedAt: c.maturedAt },
      });
    }
    return b;
  });
  await recordAuditEvent({
    actorUserId,
    action: "retention.propose",
    entityType: "RetentionBatch",
    entityId: batch.id,
    companyId,
    diff: { candidates: candidates.length },
  });
  return batch;
}

// Approve a PROPOSED batch: anonymise each item's person (re-checking legal
// hold + not-already-anonymised now), stamp the item, mark the batch APPROVED.
export async function approveRetentionBatch(
  batchId: string,
  companyId: string,
  actorUserId: string,
): Promise<{ anonymised: number; skipped: number }> {
  const batch = await prisma.retentionBatch.findUnique({
    where: { id: batchId },
    include: { items: true },
  });
  if (!batch || batch.companyId !== companyId || batch.status !== "PROPOSED") {
    return { anonymised: 0, skipped: 0 };
  }
  let anonymised = 0;
  let skipped = 0;
  for (const item of batch.items) {
    const person = await prisma.person.findUnique({
      where: { id: item.personId },
      select: { companyId: true, legalHold: true, anonymisedAt: true },
    });
    if (
      !person ||
      person.companyId !== companyId ||
      person.legalHold ||
      person.anonymisedAt
    ) {
      skipped++;
      continue;
    }
    await anonymisePerson(item.personId, actorUserId);
    await prisma.retentionBatchItem.update({
      where: { id: item.id },
      data: { anonymisedAt: new Date() },
    });
    anonymised++;
  }
  await prisma.retentionBatch.update({
    where: { id: batchId },
    data: {
      status: "APPROVED",
      approvedByUserId: actorUserId,
      approvedAt: new Date(),
    },
  });
  await recordAuditEvent({
    actorUserId,
    action: "retention.approve",
    entityType: "RetentionBatch",
    entityId: batchId,
    companyId,
    diff: { anonymised, skipped },
  });
  return { anonymised, skipped };
}

export async function cancelRetentionBatch(
  batchId: string,
  companyId: string,
  actorUserId: string,
): Promise<void> {
  const res = await prisma.retentionBatch.updateMany({
    where: { id: batchId, companyId, status: "PROPOSED" },
    data: { status: "CANCELLED" },
  });
  if (res.count > 0) {
    await recordAuditEvent({
      actorUserId,
      action: "retention.cancel",
      entityType: "RetentionBatch",
      entityId: batchId,
      companyId,
    });
  }
}

export async function setLegalHold(
  personId: string,
  companyId: string,
  hold: boolean,
  reason: string | null,
  actorUserId: string,
): Promise<void> {
  const person = await prisma.person.findUnique({
    where: { id: personId },
    select: { companyId: true },
  });
  if (!person || person.companyId !== companyId) return;
  await prisma.person.update({
    where: { id: personId },
    data: {
      legalHold: hold,
      legalHoldReason: hold ? reason : null,
      legalHoldSetByUserId: hold ? actorUserId : null,
    },
  });
  await recordAuditEvent({
    actorUserId,
    action: hold ? "person.legal_hold_set" : "person.legal_hold_clear",
    entityType: "Person",
    entityId: personId,
    companyId,
  });
}

export async function setRetentionAutoExecute(
  companyId: string,
  autoExecute: boolean,
  actorUserId: string,
): Promise<void> {
  await prisma.companyRetentionConfig.upsert({
    where: { companyId },
    create: { companyId, autoExecute, updatedByUserId: actorUserId },
    update: { autoExecute, updatedByUserId: actorUserId },
  });
  await recordAuditEvent({
    actorUserId,
    action: "retention.auto_execute",
    entityType: "CompanyRetentionConfig",
    companyId,
    diff: { autoExecute },
  });
}
