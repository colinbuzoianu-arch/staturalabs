import type { CountryCode } from "@/generated/prisma/enums";
import type { IncidentRetentionBatchModel } from "@/generated/prisma/models";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { resolveEffectiveRetention } from "@/lib/people/retention";
import { prisma } from "@/lib/prisma";
import {
  computeIncidentDeletionCandidates,
  type IncidentRecordCandidateInput,
  type IncidentRetentionRecordType,
} from "./incident-retention";

// P10e §D.3: the incident-record deletion workflow — propose → company-admin
// approve → audited hard-delete, the SubstanceRetentionBatch pattern. A SEPARATE
// batch so INCIDENT_HEALTH is never co-approved with person anonymisation
// (§3.18). legalHold on the linked person suppresses an INCIDENT_HEALTH
// candidate. Retention is per the active catalogue, resolved per the incident's
// site country (no cross-country borrow); a company setting may extend it.

type CountryRetention = Map<string, { basis: string; min: string | null }>;

// Load the active catalogue's incident retention rules, keyed by
// `${country}:${recordType}`.
async function loadCatalog(): Promise<CountryRetention> {
  const active = await prisma.retentionRuleCatalogVersion.findFirst({
    where: { isActive: true },
    select: { version: true },
  });
  const map: CountryRetention = new Map();
  if (!active) return map;
  const rows = await prisma.retentionRule.findMany({
    where: {
      catalogVersion: active.version,
      recordType: { in: ["INCIDENT", "FIRST_AID_RECORD", "INCIDENT_HEALTH"] },
    },
  });
  for (const r of rows) {
    map.set(`${r.country}:${r.recordType}`, {
      basis: r.basis,
      min: r.minRetention,
    });
  }
  return map;
}

function effective(
  catalog: CountryRetention,
  country: CountryCode,
  recordType: IncidentRetentionRecordType,
  companySetting: string | null,
): string | null {
  const rule = catalog.get(`${country}:${recordType}`);
  if (!rule) return null; // no rule for this country → never matures (honest gap)
  return resolveEffectiveRetention({
    companySettingRetention: companySetting,
    catalogBasis: rule.basis as never,
    catalogMinRetention: rule.min,
  }).retention;
}

async function candidateInputs(
  companyId: string,
): Promise<IncidentRecordCandidateInput[]> {
  const [catalog, settings] = await Promise.all([
    loadCatalog(),
    prisma.companyRetentionSetting.findMany({ where: { companyId } }),
  ]);
  const setting = new Map(settings.map((s) => [s.recordType, s.retention]));

  // Closed incidents (INCIDENT, or FIRST_AID_RECORD when type ERSTE_HILFE),
  // anchored on closedAt.
  const incidents = await prisma.incident.findMany({
    where: { companyId, status: "CLOSED" },
    select: {
      id: true,
      type: true,
      closedAt: true,
      site: { select: { country: true } },
    },
  });

  // Health detail rows with their person's employmentEnd + legalHold.
  const healthRows = await prisma.incidentHealthDetail.findMany({
    where: {
      involvedPerson: { incident: { companyId } },
    },
    select: {
      id: true,
      involvedPerson: {
        select: {
          person: { select: { employmentEnd: true, legalHold: true } },
          incident: { select: { site: { select: { country: true } } } },
        },
      },
    },
  });

  const out: IncidentRecordCandidateInput[] = [];
  for (const i of incidents) {
    const recordType: IncidentRetentionRecordType =
      i.type === "ERSTE_HILFE" ? "FIRST_AID_RECORD" : "INCIDENT";
    out.push({
      recordType,
      recordId: i.id,
      triggerDate: i.closedAt,
      retention: effective(
        catalog,
        i.site.country,
        recordType,
        setting.get(recordType) ?? null,
      ),
      legalHold: false,
    });
  }
  for (const h of healthRows) {
    const country = h.involvedPerson.incident.site.country;
    out.push({
      recordType: "INCIDENT_HEALTH",
      recordId: h.id,
      triggerDate: h.involvedPerson.person.employmentEnd,
      retention: effective(
        catalog,
        country,
        "INCIDENT_HEALTH",
        setting.get("INCIDENT_HEALTH") ?? null,
      ),
      legalHold: h.involvedPerson.person.legalHold,
    });
  }
  return out;
}

