import type {
  TrainingConfirmation,
  TrainingDeliveryMethod,
} from "@/generated/prisma/enums";
import type {
  TrainingRequirementTypeModel,
  TrainingSessionModel,
} from "@/generated/prisma/models";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { prisma } from "@/lib/prisma";
import { computeNextReviewDate } from "@/lib/risk/review-cycle";

export class TrainingSessionStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TrainingSessionStateError";
  }
}

// P7c Unterweisungen write gates (plan §7.6). People-compartment mutations,
// each audited (§3.18(d)). No `import "server-only"` — unit-testable, same as
// person.ts. validUntil is derived from the requirement's recurrenceMonths
// over the completion date (reusing computeNextReviewDate — add-months).

export async function createTrainingRequirementType(input: {
  companyId: string;
  title: string;
  contentOutline?: string | null;
  recurrenceMonths?: number | null;
  legalReferenceId?: string | null;
  deliveryMethod: TrainingDeliveryMethod;
  actorUserId: string;
}): Promise<TrainingRequirementTypeModel> {
  const row = await prisma.trainingRequirementType.create({
    data: {
      companyId: input.companyId,
      title: input.title.trim(),
      contentOutline: input.contentOutline?.trim() || null,
      recurrenceMonths: input.recurrenceMonths ?? null,
      legalReferenceId: input.legalReferenceId ?? null,
      deliveryMethod: input.deliveryMethod,
    },
  });
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "training_requirement.create",
    entityType: "TrainingRequirementType",
    entityId: row.id,
    companyId: input.companyId,
  });
  return row;
}

// Record one training session and a TrainingRecord per attendee, in one
// transaction. validUntil is set from the requirement's recurrence. Writes a
// single training.record audit event with the attendee count.
export async function recordTrainingSession(input: {
  companyId: string;
  requirementTypeId: string;
  date: Date;
  instructor: string;
  topics?: string | null;
  attendeePersonIds: string[];
  confirmation: TrainingConfirmation;
  actorUserId: string;
}): Promise<{ session: TrainingSessionModel; recordCount: number }> {
  const requirement = await prisma.trainingRequirementType.findUnique({
    where: { id: input.requirementTypeId },
    select: { companyId: true, recurrenceMonths: true, deliveryMethod: true },
  });
  if (!requirement) {
    throw new Error("Training requirement type does not exist");
  }
  // The requirement must belong to this company (or be a system row).
  if (
    requirement.companyId !== null &&
    requirement.companyId !== input.companyId
  ) {
    throw new Error("Training requirement type belongs to another company");
  }
  const validUntil = computeNextReviewDate(
    input.date,
    requirement.recurrenceMonths,
  );

  const session = await prisma.$transaction(async (tx) => {
    const s = await tx.trainingSession.create({
      data: {
        companyId: input.companyId,
        requirementTypeId: input.requirementTypeId,
        date: input.date,
        instructor: input.instructor.trim(),
        topics: input.topics?.trim() || null,
        // P17 §4: the quick path records a session that already happened.
        status: "COMPLETED",
        completedAt: input.date,
      },
    });
    // Only attendees that are real persons of this company get a record.
    const persons = await tx.person.findMany({
      where: {
        id: { in: input.attendeePersonIds },
        companyId: input.companyId,
      },
      select: { id: true },
    });
    for (const p of persons) {
      await tx.trainingSessionParticipant.create({
        data: {
          trainingSessionId: s.id,
          personId: p.id,
          status: "ATTENDED",
          signatureConfirmed: input.confirmation === "SIGNATURE",
          recordedAt: input.date,
        },
      });
      await tx.trainingRecord.create({
        data: {
          personId: p.id,
          requirementTypeId: input.requirementTypeId,
          trainingSessionId: s.id,
          completedAt: input.date,
          method: requirement.deliveryMethod,
          confirmation: input.confirmation,
          validUntil,
        },
      });
    }
    return { session: s, recordCount: persons.length };
  });

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "training.record",
    entityType: "TrainingSession",
    entityId: session.session.id,
    companyId: input.companyId,
    diff: { attendees: session.recordCount },
  });
  return session;
}

