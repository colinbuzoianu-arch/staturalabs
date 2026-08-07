import type { BodyRegion } from "@/generated/prisma/enums";
import type { ScoringRuleModel } from "@/generated/prisma/models";
import { prisma } from "@/lib/prisma";
import { matchScoringRule } from "./match";

export type { AngleRangeRule } from "./match";
// Re-exported so existing server-side callers importing from "./lookup"
// are unaffected — the pure matcher itself now lives in ./match, which has
// no server-only dependency (see that file's comment for why).
export { matchScoringRule } from "./match";

// Given (bodyRegion, angleDegrees, methodologyVersion), returns the
// matching ScoringRule row, or null if none matches. A null result is a
// data problem to surface (unrecognized/unsupported body region for this
// methodology version, or an angle outside every seeded range) — callers
// must not substitute a default risk band for it.
//
// Takes a plain angle in degrees, already in flexion-from-neutral
// convention (see CLAUDE.md "Scoring methodology") — there is no
// angle-capture/CV code yet, so converting a raw pose-landmark angle into
// that convention is entirely the caller's responsibility.
export async function lookupScoringRule(params: {
  bodyRegion: BodyRegion;
  angleDegrees: number;
  methodologyVersion: string;
}): Promise<ScoringRuleModel | null> {
  const candidates = await prisma.scoringRule.findMany({
    where: {
      bodyRegion: params.bodyRegion,
      methodologyVersion: params.methodologyVersion,
    },
  });

  return matchScoringRule(candidates, params.angleDegrees);
}
