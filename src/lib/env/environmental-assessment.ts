import type { EnvironmentalAssessmentModel } from "@/generated/prisma/models";
import { prisma } from "@/lib/prisma";
import { getActiveRiskMatrixVersion } from "@/lib/risk/matrix-version";
import { initialCategoryCheckRows } from "./environmental-category-check";

// The single gate for creating an EnvironmentalAssessment — the
// environmental counterpart of createRiskAssessment (option b: a separate
// model, RiskFinding untouched). matrixVersion is never accepted as input;
// it is always resolved from the active RiskMatrixVersion, reusing the same
// 5×5 matrix for significance with environment-specific axis labels applied
// in the UI (§5.2). No `import "server-only"` — directly unit-testable, same
// as createRiskAssessment.

export type CreateEnvironmentalAssessmentInput = {
  siteId: string;
  // Optional: a site-level assessment (boiler house, wastewater plant) is the
  // common case (§5.2), so there is no exactly-one-subject constraint.
  workstationId?: string | null;
  assessorUserId: string;
  assessedAt: Date;
  pilotContext?: string | null;
  notes?: string | null;
  // AWG 2002 §10 Abs. 3 Z5 ("estimate of future development"), rendered as
  // the AWK's item-5 section (E4).
  futureDevelopment?: string | null;
};

export async function createEnvironmentalAssessment(
  input: CreateEnvironmentalAssessmentInput,
): Promise<EnvironmentalAssessmentModel> {
  const matrixVersion = await getActiveRiskMatrixVersion();

  // One transaction: the assessment and its 14 OPEN completeness rows are
  // created together, so an environmental assessment can never exist without
  // its full EnvironmentalCategoryCheck set (§5.2 — created explicitly,
  // never inferred at read time).
  return prisma.$transaction(async (tx) => {
    const assessment = await tx.environmentalAssessment.create({
      data: {
        siteId: input.siteId,
        workstationId: input.workstationId ?? null,
        matrixVersion,
        assessorUserId: input.assessorUserId,
        assessedAt: input.assessedAt,
        pilotContext: input.pilotContext ?? null,
        notes: input.notes ?? null,
        futureDevelopment: input.futureDevelopment ?? null,
      },
    });

    await tx.environmentalCategoryCheck.createMany({
      data: initialCategoryCheckRows(assessment.id),
    });

    return assessment;
  });
}
