import { casChecksumValid } from "./clp-import-reconciliation";

// P16 §3.1: mixture-composition helpers. Pure (no server-only) — unit-tested.
// parseConcentration reads an SDS section-3 concentration string into exact/range;
// validateComposition enforces the editor rules; conservativeConcentrationPct is
// the value engines use for a range (the HIGHER end — more hazardous — documented
// in CHEMISTRY_ENGINE_NOTES).

export type ConcentrationParse = {
  exactPct: number | null;
  minPct: number | null;
  maxPct: number | null;
};

const num = (s: string) => Number(s.replace(",", "."));

// Parse "25-50%", "≥99 %", "<1%", "10 %" … → exact or range. Unknown → all null.
export function parseConcentration(
  raw: string | null | undefined,
): ConcentrationParse {
  const empty: ConcentrationParse = {
    exactPct: null,
    minPct: null,
    maxPct: null,
  };
  if (!raw) return empty;
  const t = raw.trim().replace(/%/g, "").replace(/\s+/g, " ").trim();
  if (!t) return empty;
  const range = /^(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)$/.exec(t);
  if (range) {
    const a = num(range[1]);
    const b = num(range[2]);
    return { exactPct: null, minPct: Math.min(a, b), maxPct: Math.max(a, b) };
  }
  const ge = /^(?:>=|≥|>)\s*(\d+(?:[.,]\d+)?)$/.exec(t);
  if (ge) return { exactPct: null, minPct: num(ge[1]), maxPct: 100 };
  const le = /^(?:<=|≤|<)\s*(\d+(?:[.,]\d+)?)$/.exec(t);
  if (le) return { exactPct: null, minPct: 0, maxPct: num(le[1]) };
  const exact = /^(\d+(?:[.,]\d+)?)$/.exec(t);
  if (exact) return { exactPct: num(exact[1]), minPct: null, maxPct: null };
  return empty;
}

export type CompositionComponentInput = {
  name: string;
  casNumber?: string | null;
  concentrationExactPct?: number | null;
  concentrationMinPct?: number | null;
  concentrationMaxPct?: number | null;
};

export type CompositionValidation = { errors: string[]; warnings: string[] };

export function validateComposition(
  components: CompositionComponentInput[],
): CompositionValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const inRange = (n: number) => n >= 0 && n <= 100;
  let exactSum = 0;
  const casSeen = new Map<string, number>();

  for (const c of components) {
    const label = c.name?.trim() || c.casNumber || "(unnamed)";
    if (!c.name?.trim()) errors.push(`A component is missing a name`);
    const hasExact = c.concentrationExactPct != null;
    const hasRange =
      c.concentrationMinPct != null || c.concentrationMaxPct != null;
    if (hasExact && hasRange)
      errors.push(`${label}: set an exact value or a range, not both`);
    if (hasExact) {
      if (!inRange(c.concentrationExactPct as number))
        errors.push(`${label}: concentration out of 0–100 %`);
      else exactSum += c.concentrationExactPct as number;
    }
    if (hasRange) {
      const mn = c.concentrationMinPct;
      const mx = c.concentrationMaxPct;
      if (mn != null && !inRange(mn))
        errors.push(`${label}: min % out of 0–100`);
      if (mx != null && !inRange(mx))
        errors.push(`${label}: max % out of 0–100`);
      if (mn != null && mx != null && mn > mx)
        errors.push(`${label}: min % above max %`);
    }
    if (c.casNumber?.trim()) {
      if (!casChecksumValid(c.casNumber))
        warnings.push(`${label}: CAS checksum looks wrong`);
      const key = c.casNumber.trim();
      casSeen.set(key, (casSeen.get(key) ?? 0) + 1);
    }
  }
  if (exactSum > 100.5)
    errors.push(
      `Exact concentrations sum to ${exactSum.toFixed(1)} % (> 100 %)`,
    );
  for (const [cas, n] of casSeen)
    if (n > 1) warnings.push(`Duplicate component CAS ${cas}`);
  return { errors, warnings };
}

// The concentration an engine should use. A range → its HIGHER end (conservative
// for hazard); exact → exact; unknown → null. Reports which end was used.
export function conservativeConcentrationPct(c: {
  concentrationExactPct?: number | null;
  concentrationMinPct?: number | null;
  concentrationMaxPct?: number | null;
}): { value: number | null; basis: "exact" | "range-max" | "unknown" } {
  if (c.concentrationExactPct != null)
    return { value: c.concentrationExactPct, basis: "exact" };
  if (c.concentrationMaxPct != null)
    return { value: c.concentrationMaxPct, basis: "range-max" };
  if (c.concentrationMinPct != null)
    return { value: c.concentrationMinPct, basis: "range-max" };
  return { value: null, basis: "unknown" };
}

// P16 §4: parse a leading numeric value from a verbatim reference-property string
// (e.g. "0.79 g/cm³", "-17 °C", "56 °C (closed cup)", "−95 °C"). Returns null when
// no leading number is present. Pure. Used to turn PubChem reference properties
// into numeric engine inputs; it never fabricates a value.
export function parseNumericProperty(
  text: string | null | undefined,
): number | null {
  if (!text) return null;
  // normalise unicode minus and take the first number (optionally signed/decimal)
  const m = /(-?\d+(?:[.,]\d+)?)/.exec(text.replace(/[−–]/g, "-"));
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
