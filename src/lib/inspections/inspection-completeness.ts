import type { InspectionAnswerType, YesNoNa } from "@/generated/prisma/enums";

// P9 (SLD_RESTRUCTURE_PLAN_platform-modules.md §7.3) inspection completeness
// core (pure). An inspection can only be COMPLETED when every REQUIRED question
// has a value — the same "completeness is never inferred" discipline the
// workstation hub (H1) and environmental assessments use. No DB; unit-tested.

export type AnswerShape = {
  answerType: InspectionAnswerType;
  required: boolean;
  valueYesNoNa: YesNoNa | null;
  valueNumber: number | null;
  valueText: string | null;
  valueChoice: string | null;
  documentId: string | null;
};

// Is this answer filled in for its type? Exactly one value column is meaningful
// per answerType; the others are ignored.
export function isAnswerAnswered(a: AnswerShape): boolean {
  switch (a.answerType) {
    case "YES_NO_NA":
      return a.valueYesNoNa !== null;
    case "SCALE":
    case "NUMBER":
      return a.valueNumber !== null;
    case "TEXT":
      return a.valueText !== null && a.valueText.trim().length > 0;
    case "CHOICE":
      return a.valueChoice !== null && a.valueChoice.length > 0;
    case "FILE":
      return a.documentId !== null && a.documentId.length > 0;
    default:
      return false;
  }
}

// Every required answer must be answered. Optional questions never block.
export function canCompleteInspection(
  answers: readonly AnswerShape[],
): boolean {
  return answers.every((a) => !a.required || isAnswerAnswered(a));
}

// How many required questions are still unanswered — for the progress UI.
export function unansweredRequiredCount(
  answers: readonly AnswerShape[],
): number {
  return answers.filter((a) => a.required && !isAnswerAnswered(a)).length;
}
