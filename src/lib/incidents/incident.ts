import type {
  IncidentInvestigationMethod,
  IncidentStatus,
  IncidentType,
  RiskBand,
} from "@/generated/prisma/enums";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { prisma } from "@/lib/prisma";
import { canTransitionIncident } from "./incident-transitions";

// P10a (SLD_P10_COMPARTMENT_DESIGN_NOTE.md) incident write gates — one function
// per rule, the createInspection()/createFinding() pattern, every mutation
// audited (ERGO §3.18(d)). Incidents describe an EVENT, never a person: the
// reporter/triager/closer are PlatformUser ids (staff accounts), the subject is
// a plain workstation/org-unit id (subject helper validates, never a relation
// into the assessment chain). Involved people (P10b) and health (P10c) are
// separate people-compartment tables. No `import "server-only"` — directly
// unit-testable with a mocked prisma, same as the other lib gates.

export async function createIncident(input: {
  companyId: string;
  siteId: string;
  type: IncidentType;
  title: string;
  description: string;
  occurredAt: Date;
  actorUserId: string | null;
  reportedByUserId?: string | null;
  subjectWorkstationId?: string | null;
  subjectOrgUnitId?: string | null;
  locationText?: string | null;
}): Promise<{ id: string }> {
  if (input.title.trim().length === 0) {
    throw new Error("Incident title is required");
  }
  if (input.description.trim().length === 0) {
    throw new Error("Incident description is required");
  }
  const incident = await prisma.incident.create({
    data: {
      companyId: input.companyId,
      siteId: input.siteId,
      type: input.type,
      status: "REPORTED",
      occurredAt: input.occurredAt,
      reportedByUserId: input.reportedByUserId ?? input.actorUserId ?? null,
      subjectWorkstationId: input.subjectWorkstationId ?? null,
      subjectOrgUnitId: input.subjectOrgUnitId ?? null,
      locationText: input.locationText?.trim() || null,
      title: input.title.trim(),
      description: input.description.trim(),
    },
  });
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "incident.create",
    entityType: "Incident",
    entityId: incident.id,
    companyId: input.companyId,
    siteId: input.siteId,
    diff: { type: input.type },
  });
  return { id: incident.id };
}

// Triage: set work-relatedness, severity band and the two one-way domain flags,
// and advance REPORTED -> TRIAGED. The status move is validated against the
// machine; triage of an already-triaged incident just updates the fields.
export async function triageIncident(input: {
  incidentId: string;
  siteId: string;
  actorUserId: string | null;
  severity?: RiskBand | null;
  isWorkRelated?: boolean | null;
  environmentalEventFlagged?: boolean;
  assessmentReviewFlagged?: boolean;
}): Promise<void> {
  const incident = await prisma.incident.findUnique({
    where: { id: input.incidentId },
    select: { siteId: true, companyId: true, status: true },
  });
  if (!incident || incident.siteId !== input.siteId) {
    throw new Error("Incident not found");
  }
  const advancing = incident.status === "REPORTED";
  if (advancing && !canTransitionIncident(incident.status, "TRIAGED")) {
    throw new Error(`Illegal transition ${incident.status} -> TRIAGED`);
  }
  await prisma.incident.update({
    where: { id: input.incidentId },
    data: {
      severity: input.severity ?? null,
      isWorkRelated: input.isWorkRelated ?? null,
      environmentalEventFlagged: input.environmentalEventFlagged ?? undefined,
      assessmentReviewFlagged: input.assessmentReviewFlagged ?? undefined,
      status: advancing ? "TRIAGED" : undefined,
    },
  });
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "incident.triage",
    entityType: "Incident",
    entityId: input.incidentId,
    companyId: incident.companyId,
    siteId: input.siteId,
    diff: { severity: input.severity ?? null },
  });
}

