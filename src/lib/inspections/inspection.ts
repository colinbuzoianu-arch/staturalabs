import type {
  InspectionStatus,
  RiskBand,
  YesNoNa,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { type AnswerShape, isAnswerAnswered } from "./inspection-completeness";

// P9 (SLD_RESTRUCTURE_PLAN_platform-modules.md §7.3) inspection write gates —
// one function per rule, the createAssessmentSession()/createFinding() pattern.
// Inspections assess CONDITIONS and never reference a worker (§3.1); the team
// and performer are PlatformUser ids (staff accounts).

// Legal status transitions. PLANNED -> IN_PROGRESS -> COMPLETED -> CLOSED, with
// one revert (COMPLETED -> IN_PROGRESS to fix an answer before closing).
const TRANSITIONS: Readonly<Record<InspectionStatus, InspectionStatus[]>> = {
  PLANNED: ["IN_PROGRESS"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: ["CLOSED", "IN_PROGRESS"],
  CLOSED: [],
};

export async function createInspectionFromTemplate(input: {
  templateId: string;
  siteId: string;
  title?: string | null;
  plannedDate?: Date | null;
  subjectWorkstationId?: string | null;
  subjectOrgUnitId?: string | null;
  teamUserIds?: string[];
}): Promise<{ id: string }> {
  const [site, template] = await Promise.all([
    prisma.site.findUnique({
      where: { id: input.siteId },
      select: { id: true, companyId: true },
    }),
    prisma.inspectionTemplate.findUnique({
      where: { id: input.templateId },
      include: {
        sections: {
          orderBy: { order: "asc" },
          include: { questions: { orderBy: { order: "asc" } } },
        },
      },
    }),
  ]);
  if (!site) throw new Error("Site not found");
  if (!template) throw new Error("Template not found");
  // Template must be reachable from this site: system (companyId null) or the
  // site's own company, and either company-wide (siteId null) or this site.
  if (template.companyId !== null && template.companyId !== site.companyId) {
    throw new Error("Template belongs to another company");
  }
  if (template.siteId !== null && template.siteId !== input.siteId) {
    throw new Error("Template belongs to another site");
  }

  return prisma.$transaction(async (tx) => {
    const inspection = await tx.inspection.create({
      data: {
        siteId: input.siteId,
        templateId: template.id,
        templateVersion: template.version,
        title: input.title?.trim() || template.title,
        type: template.type,
        domain: template.domain,
        status: "PLANNED",
        plannedDate: input.plannedDate ?? null,
        subjectWorkstationId: input.subjectWorkstationId ?? null,
        subjectOrgUnitId: input.subjectOrgUnitId ?? null,
      },
    });
    for (const section of template.sections) {
      for (const q of section.questions) {
        await tx.inspectionAnswer.create({
          data: {
            inspectionId: inspection.id,
            questionId: q.id,
            sectionTitle: section.title,
            prompt: q.prompt,
            answerType: q.answerType,
            required: q.required,
            order: q.order,
            legalReferenceCode: q.legalReferenceCode,
            unit: q.unit,
            choiceOptions: q.choiceOptions,
          },
        });
      }
    }
    for (const userId of new Set(input.teamUserIds ?? [])) {
      await tx.inspectionTeamMember.create({
        data: { inspectionId: inspection.id, platformUserId: userId },
      });
    }
    return { id: inspection.id };
  });
}

async function transition(
  inspectionId: string,
  siteId: string,
  to: InspectionStatus,
): Promise<void> {
  const inspection = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    select: { siteId: true, status: true },
  });
  if (!inspection || inspection.siteId !== siteId) {
    throw new Error("Inspection not found");
  }
  if (!TRANSITIONS[inspection.status].includes(to)) {
    throw new Error(`Illegal transition ${inspection.status} -> ${to}`);
  }
  await prisma.inspection.update({
    where: { id: inspectionId },
    data: { status: to },
  });
}

export async function startInspection(
  inspectionId: string,
  siteId: string,
): Promise<void> {
  await transition(inspectionId, siteId, "IN_PROGRESS");
}

export async function reopenInspection(
  inspectionId: string,
  siteId: string,
): Promise<void> {
  await transition(inspectionId, siteId, "IN_PROGRESS");
}

export async function closeInspection(
  inspectionId: string,
  siteId: string,
): Promise<void> {
  await transition(inspectionId, siteId, "CLOSED");
}

