import type { RiskAssessmentModel } from "@/generated/prisma/models";
import { prisma } from "@/lib/prisma";
import { getActiveRiskMatrixVersion } from "./matrix-version";

// Deliberately no `import "server-only"` here — needs to be directly
// unit-testable via a mocked `@/lib/prisma`, same reasoning as
// assessment-session.ts.

// Pure core — exported for direct unit testing, no DB involved. A
// RiskAssessment is of a workstation *or* a process, never both, never
// neither — this mirrors the hand-added
// RiskAssessment_exactly_one_subject_check CHECK constraint at the
// application layer, so a caller gets a clear message before ever
// reaching the DB (the CHECK is still the actual guarantee; this is
// fail-fast, not a replacement for it).
export function validateExactlyOneSubject(
  workstationId: string | null,
  processId: string | null,
): void {
  const hasWorkstation = workstationId !== null;
  const hasProcess = processId !== null;

  if (hasWorkstation === hasProcess) {
    throw new Error(
      hasWorkstation
        ? "RiskAssessment requires exactly one of workstationId or processId — both were provided"
        : "RiskAssessment requires exactly one of workstationId or processId — neither was provided",
    );
  }
}

export type CreateRiskAssessmentInput = {
  siteId: string;
  workstationId?: string | null;
  processId?: string | null;
  assessorUserId: string;
  assessedAt: Date;
  // Internal-only audit-trail annotation (§3.6), mirrors
  // AssessmentSession.pilotContext — see assessment-session.ts.
  pilotContext?: string | null;
  notes?: string | null;
};

// The single gate for creating a RiskAssessment. matrixVersion is never
// accepted as an input — it is always resolved from the active
// RiskMatrixVersion row, so nothing can pin a new assessment to a stale or
// arbitrary matrix version (ERGO_COMPLIANCE_BY_DESIGN.md §3.14).
export async function createRiskAssessment(
  input: CreateRiskAssessmentInput,
): Promise<RiskAssessmentModel> {
  const workstationId = input.workstationId ?? null;
  const processId = input.processId ?? null;

  validateExactlyOneSubject(workstationId, processId);

  const matrixVersion = await getActiveRiskMatrixVersion();

  return prisma.riskAssessment.create({
    data: {
      siteId: input.siteId,
      workstationId,
      processId,
      matrixVersion,
      assessorUserId: input.assessorUserId,
      assessedAt: input.assessedAt,
      pilotContext: input.pilotContext ?? null,
      notes: input.notes ?? null,
    },
  });
}
