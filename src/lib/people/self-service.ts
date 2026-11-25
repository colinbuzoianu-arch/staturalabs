import "server-only";

import type { IncidentType } from "@/generated/prisma/enums";
import type { PersonModel, PlatformUserModel } from "@/generated/prisma/models";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { createIncident } from "@/lib/incidents/incident";
import { prisma } from "@/lib/prisma";
import { computeNextReviewDate } from "@/lib/risk/review-cycle";
import {
  activeAssignmentsForPerson,
  buildCompanyDerivationMaps,
} from "./derivation-maps";
import { deriveRequiredTrainings } from "./requirement-derivation";
import {
  buildSelfInstructions,
  isSelfConfirmableDelivery,
  type SelfInstruction,
  type SelfRequiredType,
} from "./self-instructions";

// P17 §5 (SLD_P17_TENANT_ROLES_APPROVED.md): the employee self-service data
// layer. Everything here is anchored on the Person a login account is linked
// to (Person.platformUserId, the one-way §3 link) — NOT on site access, since
// a self-scoped employee has no accessible site (canAccessSite is false). The
// employee only ever sees their OWN instructions, the Betriebsanweisungen for
// workstations they are assigned to, and events they reported themselves.
//
// This stays inside the people compartment: it reads PersonAssignment (which
// exists only to derive requirements, §3.2) to find the employee's
// workstations, but never writes a person id into the assessment chain and
// never joins the two in a report.

export type SelfPerson = Pick<
  PersonModel,
  "id" | "companyId" | "firstName" | "lastName"
>;

// The Person this login account is linked to (active, not anonymised).
export async function getSelfPerson(
  user: PlatformUserModel,
): Promise<SelfPerson | null> {
  const person = await prisma.person.findFirst({
    where: { platformUserId: user.id, active: true, anonymisedAt: null },
    select: { id: true, companyId: true, firstName: true, lastName: true },
  });
  return person;
}

export type SelfInvitation = {
  sessionId: string;
  title: string;
  date: Date;
  location: string | null;
  instructor: string;
};

// The employee's required instructions (with status + the "why") plus their
// open invitations to planned sessions. Reuses the exact derivation + status
// the manager matrix uses, so the two surfaces always agree.
export async function getSelfInstructions(
  person: SelfPerson,
  now: Date = new Date(),
): Promise<{ instructions: SelfInstruction[]; invitations: SelfInvitation[] }> {
  const { maps, sources } = await buildCompanyDerivationMaps(person.companyId);
  const assignments = await activeAssignmentsForPerson(person.id, now);
  const derived = deriveRequiredTrainings(assignments, sources, maps);

  const typeIds = derived.map((d) => d.requirementTypeId);
  const [types, records, invited] = await Promise.all([
    typeIds.length > 0
      ? prisma.trainingRequirementType.findMany({
          where: { id: { in: typeIds } },
          select: {
            id: true,
            title: true,
            deliveryMethod: true,
            recurrenceMonths: true,
          },
        })
      : Promise.resolve([]),
    prisma.trainingRecord.findMany({
      where: { personId: person.id },
      select: { requirementTypeId: true, validUntil: true },
    }),
    prisma.trainingSessionParticipant.findMany({
      where: {
        personId: person.id,
        status: "INVITED",
        trainingSession: { status: "PLANNED" },
      },
      select: {
        trainingSession: {
          select: {
            id: true,
            date: true,
            location: true,
            instructor: true,
            requirementType: { select: { title: true } },
          },
        },
      },
      orderBy: { trainingSession: { date: "asc" } },
    }),
  ]);

  const typeById = new Map(types.map((t) => [t.id, t]));
  const sourcesByType = new Map(
    derived.map((d) => [d.requirementTypeId, d.sources]),
  );
  const required: SelfRequiredType[] = derived.flatMap((d) => {
    const t = typeById.get(d.requirementTypeId);
    if (!t) return [];
    return [
      {
        requirementTypeId: t.id,
        title: t.title,
        deliveryMethod: t.deliveryMethod,
        recurrenceMonths: t.recurrenceMonths,
        sourceTypes: [
          ...new Set(
            (sourcesByType.get(d.requirementTypeId) ?? []).map(
              (s) => s.subjectType,
            ),
          ),
        ],
      },
    ];
  });

  const instructions = buildSelfInstructions(required, records, now).sort(
    (a, b) => a.title.localeCompare(b.title),
  );

  const invitations: SelfInvitation[] = invited.map((p) => ({
    sessionId: p.trainingSession.id,
    title: p.trainingSession.requirementType.title,
    date: p.trainingSession.date,
    location: p.trainingSession.location,
    instructor: p.trainingSession.instructor,
  }));

  return { instructions, invitations };
}

