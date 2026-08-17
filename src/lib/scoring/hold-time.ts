import type { RiskBand } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export type HoldTimeRuleRow = {
  postureRiskBand: RiskBand;
  maxHoldSeconds: number | null;
};

// A small, LOCAL severity ordering — deliberately NOT
// src/lib/risk/band-severity.ts's worstRiskBand/riskBandRank, which that
// module's own comments declare display/sort-only ("this ranking never
// feeds a scoring or matrix lookup decision"). This one does feed a real
// lookup (which HoldTimeRule row applies to this sample), so it stays a
// separate, purpose-built comparison rather than reusing a helper that
// was explicitly scoped out of that job.
const POSTURE_BAND_SEVERITY: Record<RiskBand, number> = {
  LOW: 0,
  MODERATE: 1,
  ELEVATED: 2,
  HIGH: 3,
};

// Pure. null for no scored regions (nothing to anchor a hold-time lookup
// against).
export function worstScoredPostureBand(
  bands: readonly RiskBand[],
): RiskBand | null {
  if (bands.length === 0) return null;
  return bands.reduce((worst, band) =>
    POSTURE_BAND_SEVERITY[band] > POSTURE_BAND_SEVERITY[worst] ? band : worst,
  );
}

// Pure core, no DB — mirrors matchScoringRule's split (src/lib/scoring/
// match.ts): parallel sub-scores per SLD_IMPLEMENTATION_PLAN_austria-
// first.md §6, not a blended composite. `worstPostureBand` is the
// posture-only band already computed for a sample (the worst of its
// scored regions); this never touches or overrides that value — it only
// says whether the ADDITIONAL fact of "held this long" escalates the
// hold-time sub-score to HIGH. Returns null when hold-time doesn't add
// anything (no rule, no ceiling at this severity, or within the safe
// duration) — the caller rolls this up with the posture band via
// worstRiskBand, treating null as "hold-time contributes nothing."
export function matchHoldTimeBand(
  rules: readonly HoldTimeRuleRow[],
  worstPostureBand: RiskBand,
  holdDurationSeconds: number,
): RiskBand | null {
  const rule = rules.find((r) => r.postureRiskBand === worstPostureBand);
  if (!rule || rule.maxHoldSeconds === null) return null;
  if (holdDurationSeconds <= rule.maxHoldSeconds) return null;
  return "HIGH";
}

// Impure fetch — all four HoldTimeRule rows for a methodology version, in
// one query (the table is tiny, one row per RiskBand, so there's no
// benefit to filtering by the specific band up front the way
// lookupScoringRule filters by bodyRegion).
export async function lookupHoldTimeRules(
  methodologyVersion: string,
): Promise<HoldTimeRuleRow[]> {
  return prisma.holdTimeRule.findMany({
    where: { methodologyVersion },
    select: { postureRiskBand: true, maxHoldSeconds: true },
  });
}
