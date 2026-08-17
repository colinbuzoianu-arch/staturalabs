import type {
  PsychosocialDimension,
  PsychosocialMethod,
  RiskBand,
} from "@/generated/prisma/enums";
import type { RiskFindingModel } from "@/generated/prisma/models";
import { prisma } from "@/lib/prisma";

// Deliberately no `import "server-only"` here — needs to be directly
// unit-testable via a mocked `@/lib/prisma`, same reasoning as
// assessment-session.ts/action.ts.

const MIN_QUESTIONNAIRE_GROUP_SIZE = 15;

// Pure core — exported for direct unit testing, no DB involved. Mirrors
// the hand-added PsychosocialFindingDetail_group_size_check CHECK
// constraint at the application layer (fail-fast with a clear message;
// the CHECK is still the actual guarantee, not replaced by this).
//
// The floor is conditional, not blanket: SLD_IMPLEMENTATION_PLAN_austria-
// first.md §7 B7 / ERGO_COMPLIANCE_BY_DESIGN.md §5's locked decision —
// QUESTIONNAIRE instruments specifically are unsuitable below 15
// employees because anonymity can't be preserved at that scale; smaller
// operations use GROUP_DISCUSSION/OBSERVATION/INTERVIEW instead, which
// are legal at any group size ≥ 1.
export function validatePsychosocialGroupSize(
  method: PsychosocialMethod,
  groupSize: number,
): void {
  if (!Number.isInteger(groupSize) || groupSize < 1) {
    throw new Error("Group size must be a positive whole number");
  }
  if (method === "QUESTIONNAIRE" && groupSize < MIN_QUESTIONNAIRE_GROUP_SIZE) {
    throw new Error(
      `Questionnaire-based psychosocial assessments require a group size of at least ${MIN_QUESTIONNAIRE_GROUP_SIZE} ` +
        "(WKO/Arbeitsinspektion guidance — anonymity can't be preserved below that scale); " +
        "use group discussion, observation, or interview for smaller groups instead",
    );
  }
}

export type CreatePsychosocialFindingInput = {
  riskAssessmentId: string;
  hazardId: string;
  probability: number;
  severity: number;
  riskScore: number;
  riskBand: RiskBand;
  existingControls?: string | null;
  notes?: string | null;
  dimension: PsychosocialDimension;
  method: PsychosocialMethod;
  groupSize: number;
  externalProcedureName?: string | null;
};

// The single gate for creating a PSYCHOSOCIAL-category RiskFinding with
// its structured detail — "structured findings, not a survey platform"
// (§7 B7). riskScore/riskBand are accepted as already-resolved inputs
// (the caller looks them up via lookupRiskMatrixCell, same as the plain
// addFindingAction path) rather than re-derived here, so this stays a
// thin creation gate, not a second place that re-implements matrix
// lookup. Creates RiskFinding and PsychosocialFindingDetail in one
// transaction — a failed group-size validation must never leave an
// orphan RiskFinding with no detail behind.
export async function createPsychosocialFinding(
  input: CreatePsychosocialFindingInput,
): Promise<RiskFindingModel> {
  validatePsychosocialGroupSize(input.method, input.groupSize);

  return prisma.$transaction(async (tx) => {
    const finding = await tx.riskFinding.create({
      data: {
        riskAssessmentId: input.riskAssessmentId,
        hazardId: input.hazardId,
        probability: input.probability,
        severity: input.severity,
        riskScore: input.riskScore,
        riskBand: input.riskBand,
        existingControls: input.existingControls ?? null,
        notes: input.notes ?? null,
      },
    });

    await tx.psychosocialFindingDetail.create({
      data: {
        riskFindingId: finding.id,
        dimension: input.dimension,
        method: input.method,
        groupSize: input.groupSize,
        externalProcedureName: input.externalProcedureName ?? null,
      },
    });

    return finding;
  });
}
