import type { BodyRegion } from "@/generated/prisma/enums";
import type { ScoringRuleModel } from "@/generated/prisma/models";
import { prisma } from "@/lib/prisma";

type AngleRangeRule = {
  angleMin: number | null;
  angleMax: number | null;
};

// Pure range-matching core — exported so it can be unit tested directly
// against fixture rows, with no DB involved.
//
// Deliberately a real per-row range check over every candidate, not a
// threshold cascade (`if angle > x return HIGH else if angle > y ...`).
// Some rule sets are non-monotonic — ELBOW_LEFT/RIGHT is HIGH below 20°,
// LOW 20–100°, HIGH again above 100° — and a cascade evaluated in one
// direction can't express "high at both ends, low in the middle" correctly.
//
// Convention: angleMin is inclusive, angleMax is exclusive
// ([angleMin, angleMax)); a null bound means unbounded on that side.
export function matchScoringRule<T extends AngleRangeRule>(
  rules: T[],
  angleDegrees: number,
): T | null {
  const matches = rules.filter((rule) => {
    const min = rule.angleMin ?? Number.NEGATIVE_INFINITY;
    const max = rule.angleMax ?? Number.POSITIVE_INFINITY;
    return angleDegrees >= min && angleDegrees < max;
  });

  // More than one candidate rule covering the same angle is a data problem
  // in the rule set (overlapping ranges), not a matching-logic problem —
  // surface it loudly rather than silently picking one.
  if (matches.length > 1) {
    throw new Error(
      `Ambiguous ScoringRule match: angle ${angleDegrees} matched ${matches.length} rules (expected at most 1)`,
    );
  }

  return matches[0] ?? null;
}

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