export async function generateIncidentRetentionProposal(
  companyId: string,
  actorUserId: string,
  now: Date = new Date(),
): Promise<IncidentRetentionBatchModel | null> {
  const candidates = computeIncidentDeletionCandidates(
    await candidateInputs(companyId),
    now,
  );
  if (candidates.length === 0) return null;
  const batch = await prisma.$transaction(async (tx) => {
    const b = await tx.incidentRetentionBatch.create({
      data: { companyId, status: "PROPOSED" },
    });
    for (const c of candidates) {
      await tx.incidentRetentionItem.create({
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
    action: "incident_retention.propose",
    entityType: "IncidentRetentionBatch",
    entityId: batch.id,
    companyId,
    diff: { candidates: candidates.length },
  });
  return batch;
}

export async function approveIncidentRetentionBatch(
  batchId: string,
  companyId: string,
  actorUserId: string,
): Promise<{ deleted: number; skipped: number }> {
  const batch = await prisma.incidentRetentionBatch.findUnique({
    where: { id: batchId },
    include: { items: true },
  });
  if (!batch || batch.companyId !== companyId || batch.status !== "PROPOSED") {
    return { deleted: 0, skipped: 0 };
  }
  let deleted = 0;
  let skipped = 0;
  for (const item of batch.items) {
    const ok = await deleteIncidentRecord(
      item.recordType as IncidentRetentionRecordType,
      item.recordId,
      companyId,
    );
    if (!ok) {
      skipped++;
      continue;
    }
    await prisma.incidentRetentionItem.update({
      where: { id: item.id },
      data: { deletedAt: new Date() },
    });
    deleted++;
  }
  await prisma.incidentRetentionBatch.update({
    where: { id: batchId },
    data: {
      status: "APPROVED",
      approvedByUserId: actorUserId,
      approvedAt: new Date(),
    },
  });
  await recordAuditEvent({
    actorUserId,
    action: "incident_retention.approve",
    entityType: "IncidentRetentionBatch",
    entityId: batchId,
    companyId,
    diff: { deleted, skipped },
  });
  return { deleted, skipped };
}

// Hard-delete one matured record, re-checking company scope and (for health)
// re-checking legal hold at delete time. Returns false when gone/out of
// scope/held (skipped, not an error).
async function deleteIncidentRecord(
  recordType: IncidentRetentionRecordType,
  recordId: string,
  companyId: string,
): Promise<boolean> {
  if (recordType === "INCIDENT" || recordType === "FIRST_AID_RECORD") {
    const inc = await prisma.incident.findUnique({
      where: { id: recordId },
      select: { companyId: true, status: true },
    });
    if (!inc || inc.companyId !== companyId || inc.status !== "CLOSED") {
      return false;
    }
    // Cascade removes the incident's investigation, involved persons and their
    // health details — a deliberate, matured deletion.
    await prisma.incident.delete({ where: { id: recordId } });
    return true;
  }
  if (recordType === "INCIDENT_HEALTH") {
    const h = await prisma.incidentHealthDetail.findUnique({
      where: { id: recordId },
      select: {
        involvedPerson: {
          select: {
            person: { select: { legalHold: true } },
            incident: { select: { companyId: true } },
          },
        },
      },
    });
    if (
      !h ||
      h.involvedPerson.incident.companyId !== companyId ||
      h.involvedPerson.person.legalHold
    ) {
      return false;
    }
    await prisma.incidentHealthDetail.delete({ where: { id: recordId } });
    return true;
  }
  return false;
}

export async function cancelIncidentRetentionBatch(
  batchId: string,
  companyId: string,
  actorUserId: string,
): Promise<void> {
  const res = await prisma.incidentRetentionBatch.updateMany({
    where: { id: batchId, companyId, status: "PROPOSED" },
    data: { status: "CANCELLED" },
  });
  if (res.count > 0) {
    await recordAuditEvent({
      actorUserId,
      action: "incident_retention.cancel",
      entityType: "IncidentRetentionBatch",
      entityId: batchId,
      companyId,
    });
  }
}
