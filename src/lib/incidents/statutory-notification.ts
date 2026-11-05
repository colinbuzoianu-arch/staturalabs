import "server-only";

import type { CountryCode, IncidentType } from "@/generated/prisma/enums";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { prisma } from "@/lib/prisma";
import { lookupIncidentNotificationRules } from "./notification-catalog";
import {
  type NotificationDuty,
  resolveNotificationDeadline,
} from "./notification-deadline";

// P10d §D.4: resolve an incident's statutory notification duty (live, from the
// catalogue) and persist the "submitted on / reference number" fact. The duty
// is country-scoped and fail-closed (no cross-country borrow); the DE
// fatal/mass variant is selected when the incident is fatal. The clock starts
// from the accident date (occurredAt) — the clockStartsText from the rule tells
// the user the exact legal basis.

export type ResolvedIncidentNotification = {
  duty: NotificationDuty;
  legalReference: {
    code: string;
    obligation: string;
    sourceUrl: string;
  } | null;
  clockStartsText: string | null;
  thresholdText: string | null;
  worksCouncilCoSign: boolean; // DE §193 Abs. 5
};

// Is the incident a fatal/mass case (selects the DE "sofort" variant)?
function isFatalOrMass(opts: { fatal: boolean }): boolean {
  return opts.fatal;
}

export async function resolveIncidentNotification(input: {
  country: CountryCode;
  type: IncidentType;
  occurredAt: Date;
  fatal: boolean;
}): Promise<ResolvedIncidentNotification> {
  const rules = await lookupIncidentNotificationRules(input.country);
  const duty = resolveNotificationDeadline(
    rules,
    input.type,
    input.occurredAt,
    {
      fatalOrMass: isFatalOrMass({ fatal: input.fatal }),
    },
  );
  if (duty.kind === "none") {
    return {
      duty,
      legalReference: null,
      clockStartsText: null,
      thresholdText: null,
      worksCouncilCoSign: false,
    };
  }
  // The duty's rule is the pure shape; find the matching fetched row to read
  // its included LegalReference (same incident type + fatal-or-mass variant).
  const matched = rules.find(
    (r) =>
      r.incidentType === input.type &&
      r.appliesToFatalOrMass === duty.rule.appliesToFatalOrMass,
  );
  return {
    duty,
    legalReference: matched?.legalReference ?? null,
    clockStartsText: duty.rule.clockStartsText,
    thresholdText: duty.rule.thresholdText,
    worksCouncilCoSign: input.country === "DE",
  };
}

// Persist a submission (date + reference number) — upserts the row, status
// SUBMITTED. Audited.
export async function recordNotificationSubmission(input: {
  incidentId: string;
  siteId: string;
  actorUserId: string | null;
  submittedAt: Date;
  referenceNumber: string | null;
  note?: string | null;
}): Promise<void> {
  const incident = await prisma.incident.findUnique({
    where: { id: input.incidentId },
    select: { siteId: true, companyId: true },
  });
  if (!incident || incident.siteId !== input.siteId) {
    throw new Error("Incident not found");
  }
  await prisma.statutoryNotification.upsert({
    where: { incidentId: input.incidentId },
    create: {
      incidentId: input.incidentId,
      status: "SUBMITTED",
      submittedAt: input.submittedAt,
      referenceNumber: input.referenceNumber?.trim() || null,
      submittedByUserId: input.actorUserId,
      note: input.note?.trim() || null,
    },
    update: {
      status: "SUBMITTED",
      submittedAt: input.submittedAt,
      referenceNumber: input.referenceNumber?.trim() || null,
      submittedByUserId: input.actorUserId,
      note: input.note?.trim() || null,
    },
  });
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "statutory_notification.submit",
    entityType: "StatutoryNotification",
    entityId: input.incidentId,
    companyId: incident.companyId,
    siteId: input.siteId,
    diff: { referenceNumber: input.referenceNumber ? "set" : null },
  });
}

// Mark the duty waived (e.g. not actually reportable on closer review), with a
// reason. Audited.
export async function waiveNotification(input: {
  incidentId: string;
  siteId: string;
  actorUserId: string | null;
  note: string | null;
}): Promise<void> {
  const incident = await prisma.incident.findUnique({
    where: { id: input.incidentId },
    select: { siteId: true, companyId: true },
  });
  if (!incident || incident.siteId !== input.siteId) {
    throw new Error("Incident not found");
  }
  await prisma.statutoryNotification.upsert({
    where: { incidentId: input.incidentId },
    create: {
      incidentId: input.incidentId,
      status: "WAIVED",
      submittedByUserId: input.actorUserId,
      note: input.note?.trim() || null,
    },
    update: {
      status: "WAIVED",
      note: input.note?.trim() || null,
    },
  });
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "statutory_notification.waive",
    entityType: "StatutoryNotification",
    entityId: input.incidentId,
    companyId: incident.companyId,
    siteId: input.siteId,
  });
}
