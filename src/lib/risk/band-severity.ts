import type { RiskBand } from "@/generated/prisma/enums";

// Same ordering as the ScoringRule/RiskMatrixCell risk bands — reused
// rather than a second scale (see schema.prisma's RiskBand doc comment and
// CLAUDE.md's "one risk vocabulary" note). Ranked here purely for display
// purposes (sorting/aggregating across findings for the M6 analysis
// views) — this ranking never feeds a scoring or matrix lookup decision.
const RISK_BAND_SEVERITY: Record<RiskBand, number> = {
  LOW: 0,
  MODERATE: 1,
  ELEVATED: 2,
  HIGH: 3,
};

// Exported alongside worstRiskBand so callers that need to *sort* by band
// (e.g. the site rollup's "workstations by highest band") use the same
// ranking rather than re-deriving it.
export function riskBandRank(band: RiskBand): number {
  return RISK_BAND_SEVERITY[band];
}

// Pure — exported for direct unit testing. null for an empty input (no
// band to report), never a default band substituted for "no data."
export function worstRiskBand(bands: RiskBand[]): RiskBand | null {
  if (bands.length === 0) return null;

  return bands.reduce((worst, band) =>
    RISK_BAND_SEVERITY[band] > RISK_BAND_SEVERITY[worst] ? band : worst,
  );
}

// Fixed severity color scale for the site map heatmap (and any future
// visual, band-colored view) — a display concern, kept next to
// worstRiskBand/riskBandRank since all three exist purely to rank/present
// a RiskBand, never to feed a scoring or matrix-lookup decision.
export const riskBandColors: Record<RiskBand, string> = {
  LOW: "#22c55e", // green-500
  MODERATE: "#eab308", // yellow-500
  ELEVATED: "#f97316", // orange-500
  HIGH: "#ef4444", // red-500
};

// For a workstation/task with no band to report yet (no approved
// assessment, no matching findings for a hazard-category filter, no scored
// posture sample) — visually distinct from every real band, never reused
// as a stand-in for LOW.
export const NOT_ASSESSED_COLOR = "#9ca3af"; // gray-400