// Record (or clear) one answer. answeredAt is stamped only when the value is
// actually present for its type (shape checked via the pure helper).
export async function recordInspectionAnswer(input: {
  answerId: string;
  siteId: string;
  valueYesNoNa?: YesNoNa | null;
  valueNumber?: number | null;
  valueText?: string | null;
  valueChoice?: string | null;
  documentId?: string | null;
}): Promise<void> {
  const answer = await prisma.inspectionAnswer.findUnique({
    where: { id: input.answerId },
    include: { inspection: { select: { siteId: true, status: true } } },
  });
  if (!answer || answer.inspection.siteId !== input.siteId) {
    throw new Error("Answer not found");
  }
  if (answer.inspection.status === "CLOSED") {
    throw new Error("Inspection is closed");
  }
  const next: AnswerShape = {
    answerType: answer.answerType,
    required: answer.required,
    valueYesNoNa: input.valueYesNoNa ?? null,
    valueNumber: input.valueNumber ?? null,
    valueText: input.valueText ?? null,
    valueChoice: input.valueChoice ?? null,
    documentId: input.documentId ?? null,
  };
  await prisma.inspectionAnswer.update({
    where: { id: input.answerId },
    data: {
      valueYesNoNa: next.valueYesNoNa,
      valueNumber: next.valueNumber,
      valueText: next.valueText,
      valueChoice: next.valueChoice,
      documentId: next.documentId,
      answeredAt: isAnswerAnswered(next) ? new Date() : null,
    },
  });
}

// Complete only when every required question is answered — fail-closed, never
// inferred. Stamps the performer + date.
export async function completeInspection(
  inspectionId: string,
  siteId: string,
  performedByUserId: string,
): Promise<void> {
  const inspection = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    select: {
      siteId: true,
      status: true,
      answers: {
        select: {
          answerType: true,
          required: true,
          valueYesNoNa: true,
          valueNumber: true,
          valueText: true,
          valueChoice: true,
          documentId: true,
        },
      },
    },
  });
  if (!inspection || inspection.siteId !== siteId) {
    throw new Error("Inspection not found");
  }
  if (!TRANSITIONS[inspection.status].includes("COMPLETED")) {
    throw new Error(`Illegal transition ${inspection.status} -> COMPLETED`);
  }
  const incomplete = inspection.answers.some(
    (a) => a.required && !isAnswerAnswered(a),
  );
  if (incomplete) {
    throw new Error("All required questions must be answered");
  }
  await prisma.inspection.update({
    where: { id: inspectionId },
    data: {
      status: "COMPLETED",
      performedDate: new Date(),
      performedByUserId,
    },
  });
}

export async function addInspectionObservation(input: {
  inspectionId: string;
  siteId: string;
  description: string;
  severity?: RiskBand | null;
  answerId?: string | null;
}): Promise<{ id: string }> {
  const inspection = await prisma.inspection.findUnique({
    where: { id: input.inspectionId },
    select: { siteId: true },
  });
  if (!inspection || inspection.siteId !== input.siteId) {
    throw new Error("Inspection not found");
  }
  if (input.description.trim().length === 0) {
    throw new Error("Observation description is required");
  }
  const obs = await prisma.inspectionObservation.create({
    data: {
      inspectionId: input.inspectionId,
      answerId: input.answerId ?? null,
      description: input.description.trim(),
      severity: input.severity ?? null,
    },
  });
  return { id: obs.id };
}

// Promote an observation to an Action — the one action engine (§2.2):
// inspectionObservationId is the Action's single source.
export async function promoteObservationToAction(input: {
  observationId: string;
  siteId: string;
  title: string;
  description?: string | null;
  responsibleUserId?: string | null;
  responsibleRoleLabel?: string | null;
  dueDate?: Date | null;
}): Promise<{ id: string }> {
  const obs = await prisma.inspectionObservation.findUnique({
    where: { id: input.observationId },
    include: { inspection: { select: { siteId: true } } },
  });
  if (!obs || obs.inspection.siteId !== input.siteId) {
    throw new Error("Observation not found");
  }
  if (input.title.trim().length === 0) {
    throw new Error("Action title is required");
  }
  const action = await prisma.action.create({
    data: {
      siteId: input.siteId,
      inspectionObservationId: obs.id,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      responsibleUserId: input.responsibleUserId ?? null,
      responsibleRoleLabel: input.responsibleRoleLabel?.trim() || null,
      dueDate: input.dueDate ?? null,
    },
  });
  return { id: action.id };
}
