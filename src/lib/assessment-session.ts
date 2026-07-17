import { AssessmentMode } from "@/generated/prisma/enums";
import type { AssessmentSessionModel } from "@/generated/prisma/models";
import { prisma } from "@/lib/prisma";

// Deliberately no `import "server-only"` here (unlike most of src/lib) —
// this file needs to be directly unit-testable (see
// assessment-session.test.ts), and that package throws on import outside
// a "react-server" module-resolution condition, which Vitest doesn't set.
// Same reasoning as src/lib/scoring/lookup.ts.

export type CreateAssessmentSessionInput = {
  workstationId: string;
  startedAt: Date;
  endedAt?: Date | null;
  notes?: string | null;
  mode?: AssessmentMode;
  // Internal-only audit-trail annotation (§3.6) — see the schema.prisma
  // doc comment on AssessmentSession.pilotContext. Never surfaced in the
  // customer-facing dashboard.
  pilotContext?: string | null;
};

// The single gate for creating an AssessmentSession. CONTINUOUS is a real
// AssessmentMode value (mandate 3.11, ERGO_COMPLIANCE_BY_DESIGN.md) — the
// schema is ready for it — but nothing else is: no feature flag, no
// documented worker-rep consent artifact per deployment, no implementation
// at all. Every future code path that creates a session (there is none
// yet beyond this function) is expected to call through here, so that
// boundary lives in exactly one place instead of being re-derived per
// caller. Do not remove this check just because a caller "obviously" only
// ever passes SCHEDULED — the point is that nothing can create a
// CONTINUOUS session by accident or by a future caller assuming the enum
// value being present means the feature is built.
export async function createAssessmentSession(
  input: CreateAssessmentSessionInput,
): Promise<AssessmentSessionModel> {
  const mode = input.mode ?? AssessmentMode.SCHEDULED;

  if (mode === AssessmentMode.CONTINUOUS) {
    throw new Error(
      "CONTINUOUS assessment sessions are not yet implemented — see " +
        "ERGO_COMPLIANCE_BY_DESIGN.md §3.11/§5. Only SCHEDULED sessions " +
        "can be created today.",
    );
  }

  return prisma.assessmentSession.create({
    data: {
      workstationId: input.workstationId,
      mode,
      pilotContext: input.pilotContext ?? null,
      startedAt: input.startedAt,
      endedAt: input.endedAt ?? null,
      notes: input.notes ?? null,
    },
  });
}