// General status transition (investigation start, actions-pending, close,
// reopen). Validated against the machine; CLOSED stamps closedAt/closedByUserId.
export async function transitionIncident(input: {
  incidentId: string;
  siteId: string;
  to: IncidentStatus;
  actorUserId: string | null;
}): Promise<void> {
  const incident = await prisma.incident.findUnique({
    where: { id: input.incidentId },
    select: { siteId: true, companyId: true, status: true },
  });
  if (!incident || incident.siteId !== input.siteId) {
    throw new Error("Incident not found");
  }
  if (!canTransitionIncident(incident.status, input.to)) {
    throw new Error(`Illegal transition ${incident.status} -> ${input.to}`);
  }
  const closing = input.to === "CLOSED";
  await prisma.incident.update({
    where: { id: input.incidentId },
    data: {
      status: input.to,
      closedAt: closing
        ? new Date()
        : input.to === "ACTIONS_PENDING"
          ? null
          : undefined,
      closedByUserId: closing ? input.actorUserId : undefined,
    },
  });
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "incident.status",
    entityType: "Incident",
    entityId: input.incidentId,
    companyId: incident.companyId,
    siteId: input.siteId,
    diff: { from: incident.status, to: input.to },
  });
}

// Upsert the 1:1 structured investigation. Does not itself move status — the
// caller advances to UNDER_INVESTIGATION via transitionIncident when starting.
export async function setIncidentInvestigation(input: {
  incidentId: string;
  siteId: string;
  actorUserId: string | null;
  method: IncidentInvestigationMethod;
  sequenceOfEvents?: string | null;
  directCauses?: string | null;
  rootCauses?: string | null;
  contributingFactors?: string | null;
  investigatedByUserId?: string | null;
}): Promise<void> {
  const incident = await prisma.incident.findUnique({
    where: { id: input.incidentId },
    select: { siteId: true, companyId: true },
  });
  if (!incident || incident.siteId !== input.siteId) {
    throw new Error("Incident not found");
  }
  const data = {
    method: input.method,
    sequenceOfEvents: input.sequenceOfEvents?.trim() || null,
    directCauses: input.directCauses?.trim() || null,
    rootCauses: input.rootCauses?.trim() || null,
    contributingFactors: input.contributingFactors?.trim() || null,
    investigatedByUserId: input.investigatedByUserId ?? null,
    investigatedAt: new Date(),
  };
  await prisma.incidentInvestigation.upsert({
    where: { incidentId: input.incidentId },
    create: { incidentId: input.incidentId, ...data },
    update: data,
  });
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "incident_investigation.update",
    entityType: "IncidentInvestigation",
    entityId: input.incidentId,
    companyId: incident.companyId,
    siteId: input.siteId,
  });
}

// Raise an Action from an incident — the one action engine (§2.2): incidentId
// is the Action's single source (one-of-five CHECK).
export async function raiseActionFromIncident(input: {
  incidentId: string;
  siteId: string;
  actorUserId: string | null;
  title: string;
  description?: string | null;
  responsibleUserId?: string | null;
  responsibleRoleLabel?: string | null;
  dueDate?: Date | null;
}): Promise<{ id: string }> {
  const incident = await prisma.incident.findUnique({
    where: { id: input.incidentId },
    select: { siteId: true, companyId: true },
  });
  if (!incident || incident.siteId !== input.siteId) {
    throw new Error("Incident not found");
  }
  if (input.title.trim().length === 0) {
    throw new Error("Action title is required");
  }
  const action = await prisma.action.create({
    data: {
      siteId: input.siteId,
      incidentId: input.incidentId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      responsibleUserId: input.responsibleUserId ?? null,
      responsibleRoleLabel: input.responsibleRoleLabel?.trim() || null,
      dueDate: input.dueDate ?? null,
    },
  });
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "action.create",
    entityType: "Action",
    entityId: action.id,
    companyId: incident.companyId,
    siteId: input.siteId,
    diff: { source: "incident", incidentId: input.incidentId },
  });
  return { id: action.id };
}
