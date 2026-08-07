export type AngleRangeRule = {
  angleMin: number | null;
  angleMax: number | null;
};

// Pure range-matching core — exported so it can be unit tested directly
// against fixture rows, with no DB involved. Kept in its own file, free of
// any server-only import (prisma, "server-only"), so it can also run
// client-side (e.g. a what-if simulator re-scoring slider-adjusted angles
// with zero server round-trips).
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
