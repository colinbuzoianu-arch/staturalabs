import {
  BERECHNUNGSVORSCHLAG_DE,
  type PreparedResult,
  prepared,
} from "./prepared";

// P15 §3 `storage.lagerklasseSuggestion` (PREPARED, flag OFF). Suggest a TRGS 510
// Lagerklasse from a substance's classification. The TRGS 510 DECISION SCHEME is
// regulatory and is passed in as `scheme` (rules loaded from the official TRGS
// 510 text) — NOT recalled here (§0.7/§7). The Phase-1 storage check (S5b) never
// computes a suggested class; only this prepared engine does, behind its flag.
// First matching rule by priority wins. A SUGGESTION, never a final assignment.

export type LagerklasseRule = {
  lagerklasse: string;
  /** Match if ANY of these H-codes is present. */
  anyHCode?: string[];
  /** Match only if a flammable pictogram (GHS02) is present. */
  requiresFlammablePictogram?: boolean;
  /** Lower number = evaluated first. */
  priority: number;
};

export function suggestLagerklasse(
  input: { hCodes: string[]; pictograms: string[] },
  scheme: LagerklasseRule[],
): PreparedResult<string> {
  const label = BERECHNUNGSVORSCHLAG_DE;
  if (scheme.length === 0)
    return prepared<string>(null, label, "no TRGS 510 scheme loaded");
  const hset = new Set(input.hCodes.map((h) => h.trim().toUpperCase()));
  const hasGhs02 = input.pictograms
    .map((p) => p.trim().toUpperCase())
    .includes("GHS02");
  const ordered = [...scheme].sort((a, b) => a.priority - b.priority);
  for (const rule of ordered) {
    if (rule.requiresFlammablePictogram && !hasGhs02) continue;
    if (rule.anyHCode && rule.anyHCode.length > 0) {
      if (!rule.anyHCode.some((h) => hset.has(h.trim().toUpperCase())))
        continue;
    }
    return prepared(rule.lagerklasse, label);
  }
  return prepared<string>(
    null,
    label,
    "no scheme rule matched — assign manually",
  );
}
