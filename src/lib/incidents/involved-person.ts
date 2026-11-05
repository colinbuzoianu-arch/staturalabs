import type { IncidentInvolvedRole } from "@/generated/prisma/enums";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { prisma } from "@/lib/prisma";

// P10b (SLD_P10_COMPARTMENT_DESIGN_NOTE.md §3) — attach/detach a Person to an
// incident. The ONLY place a Person meets an incident (people→people, §3.18).
// Scope is checked both ways: the incident must belong to the given site, and
// the Person must belong to the same company as that site — a cross-tenant
// person can never be linked. Every mutation is audited (the entityId is the
// involved-person link, the diff records the role, never any health detail —
// there is none here). No `import "server-only"`: unit-testable like the rest.

export async function addInvolvedPerson(input: {
  incidentId: string;
  siteId: string;
  personId: string;
  role: IncidentInvolvedRole;
  actorUserId: string | null;
}): Promise<{ id: string }> {
  const incident = await prisma.incident.findUnique({
    where: { id: input.incidentId },
    select: { siteId: true, companyId: true },
  });
  if (!incident || incident.siteId !== input.siteId) {
    throw new Error("Incident not found");
  }
  const person = await prisma.person.findUnique({
    where: { id: input.personId },
    select: { companyId: true },
  });
  if (!person || person.companyId !== incident.companyId) {
    // Fail-closed: never link a person from another tenant, and never confirm
    // a foreign person's existence by a distinct error.
    throw new Error("Person not found");
  }
  const link = await prisma.incidentInvolvedPerson.create({
    data: {
      incidentId: input.incidentId,
      personId: input.personId,
      role: input.role,
    },
  });
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "incident_involved_person.add",
    entityType: "IncidentInvolvedPerson",
    entityId: link.id,
    companyId: incident.companyId,
    siteId: input.siteId,
    diff: { role: input.role },
  });
  return { id: link.id };
}

export async function removeInvolvedPerson(input: {
  involvedPersonId: string;
  siteId: string;
  actorUserId: string | null;
}): Promise<void> {
  const link = await prisma.incidentInvolvedPerson.findUnique({
    where: { id: input.involvedPersonId },
    include: { incident: { select: { siteId: true, companyId: true } } },
  });
  if (!link || link.incident.siteId !== input.siteId) {
    throw new Error("Involved person not found");
  }
  await prisma.incidentInvolvedPerson.delete({
    where: { id: input.involvedPersonId },
  });
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "incident_involved_person.remove",
    entityType: "IncidentInvolvedPerson",
    entityId: input.involvedPersonId,
    companyId: link.incident.companyId,
    siteId: input.siteId,
  });
}
