import "server-only";

import type {
  InspectionAnswerType,
  InspectionDomain,
  InspectionType,
} from "@/generated/prisma/enums";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { prisma } from "@/lib/prisma";

// Company-scoped inspection-template authoring (P9 follow-up: creating/editing
// company templates). System templates (companyId null, isSystem true) are
// read-only here and can never be edited through these gates. All mutations
// are audited.

export async function createInspectionTemplate(input: {
  companyId: string;
  siteId?: string | null;
  type: InspectionType;
  domain: InspectionDomain;
  title: string;
  description?: string | null;
  actorUserId: string;
}) {
  if (input.title.trim().length === 0) throw new Error("Title is required");
  const template = await prisma.inspectionTemplate.create({
    data: {
      companyId: input.companyId,
      siteId: input.siteId ?? null,
      type: input.type,
      domain: input.domain,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      isSystem: false,
      isActive: true,
    },
  });
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "inspection-template.create",
    entityType: "InspectionTemplate",
    entityId: template.id,
    companyId: input.companyId,
  });
  return template;
}

export async function addTemplateSection(input: {
  templateId: string;
  companyId: string;
  title: string;
  actorUserId: string;
}) {
  if (input.title.trim().length === 0) throw new Error("Title is required");
  const tpl = await prisma.inspectionTemplate.findUnique({
    where: { id: input.templateId },
    select: {
      companyId: true,
      isSystem: true,
      _count: { select: { sections: true } },
    },
  });
  if (!tpl || tpl.companyId !== input.companyId || tpl.isSystem) {
    throw new Error("Template not editable");
  }
  const section = await prisma.inspectionTemplateSection.create({
    data: {
      templateId: input.templateId,
      title: input.title.trim(),
      order: tpl._count.sections,
    },
  });
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "inspection-template.add-section",
    entityType: "InspectionTemplateSection",
    entityId: section.id,
    companyId: input.companyId,
  });
  return section;
}

export async function addTemplateQuestion(input: {
  sectionId: string;
  companyId: string;
  prompt: string;
  answerType: InspectionAnswerType;
  required: boolean;
  actorUserId: string;
}) {
  if (input.prompt.trim().length === 0) throw new Error("Prompt is required");
  const section = await prisma.inspectionTemplateSection.findUnique({
    where: { id: input.sectionId },
    select: {
      template: { select: { companyId: true, isSystem: true } },
      _count: { select: { questions: true } },
    },
  });
  if (
    !section ||
    section.template.companyId !== input.companyId ||
    section.template.isSystem
  ) {
    throw new Error("Section not editable");
  }
  const question = await prisma.inspectionTemplateQuestion.create({
    data: {
      sectionId: input.sectionId,
      prompt: input.prompt.trim(),
      answerType: input.answerType,
      required: input.required,
      order: section._count.questions,
    },
  });
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "inspection-template.add-question",
    entityType: "InspectionTemplateQuestion",
    entityId: question.id,
    companyId: input.companyId,
  });
  return question;
}
