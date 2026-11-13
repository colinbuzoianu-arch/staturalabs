import {
  BERECHNUNGSVORSCHLAG_DE,
  type PreparedResult,
  prepared,
} from "./prepared";

// P15 §3 `wgk.mixtureCalculation` (PREPARED, flag OFF). The AwSV mixture rule for
// the Wassergefährdungsklasse of a mixture from its component WGKs. The AwSV
// threshold percentages are REGULATORY and are passed in as `rules` (loaded from
// the official AwSV text) — NOT recalled here (§0.7/§7). This module implements
// the presence-threshold framework only; the full AwSV additive rule + factors
// and the real thresholds are pending the official text + expert review
// (CHEMISTRY_ENGINE_NOTES). Result is a Berechnungsvorschlag, not a final WGK.

export type WgkComponent = {
  name?: string;
  concentrationPct: number;
  wgk: 1 | 2 | 3 | null;
};

// Minimum summed concentration (percent) at which the mixture takes each class.
export type WgkMixtureRules = {
  wgk3MinPct: number;
  wgk2MinPct: number;
  wgk1MinPct: number;
};

export function computeMixtureWgk(
  components: WgkComponent[],
  rules: WgkMixtureRules | null,
): PreparedResult<1 | 2 | 3 | null> {
  const label = BERECHNUNGSVORSCHLAG_DE;
  if (!rules)
    return prepared<1 | 2 | 3 | null>(null, label, "no AwSV thresholds loaded");
  const sumFor = (w: 1 | 2 | 3) =>
    components
      .filter((c) => c.wgk === w)
      .reduce((s, c) => s + Math.max(0, c.concentrationPct), 0);
  const s3 = sumFor(3);
  const s2 = sumFor(2);
  const s1 = sumFor(1);
  // Highest class whose presence threshold is met wins (simplified framework).
  if (s3 >= rules.wgk3MinPct) return prepared<1 | 2 | 3 | null>(3, label);
  if (s3 + s2 >= rules.wgk2MinPct) return prepared<1 | 2 | 3 | null>(2, label);
  if (s3 + s2 + s1 >= rules.wgk1MinPct)
    return prepared<1 | 2 | 3 | null>(1, label);
  return prepared<1 | 2 | 3 | null>(
    null,
    label,
    "below all thresholds (nwg) — verify against AwSV",
  );
}