// P17 §5 "confirm a received instruction": the employee self-confirms a
// document-read instruction they are actually required to do. Fail-closed:
// rejects a requirement type they aren't required to do, and any delivery
// method other than DOCUMENT_READ_CONFIRMATION (in-person/e-learning are
// recorded by whoever ran the session). Writes a SELF_CONFIRMED TrainingRecord
// and an audit event, inside the people compartment.
export async function confirmSelfInstruction(input: {
  user: PlatformUserModel;
  requirementTypeId: string;
  now?: Date;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const now = input.now ?? new Date();
  const person = await getSelfPerson(input.user);
  if (!person) return { ok: false, reason: "no-person" };

  // Must be a type this person is actually required to do (derivation is the
  // authority, not the submitted id).
  const { instructions } = await getSelfInstructions(person, now);
  const target = instructions.find(
    (i) => i.requirementTypeId === input.requirementTypeId,
  );
  if (!target) return { ok: false, reason: "not-required" };
  // Idempotent: a confirmation already in force is not re-recorded. Found in
  // slice 8's walkthrough — re-posting the form wrote a second
  // TrainingRecord for the same still-valid requirement, which inflates the
  // proof trail with duplicates (harmless for the status, since the strongest
  // record wins, but it is noise in a record a labour inspector may read).
  if (target.status === "valid") return { ok: false, reason: "already-valid" };

  const type = await prisma.trainingRequirementType.findUnique({
    where: { id: input.requirementTypeId },
    select: { deliveryMethod: true, recurrenceMonths: true },
  });
  if (!type || !isSelfConfirmableDelivery(type.deliveryMethod)) {
    return { ok: false, reason: "not-self-confirmable" };
  }

  const validUntil = computeNextReviewDate(now, type.recurrenceMonths);
  const record = await prisma.trainingRecord.create({
    data: {
      personId: person.id,
      requirementTypeId: input.requirementTypeId,
      completedAt: now,
      method: type.deliveryMethod,
      confirmation: "SELF_CONFIRMED",
      validUntil,
    },
  });
  await recordAuditEvent({
    actorUserId: input.user.id,
    action: "training.self_confirm",
    entityType: "TrainingRecord",
    entityId: record.id,
    companyId: person.companyId,
  });
  return { ok: true };
}

export type SelfBetriebsanweisung = {
  operatingInstructionId: string;
  substanceName: string;
  siteId: string;
  workstationNames: string[];
};

// The approved Betriebsanweisungen for substances actively used at the
// workstations the employee is assigned to (§5 "Betriebsanweisungen for own
// workstation"). AT/DE only — the BA PDF is country-gated (fail-closed), so a
// substance at a non-AT/DE site simply doesn't appear here.
export async function getSelfBetriebsanweisungen(
  person: SelfPerson,
  now: Date = new Date(),
): Promise<SelfBetriebsanweisung[]> {
  const assignments = await activeAssignmentsForPerson(person.id, now);
  const workstationIds = assignments
    .map((a) => a.workstationId)
    .filter((id): id is string => id !== null);
  if (workstationIds.length === 0) return [];

  const uses = await prisma.substanceUse.findMany({
    where: { workstationId: { in: workstationIds }, activeTo: null },
    select: {
      substanceId: true,
      workstationId: true,
      workstation: { select: { name: true } },
    },
  });
  if (uses.length === 0) return [];

  const substanceIds = [...new Set(uses.map((u) => u.substanceId))];
  const ois = await prisma.operatingInstruction.findMany({
    where: {
      substanceId: { in: substanceIds },
      status: "APPROVED",
      site: { country: { in: ["AT", "DE"] } },
    },
    select: {
      id: true,
      substanceId: true,
      siteId: true,
      substance: { select: { tradeName: true } },
    },
  });

  // workstation names per substance used by this employee.
  const wsNamesBySubstance = new Map<string, Set<string>>();
  for (const u of uses) {
    if (!u.workstation) continue;
    const set = wsNamesBySubstance.get(u.substanceId) ?? new Set<string>();
    set.add(u.workstation.name);
    wsNamesBySubstance.set(u.substanceId, set);
  }

  return ois
    .map((oi) => ({
      operatingInstructionId: oi.id,
      substanceName: oi.substance.tradeName,
      siteId: oi.siteId,
      workstationNames: [...(wsNamesBySubstance.get(oi.substanceId) ?? [])],
    }))
    .sort((a, b) => a.substanceName.localeCompare(b.substanceName));
}

// The sites the employee's active assignments touch (workstation's site or an
// assigned org unit's site), used for the worker-briefing link.
export async function getSelfBriefingSites(
  person: SelfPerson,
  now: Date = new Date(),
): Promise<{ id: string; name: string }[]> {
  const siteIds = await selfSiteIds(person.id, now);
  if (siteIds.size === 0) return [];
  const sites = await prisma.site.findMany({
    where: { id: { in: [...siteIds] } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return sites;
}

// The set of site ids an employee's active assignments resolve to.
async function selfSiteIds(personId: string, now: Date): Promise<Set<string>> {
  const assignments = await activeAssignmentsForPerson(personId, now);
  const workstationIds = assignments
    .map((a) => a.workstationId)
    .filter((id): id is string => id !== null);
  const orgUnitIds = assignments
    .map((a) => a.orgUnitId)
    .filter((id): id is string => id !== null);

  const [workstations, orgUnits] = await Promise.all([
    workstationIds.length > 0
      ? prisma.workstation.findMany({
          where: { id: { in: workstationIds } },
          select: { siteId: true },
        })
      : Promise.resolve([]),
    orgUnitIds.length > 0
      ? prisma.orgUnit.findMany({
          where: { id: { in: orgUnitIds } },
          select: { siteId: true },
        })
      : Promise.resolve([]),
  ]);
  const ids = new Set<string>();
  for (const w of workstations) ids.add(w.siteId);
  for (const o of orgUnits) ids.add(o.siteId);
  return ids;
}

// Narrow access gate for the employee BA download route: true only when the
// signed-in user's linked Person is assigned to a workstation where the
// operating instruction's substance is actively used. Never widens the admin
// BA route's requireSiteAccess gate — this is a separate, assignment-scoped
// door.
export async function canDownloadOperatingInstructionAsPerson(
  user: PlatformUserModel,
  operatingInstructionId: string,
): Promise<boolean> {
  const person = await getSelfPerson(user);
  if (!person) return false;
  const bas = await getSelfBetriebsanweisungen(person);
  return bas.some((b) => b.operatingInstructionId === operatingInstructionId);
}

// Access gate for the employee worker-briefing route: the person must have an
// assignment touching this site.
export async function canDownloadWorkerBriefingAsPerson(
  user: PlatformUserModel,
  siteId: string,
): Promise<boolean> {
  const person = await getSelfPerson(user);
  if (!person) return false;
  const ids = await selfSiteIds(person.id, new Date());
  return ids.has(siteId);
}

export type SelfIncident = {
  id: string;
  title: string;
  type: IncidentType;
  status: string;
  occurredAt: Date;
  reportedAt: Date;
};

// Events this employee reported themselves (§5 "own incident reports" — status
// only). Scoped strictly to reportedByUserId so it never leaks another
// person's report.
export async function getSelfReportedIncidents(
  user: PlatformUserModel,
): Promise<SelfIncident[]> {
  const rows = await prisma.incident.findMany({
    where: { reportedByUserId: user.id },
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      occurredAt: true,
      reportedAt: true,
    },
    orderBy: { reportedAt: "desc" },
    take: 50,
  });
  return rows;
}

export type SelfReportWorkstation = {
  id: string;
  name: string;
  siteId: string;
};

// The workstations an employee may file an event against (their assigned ones),
// for the report form's picker.
export async function getSelfReportWorkstations(
  person: SelfPerson,
  now: Date = new Date(),
): Promise<SelfReportWorkstation[]> {
  const assignments = await activeAssignmentsForPerson(person.id, now);
  const workstationIds = assignments
    .map((a) => a.workstationId)
    .filter((id): id is string => id !== null);
  if (workstationIds.length === 0) return [];
  const rows = await prisma.workstation.findMany({
    where: { id: { in: workstationIds } },
    select: { id: true, name: true, siteId: true },
    orderBy: { name: "asc" },
  });
  return rows;
}

// P17 §5 "own incident reports" (report path). The employee reports an event at
// one of their assigned workstations. Fail-closed: the workstation must be one
// they are actually assigned to; the incident's company/site are resolved from
// it server-side (never trusted from the form). reportedByUserId is the
// employee, so getSelfReportedIncidents shows it back to them.
export async function reportSelfIncident(input: {
  user: PlatformUserModel;
  workstationId: string;
  type: IncidentType;
  title: string;
  description: string;
  occurredAt: Date;
  now?: Date;
}): Promise<{ ok: true; id: string } | { ok: false; reason: string }> {
  const now = input.now ?? new Date();
  const person = await getSelfPerson(input.user);
  if (!person) return { ok: false, reason: "no-person" };

  const allowed = await getSelfReportWorkstations(person, now);
  const ws = allowed.find((w) => w.id === input.workstationId);
  if (!ws) return { ok: false, reason: "not-assigned" };

  if (
    input.title.trim().length === 0 ||
    input.description.trim().length === 0
  ) {
    return { ok: false, reason: "incomplete" };
  }

  const { id } = await createIncident({
    companyId: person.companyId,
    siteId: ws.siteId,
    type: input.type,
    title: input.title,
    description: input.description,
    occurredAt: input.occurredAt,
    actorUserId: input.user.id,
    reportedByUserId: input.user.id,
    subjectWorkstationId: ws.id,
  });
  return { ok: true, id };
}
