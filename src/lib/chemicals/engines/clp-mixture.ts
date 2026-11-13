import {
  BERECHNUNGSVORSCHLAG_DE,
  type PreparedResult,
  prepared,
} from "./prepared";

// P15 §3 `clp.mixtureCalculation` (PREPARED, flag OFF). CLP Annex I mixture
// methods. IMPORTANT (§0.7/§7): the regulatory THRESHOLDS (generic concentration
// limits, summation cut-offs, M-factors) are NOT recalled here — they are passed
// in as a config the caller loads from the official CLP Annex I text. This module
// implements only the METHOD (the arithmetic), which is pure and testable. The
// real threshold tables + the reproduction of ECHA's CLP-guidance worked examples
// are pending the official data + expert review (CHEMISTRY_ENGINE_NOTES). Physical
// hazards are NOT calculated (they need test data, §3). Output is always a
// Berechnungsvorschlag compared against the supplier's classification, never a
// final classification.

export type AteComponent = {
  name?: string;
  /** Concentration in percent [0,100]. */
  concentrationPct: number;
  /** Acute toxicity estimate for the relevant route; null if unknown. */
  ate?: number | null;
};

// CLP Annex I additivity formula for acute toxicity:
//   100 / ATE_mix = Σ ( C_i / ATE_i )  over components with a known ATE.
// Pure arithmetic. Also reports the fraction of the mixture whose ATE is unknown
// (the caller/expert applies CLP's "≥10% unknown" rule using the config — that
// threshold is regulatory and is NOT decided here).
export function computeAteMix(
  components: AteComponent[],
): PreparedResult<{ ateMix: number; unknownPct: number }> {
  const label = BERECHNUNGSVORSCHLAG_DE;
  let sum = 0;
  let knownPct = 0;
  let unknownPct = 0;
  for (const c of components) {
    if (c.concentrationPct <= 0) continue;
    if (c.ate != null && c.ate > 0) {
      sum += c.concentrationPct / c.ate;
      knownPct += c.concentrationPct;
    } else {
      unknownPct += c.concentrationPct;
    }
  }
  if (knownPct === 0 || sum <= 0) {
    return prepared<{ ateMix: number; unknownPct: number }>(
      null,
      label,
      "no component has a known ATE",
    );
  }
  return prepared({ ateMix: 100 / sum, unknownPct }, label);
}

// Generic summation method (skin/eye/sensitisation/aquatic …). The caller supplies
// the CATEGORY CUT-OFF and the per-item MULTIPLIER (e.g. an M-factor, or a 10×
// weighting for a higher category) from the official CLP config — this function
// only sums `Σ (concentration × multiplier)` and compares it to the cut-off.
export type SummationItem = { concentrationPct: number; multiplier: number };

export function summationMethod(
  items: SummationItem[],
  cutoffPct: number,
): PreparedResult<{ sum: number; meetsCategory: boolean }> {
  const label = BERECHNUNGSVORSCHLAG_DE;
  if (!(cutoffPct > 0))
    return prepared<{ sum: number; meetsCategory: boolean }>(
      null,
      label,
      "no cut-off supplied (load the CLP config)",
    );
  const sum = items.reduce(
    (s, i) => s + Math.max(0, i.concentrationPct) * (i.multiplier ?? 0),
    0,
  );
  return prepared({ sum, meetsCategory: sum >= cutoffPct }, label);
}
