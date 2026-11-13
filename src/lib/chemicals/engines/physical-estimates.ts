import { NAEHERUNGSWERT_DE, type PreparedResult, prepared } from "./prepared";

// P15 §3 `mixture.physicalEstimates` (PREPARED, flag OFF). Physical property
// estimates for a mixture from its components. Pure physics — NOT regulatory
// thresholds — so it is buildable and testable now without any blocked official
// data. Every result is labelled a Näherungswert and is explicitly NOT for
// classification (§3). Each estimate REFUSES (value null) when the component
// data it needs is missing, rather than guessing. Not wired to any UI yet.

export type MixtureComponent = {
  name?: string;
  /** Mass fraction in [0,1]. */
  massFraction: number;
  /** g/cm³ (or any consistent unit). */
  density?: number | null;
  /** °C. */
  boilingPoint?: number | null;
  /** °C. */
  flashPoint?: number | null;
};

// Mass-weighted ideal mixing: 1/ρ_mix = Σ (w_i / ρ_i). Refuses if any component
// with a non-zero mass fraction lacks a density, or if fractions don't sum to
// ~1. Ideal-mixing assumption documented in CHEMISTRY_ENGINE_NOTES.
export function estimateMixtureDensity(
  components: MixtureComponent[],
): PreparedResult<number> {
  const label = NAEHERUNGSWERT_DE;
  const active = components.filter((c) => c.massFraction > 0);
  if (active.length === 0)
    return prepared<number>(null, label, "no components");
  const fracSum = active.reduce((s, c) => s + c.massFraction, 0);
  if (Math.abs(fracSum - 1) > 0.02) {
    return prepared<number>(null, label, "mass fractions do not sum to 1");
  }
  let inverse = 0;
  for (const c of active) {
    if (c.density == null || !(c.density > 0)) {
      return prepared<number>(
        null,
        label,
        `missing density for ${c.name ?? "a component"}`,
      );
    }
    inverse += c.massFraction / c.density;
  }
  if (inverse <= 0) return prepared<number>(null, label, "degenerate");
  return prepared(1 / inverse, label);
}

// Conservative lower bound of the boiling range: the lowest component boiling
// point (a mixture can boil no lower than its most volatile component under this
// simplification). Refuses if no component boiling point is known.
export function estimateBoilingRangeLowerBound(
  components: MixtureComponent[],
): PreparedResult<number> {
  const label = NAEHERUNGSWERT_DE;
  const bps = components
    .filter((c) => c.massFraction > 0 && c.boilingPoint != null)
    .map((c) => c.boilingPoint as number);
  if (bps.length === 0)
    return prepared<number>(null, label, "no boiling points known");
  return prepared(Math.min(...bps), label);
}

// Conservative flash-point estimate: the lowest component flash point (the
// mixture's flash point is bounded below by its most flammable component). This
// is deliberately the conservative bound; the Raoult/Le Chatelier refinement
// (needs vapour-pressure data from S6) is documented as pending in
// CHEMISTRY_ENGINE_NOTES. Refuses if no component flash point is known.
export function estimateFlashPoint(
  components: MixtureComponent[],
): PreparedResult<number> {
  const label = NAEHERUNGSWERT_DE;
  const fps = components
    .filter((c) => c.massFraction > 0 && c.flashPoint != null)
    .map((c) => c.flashPoint as number);
  if (fps.length === 0)
    return prepared<number>(null, label, "no flash points known");
  return prepared(Math.min(...fps), label);
}
