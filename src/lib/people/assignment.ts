import type { RequirementSourceType } from "@/generated/prisma/enums";
import type {
  PersonAssignmentModel,
  TrainingRequirementSourceModel,
} from "@/generated/prisma/models";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { prisma } from "@/lib/prisma";

// P7d §A people-compartment write gates (SLD_P7B_DEFERRALS_RESOLVED.md).
// Assignments and requirement sources. Every mutation is audited. The subject
// (workstation / org unit / process) is a plain id (no FK), so these gates own
// the "subject belongs to this company" integrity the missing FK would give.

async function subjectCompanyId(
  subjectType: RequirementSourceType,
  subjectId: string,
): Promise<string | null> {
  switch (subjectType) {
    case "WORKSTATION": {
      const w = await prisma.workstation.findUnique({
        where: { id: subjectId },
        select: { site: { select: { companyId: true } } },
      });
      return w?.site.companyId ?? null;
    }
    case "ORG_UNIT": {
      const o = await prisma.orgUnit.findUnique({
        where: { id: subjectId },
        select: { site: { select: { companyId: true } } },
      });
      return o?.site.companyId ?? null;
    }
    case "PROCESS": {
      const p = await prisma.process.findUnique({
        where: { id: subjectId },
        select: { site: { select: { companyId: true } } },
      });
      return p?.site.companyId ?? null;
    }
    default:
      return null;
  }
}

export async function createPersonAssignment(input: {
  personId: string;
  companyId: string;
  workstationId?: string | null;
  orgUnitId?: string | null;
  validFrom?: Date | null;
  validUntil?: Date | null;
  actorUserId: string;
}): Promise<PersonAssignmentModel> {
  const hasWs = !!input.workstationId;
  const hasOu = !!input.orgUnitId;
  if (hasWs === hasOu) {
    throw new Error("Exactly one of workstation or org unit is required");
  }
  // The person must be of this company, and the subject too.
  const person = await prisma.person.findUnique({
    where: { id: input.personId },
    select: { companyId: true },
  });
  if (!person || person.companyId !== input.companyId) {
    throw new Error("Person is not in this company");
  }
  const subjCompany = hasWs
    ? await subjectCompanyId("WORKSTATION", input.workstationId as string)
    : await subjectCompanyId("ORG_UNIT", input.orgUnitId as string);
  if (subjCompany !== input.companyId) {
    throw new Error("Assignment target is not in this company");
  }

  const row = await prisma.personAssignment.create({
    data: {
      personId: input.personId,
      workstationId: input.workstationId ?? null,
      orgUnitId: input.orgUnitId ?? null,
      validFrom: input.validFrom ?? null,
      validUntil: input.validUntil ?? null,
    },
  });
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "person_assignment.create",
    entityType: "PersonAssignment",
    entityId: row.id,
    companyId: input.companyId,
  });
  return row;
}

export async function endPersonAssignment(
  assignmentId: string,
  companyId: string,
  actorUserId: string,
): Promise<void> {
  // Scope: only an assignment of a person in this company.
  const assignment = await prisma.personAssignment.findUnique({
    where: { id: assignmentId },
    select: { person: { select: { companyId: true } } },
  });
  if (!assignment || assignment.person.companyId !== companyId) return;
  await prisma.personAssignment.update({
    where: { id: assignmentId },
    data: { validUntil: new Date() },
  });
  await recordAuditEvent({
    actorUserId,
    action: "person_assignment.end",
    entityType: "PersonAssignment",
    entityId: assignmentId,
    companyId,
  });
}

export async function addRequirementSource(input: {
  requirementTypeId: string;
  subjectType: RequirementSourceType;
  subjectId: string;
  companyId: string;
  actorUserId: string;
}): Promise<TrainingRequirementSourceModel> {
  if (input.subjectType === "SUBSTANCE") {
    throw new Error("SUBSTANCE requirement sources are reserved for P8");
  }
  const subjCompany = await subjectCompanyId(
    input.subjectType,
    input.subjectId,
  );
  if (subjCompany !== input.companyId) {
    throw new Error("Requirement-source subject is not in this company");
  }
  // The requirement type must be system-wide or of this company.
  const type = await prisma.trainingRequirementType.findUnique({
    where: { id: input.requirementTypeId },
    select: { companyId: true },
  });
  if (
    !type ||
    (type.companyId !== null && type.companyId !== input.companyId)
  ) {
    throw new Error("Requirement type is not available to this company");
  }
  const row = await prisma.trainingRequirementSource.create({
    data: {
      requirementTypeId: input.requirementTypeId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
    },
  });
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "training_requirement_source.create",
    entityType: "TrainingRequirementSource",
    entityId: row.id,
    companyId: input.companyId,
  });
  return row;
}

export async function removeRequirementSource(
  sourceId: string,
  companyId: string,
  actorUserId: string,
): Promise<void> {
  await prisma.trainingRequirementSource.deleteMany({
    where: { id: sourceId },
  });
  await recordAuditEvent({
    actorUserId,
    action: "training_requirement_source.delete",
    entityType: "TrainingRequirementSource",
    entityId: sourceId,
    companyId,
  });
}
