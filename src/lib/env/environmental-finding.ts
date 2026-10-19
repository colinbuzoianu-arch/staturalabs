import type {
  EnvironmentalAspectCategory,
  OperatingCondition,
  RiskBand,
} from "@/generated/prisma/enums";
import type { EnvironmentalFindingModel } from "@/generated/prisma/models";
import { prisma } from "@/lib/prisma";
import { markCategoryAspectPresent } from "./environmental-category-check";
import { computeEnvironmentalSignificance } from "./significance";

// The single write path for an EnvironmentalFinding (the environmental
// counterpart of createFinding). Creates the finding — with `significant`
// computed and stored at write time (computeEnvironmentalSignificance) — and
// flips its aspect category's completeness check to HAZARD_PRESENT, in one
// transaction, so the HAZARD_PRESENT <-> finding invariant holds. riskScore/
// riskBand come in already resolved (the caller looks them up via
// lookupRiskMatrixCell, same as the OSH finding path). No `import
// "server-only"` — unit-testable via a mocked prisma, same as createFinding.

export type CreateEnvironmentalFindingInput = {
  environmentalAssessmentId: string;
  environmentalAspectId: string;
  // The aspect's category, passed in (the caller already fetched the aspect
  // to resolve this) so the category-check flip needs no extra lookup.
  category: EnvironmentalAspectCategory;
  probability: number;
  severity: number;
  riskScore: number;
  riskBand: RiskBand;
  operatingCondition: OperatingCondition;
  legallyRelevant: boolean;
  existingControls?: string | null;
  notes?: string | null;
};

export async function createEnvironmentalFinding(
  input: CreateEnvironmentalFindingInput,
): Promise<EnvironmentalFindingModel> {
  const significant = computeEnvironmentalSignificance({
    riskBand: input.riskBand,
    legallyRelevant: input.legallyRelevant,
  });

  return prisma.$transaction(async (tx) => {
    const finding = await tx.environmentalFinding.create({
      data: {
        environmentalAssessmentId: input.environmentalAssessmentId,
        environmentalAspectId: input.environmentalAspectId,
        probability: input.probability,
        severity: input.severity,
        riskScore: input.riskScore,
        riskBand: input.riskBand,
        operatingCondition: input.operatingCondition,
        legallyRelevant: input.legallyRelevant,
        significant,
        existingControls: input.existingControls ?? null,
        notes: input.notes ?? null,
      },
    });

    await markCategoryAspectPresent(
      tx,
      input.environmentalAssessmentId,
      input.category,
    );

    return finding;
  });
}
