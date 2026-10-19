import type {
  EnvironmentalAspectCategory,
  OperatingCondition,
  RiskBand,
} from "@/generated/prisma/enums";
import type { EnvironmentalFindingModel } from "@/generated/prisma/models";
import { prisma } from "@/lib/prisma";
import { markCategoryAspectPresent } from "./environmental-category-check";
import { computeEnvironmentalSignificance } from "./significance";

// Record a human NOT_APPLICABLE / CHECKED_NO_HAZARD status on an
// environmental category check — the env analogue of setHazardCategoryStatus
// (src/lib/risk/finding.ts). Both require a rationale; neither may relabel a
// category that already has a finding (that would contradict the finding).
export class CategoryStatusConflictError extends Error {
  constructor(readonly category: EnvironmentalAspectCategory) {
    super(
      `Category ${category} already has a finding, so it can't be marked not-applicable or checked-no-hazard`,
    );
    this.name = "CategoryStatusConflictError";
  }
}

export async function setEnvironmentalCategoryStatus(input: {
  environmentalAssessmentId: string;
  category: EnvironmentalAspectCategory;
  status: "NOT_APPLICABLE" | "CHECKED_NO_HAZARD";
  rationale: string;
  checkedByUserId: string;
}): Promise<void> {
  if (input.rationale.trim().length === 0) {
    throw new Error("A rationale is required for this status");
  }

  const findingCount = await prisma.environmentalFinding.count({
    where: {
      environmentalAssessmentId: input.environmentalAssessmentId,
      aspect: { category: input.category },
    },
  });
  if (findingCount > 0) {
    throw new CategoryStatusConflictError(input.category);
  }

  await prisma.environmentalCategoryCheck.updateMany({
    where: {
      environmentalAssessmentId: input.environmentalAssessmentId,
      category: input.category,
    },
    data: {
      status: input.status,
      rationale: input.rationale.trim(),
      checkedByUserId: input.checkedByUserId,
      checkedAt: new Date(),
    },
  });
}

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
