import type {
  HazardCategory,
  PsychosocialDimension,
  PsychosocialMethod,
  RiskBand,
} from "@/generated/prisma/enums";
import type { RiskFindingModel } from "@/generated/prisma/models";
import { prisma } from "@/lib/prisma";
import { markCategoryHazardPresent } from "./category-check";
import { createPsychosocialFinding } from "./psychosocial-finding";

// The single write path for adding a RiskFinding to an assessment, shared by
// the workstation hub ((app)/workstations/[workstationId]) and the admin
// review/approval detail page
// (SLD_IMPLEMENTATION_PLAN_hazards-and-environment.md §3.3: "Both pages call
// the same server actions ... Don't build a second write path that
// drifts."). No `import "server-only"` — directly unit-testable, same as the
// other src/lib/risk gates.
//
// Input is already parsed and matrix-resolved by the calling Server Action
// (formData parsing and i18n error messages are inherently page-specific);
// this owns the DB side: create the finding (plus psychosocial detail when
// the category is PSYCHOSOCIAL) and flip the category's completeness check to
// HAZARD_PRESENT, so the HAZARD_PRESENT <-> finding invariant (§3.1) holds
// no matter which page added the finding.

export type CreateFindingInput = {
  riskAssessmentId: string;
  hazardId: string;
  // Passed in rather than re-fetched: the caller already looked the hazard up
  // to resolve the matrix cell and to decide whether the psychosocial fields
  // were required.
  category: HazardCategory;
  probability: number;
  severity: number;
  riskScore: number;
  riskBand: RiskBand;
  existingControls?: string | null;
  notes?: string | null;
  // Required iff category === PSYCHOSOCIAL; ignored otherwise.
  dimension?: PsychosocialDimension | null;
  method?: PsychosocialMethod | null;
  groupSize?: number | null;
  externalProcedureName?: string | null;
};

export async function createFinding(
  input: CreateFindingInput,
): Promise<RiskFindingModel> {
  if (input.category === "PSYCHOSOCIAL") {
    if (
      !input.dimension ||
      !input.method ||
      input.groupSize === null ||
      input.groupSize === undefined
    ) {
      throw new Error(
        "Psychosocial findings require a dimension, method, and group size",
      );
    }
    // createPsychosocialFinding owns its own finding+detail transaction and
    // the group-size validation (kept untouched/tested); the category flip
    // follows it, same shape the admin page used before this was
    // centralised.
    const finding = await createPsychosocialFinding({
      riskAssessmentId: input.riskAssessmentId,
      hazardId: input.hazardId,
      probability: input.probability,
      severity: input.severity,
      riskScore: input.riskScore,
      riskBand: input.riskBand,
      existingControls: input.existingControls ?? null,
      notes: input.notes ?? null,
      dimension: input.dimension,
      method: input.method,
      groupSize: input.groupSize,
      externalProcedureName: input.externalProcedureName ?? null,
    });
    await markCategoryHazardPresent(
      prisma,
      input.riskAssessmentId,
      "PSYCHOSOCIAL",
    );
    return finding;
  }

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
    await markCategoryHazardPresent(tx, input.riskAssessmentId, input.category);
    return finding;
  });
}

// Record a human NOT_APPLICABLE / CHECKED_NO_HAZARD status on a category's
// completeness check (§3.1/§3.3). These are the two statuses a human sets
// directly (HAZARD_PRESENT is only ever reached via createFinding, OPEN only
// via assessment creation) — both require a rationale (enforced here, in the
// app layer, and by the hand-added HazardCategoryCheck_rationale_check).
//
// Fail-closed guard: a category that already has a finding is HAZARD_PRESENT
// and cannot be relabelled "not applicable"/"no hazard" — that would be a
// claim contradicted by the finding itself (the inverse of the
// inconsistency canSubmitForReview rejects). Findings are append-only, so a
// human must resolve the contradiction at the finding level, not by
// overwriting the category status.
export class CategoryStatusConflictError extends Error {
  constructor(readonly category: HazardCategory) {
    super(
      `Category ${category} has at least one finding, so it can't be marked not-applicable or checked-no-hazard`,
    );
    this.name = "CategoryStatusConflictError";
  }
}

export async function setHazardCategoryStatus(input: {
  riskAssessmentId: string;
  category: HazardCategory;
  status: "NOT_APPLICABLE" | "CHECKED_NO_HAZARD";
  rationale: string;
  checkedByUserId: string;
}): Promise<void> {
  if (input.rationale.trim().length === 0) {
    throw new Error("A rationale is required for this status");
  }

  const findingCount = await prisma.riskFinding.count({
    where: {
      riskAssessmentId: input.riskAssessmentId,
      hazard: { category: input.category },
    },
  });
  if (findingCount > 0) {
    throw new CategoryStatusConflictError(input.category);
  }

  await prisma.hazardCategoryCheck.updateMany({
    where: {
      riskAssessmentId: input.riskAssessmentId,
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