// P17 §4: a leader PLANS a session ahead of the date and invites people from
// their own units. Creates a PLANNED session + an INVITED participant per
// person (filtered to real persons of this company). The caller is responsible
// for scoping invitedPersonIds to the leader's accessible units (scope.ts);
// this gate only enforces the company boundary. Audited.
export async function planTrainingSession(input: {
  companyId: string;
  requirementTypeId: string;
  date: Date;
  instructor: string;
  location?: string | null;
  topics?: string | null;
  invitedPersonIds: string[];
  plannedByUserId: string;
}): Promise<{ session: TrainingSessionModel; invitedCount: number }> {
  const requirement = await prisma.trainingRequirementType.findUnique({
    where: { id: input.requirementTypeId },
    select: { companyId: true },
  });
  if (!requirement) {
    throw new Error("Training requirement type does not exist");
  }
  if (
    requirement.companyId !== null &&
    requirement.companyId !== input.companyId
  ) {
    throw new Error("Training requirement type belongs to another company");
  }

  const result = await prisma.$transaction(async (tx) => {
    const s = await tx.trainingSession.create({
      data: {
        companyId: input.companyId,
        requirementTypeId: input.requirementTypeId,
        date: input.date,
        instructor: input.instructor.trim(),
        location: input.location?.trim() || null,
        topics: input.topics?.trim() || null,
        status: "PLANNED",
        plannedByUserId: input.plannedByUserId,
      },
    });
    const persons = await tx.person.findMany({
      where: { id: { in: input.invitedPersonIds }, companyId: input.companyId },
      select: { id: true },
    });
    for (const p of persons) {
      await tx.trainingSessionParticipant.create({
        data: { trainingSessionId: s.id, personId: p.id, status: "INVITED" },
      });
    }
    return { session: s, invitedCount: persons.length };
  });

  await recordAuditEvent({
    actorUserId: input.plannedByUserId,
    action: "training_session.plan",
    entityType: "TrainingSession",
    entityId: result.session.id,
    companyId: input.companyId,
    diff: { invited: result.invitedCount, date: input.date.toISOString() },
  });
  return result;
}

// P17 §4: record attendance and COMPLETE a planned session. For each roster
// entry, set ATTENDED/ABSENT + signatureConfirmed; ATTENDED participants get a
// TrainingRecord with validUntil from the requirement recurrence. Only a
// PLANNED session can be completed (fail-closed on any other state). Audited.
export async function completeTrainingSession(input: {
  trainingSessionId: string;
  companyId: string;
  attendance: Array<{
    personId: string;
    attended: boolean;
    signatureConfirmed?: boolean;
  }>;
  confirmation: TrainingConfirmation;
  actorUserId: string;
}): Promise<{ recordCount: number }> {
  const session = await prisma.trainingSession.findUnique({
    where: { id: input.trainingSessionId },
    select: {
      companyId: true,
      status: true,
      date: true,
      requirementTypeId: true,
      requirementType: {
        select: { recurrenceMonths: true, deliveryMethod: true },
      },
    },
  });
  if (!session || session.companyId !== input.companyId) {
    throw new Error("Training session not found");
  }
  if (session.status !== "PLANNED") {
    throw new TrainingSessionStateError(
      "Only a planned session can be completed.",
    );
  }
  const validUntil = computeNextReviewDate(
    session.date,
    session.requirementType.recurrenceMonths,
  );
  const attendanceByPerson = new Map(
    input.attendance.map((a) => [a.personId, a]),
  );

  const recordCount = await prisma.$transaction(async (tx) => {
    const participants = await tx.trainingSessionParticipant.findMany({
      where: { trainingSessionId: input.trainingSessionId },
      select: { personId: true },
    });
    let records = 0;
    for (const p of participants) {
      const a = attendanceByPerson.get(p.personId);
      const attended = a?.attended ?? false;
      await tx.trainingSessionParticipant.update({
        where: {
          trainingSessionId_personId: {
            trainingSessionId: input.trainingSessionId,
            personId: p.personId,
          },
        },
        data: {
          status: attended ? "ATTENDED" : "ABSENT",
          signatureConfirmed: attended
            ? (a?.signatureConfirmed ?? false)
            : false,
          recordedAt: new Date(),
        },
      });
      if (attended) {
        await tx.trainingRecord.create({
          data: {
            personId: p.personId,
            requirementTypeId: session.requirementTypeId,
            trainingSessionId: input.trainingSessionId,
            completedAt: session.date,
            method: session.requirementType.deliveryMethod,
            confirmation: input.confirmation,
            validUntil,
          },
        });
        records += 1;
      }
    }
    await tx.trainingSession.update({
      where: { id: input.trainingSessionId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    return records;
  });

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "training_session.complete",
    entityType: "TrainingSession",
    entityId: input.trainingSessionId,
    companyId: input.companyId,
    diff: { attended: recordCount },
  });
  return { recordCount };
}

// P17 §4: cancel a planned session (no records created). Audited.
export async function cancelTrainingSession(input: {
  trainingSessionId: string;
  companyId: string;
  actorUserId: string;
}): Promise<void> {
  const session = await prisma.trainingSession.findUnique({
    where: { id: input.trainingSessionId },
    select: { companyId: true, status: true },
  });
  if (!session || session.companyId !== input.companyId) {
    throw new Error("Training session not found");
  }
  if (session.status !== "PLANNED") {
    throw new TrainingSessionStateError(
      "Only a planned session can be cancelled.",
    );
  }
  await prisma.trainingSession.update({
    where: { id: input.trainingSessionId },
    data: { status: "CANCELLED" },
  });
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "training_session.cancel",
    entityType: "TrainingSession",
    entityId: input.trainingSessionId,
    companyId: input.companyId,
  });
}
