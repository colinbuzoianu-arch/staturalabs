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
