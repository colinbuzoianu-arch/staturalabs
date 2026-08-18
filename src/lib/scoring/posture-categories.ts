import type { BodyRegion, RiskBand } from "@/generated/prisma/enums";

// Mirrors GET /api/scoring-rules's response shape exactly (field names
// match ScoringRule's own columns), same convention capture/page.tsx's
// own local ScoringRulePreviewRow type already established — a fetched
// row satisfies this with no mapping step, and this stays free of any
// Prisma/server-only dependency so it's usable from a client component.
export type ScoringRuleRow = {
  bodyRegion: BodyRegion;
  angleMin: number | null;
  angleMax: number | null;
  riskBand: RiskBand;
  riskScore: number;
};

export type PostureCategory = {
  /** [min, max) — either bound null means unbounded on that side, same convention as ScoringRule/matchScoringRule. */
  ruleRange: [number | null, number | null];
  band: RiskBand;
  riskScore: number;
  /**
   * A category marker, never presented as a measurement (SLD_IMPLEMENTATION
   * _PLAN_posture-input.md §3.1/§3.2, ERGO_COMPLIANCE_BY_DESIGN.md §3.16's
   * provenance discipline) — this is what gets persisted as the region's
   * `manualAngles` value in category-entry mode and what hold time and
   * every downstream sub-score consumer sees, so it must land inside the
   * category's own range (matchScoringRule re-matching it must return this
   * exact rule) and never on a boundary shared with a neighboring category.
   */
  representativeDegrees: number;
};

// The midpoint of a closed range; for an open-ended range, 15° past the one
// bound that exists (min+15 for an open max, max-15 for an open min — the
// plan's own spec only states the open-max case explicitly, this extends
// the same rule symmetrically to NECK's/WRIST's/ELBOW's open-min rows,
// which the seeded v2 data genuinely has). A row with neither bound (both
// null) isn't produced by any seeded region today; 0° (neutral) is the
// least-wrong fallback rather than throwing on a shape nothing currently
// creates.
function representativeDegreesFor(
  min: number | null,
  max: number | null,
): number {
  if (min === null && max === null) return 0;
  if (min === null) return (max as number) - 15;
  if (max === null) return min + 15;
  return (min + max) / 2;
}

// Pure — no DB, no Prisma. Groups the active methodology's ScoringRule
// rows for one region into the category list a picker renders, sorted by
// range (ascending angleMin, open-ended-low first) so NECK's backward-
// extension categories come before its forward-flexion ones and a picker
// built by iterating this array in order reads as a single continuum, not
// an arbitrarily-ordered set. One category per rule row — category COUNT
// and boundaries come entirely from the data (SHOULDER's 4 tiers, NECK's
// 6 signed tiers, everyone else's 3 or 2), never hardcoded here.
//
// `rules` is the full fetched set (e.g. GET /api/scoring-rules' response,
// unfiltered) — this does the per-region filter itself so every call site
// doesn't have to.
export function derivePostureCategories(
  rules: readonly ScoringRuleRow[],
  region: BodyRegion,
): PostureCategory[] {
  const regionRules = rules.filter((rule) => rule.bodyRegion === region);
  const sorted = [...regionRules].sort(
    (a, b) =>
      (a.angleMin ?? Number.NEGATIVE_INFINITY) -
      (b.angleMin ?? Number.NEGATIVE_INFINITY),
  );
  return sorted.map((rule) => ({
    ruleRange: [rule.angleMin, rule.angleMax],
    band: rule.riskBand,
    riskScore: rule.riskScore,
    representativeDegrees: representativeDegreesFor(
      rule.angleMin,
      rule.angleMax,
    ),
  }));
}

// Formats a category's range for a picker option label ("0–20°",
// "<20°", "≥90°") — plain numbers and universal ≥/< symbols, no locale
// dependency, so this is not an i18n dictionary entry anywhere (unlike
// the category *names*, which are hand-authored per-locale copy).
export function formatCategoryRange(
  range: [number | null, number | null],
): string {
  const [min, max] = range;
  if (min === null && max === null) return "—";
  if (min === null) return `<${max}°`;
  if (max === null) return `≥${min}°`;
  return `${min}–${max}°`;
}
