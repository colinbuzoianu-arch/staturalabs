import type { ConfirmedSdsData } from "./sds-extraction-schema";

// P15 S3: deterministic SDS consistency checks. Pure, unit-tested. Results are
// HINTS (Prüfhinweise) with a severity and a reason — NEVER automatic
// corrections (§2 S3). The AI (explainSdsHints, gated) only writes a plain-German
// explanation of a hint; it cannot change a result. These rules never invent a
// regulatory number: the full H↔pictogram↔signal-word label mapping and the
// flammable-liquid flash-point/boiling-point criteria come from the S1 CLP
// catalogue (CLP Annex I/V) once it is imported — until then those checks are
// skipped as honest gaps (CHEMISTRY_ENGINE_NOTES.md), not guessed. The checks
// below use only the regulation's fixed CODE identifiers (which H-codes are
// flammable / aquatic), the same way the app already treats H-codes as a fixed
// validated vocabulary — not thresholds recalled from memory.

export type SdsHintCode =
  | "missing-signal-word"
  | "signal-word-without-hazard"
  | "flammable-pictogram-no-h"
  | "flammable-h-no-pictogram"
  | "aquatic-flag-no-h"
  | "aquatic-h-no-flag"
  | "not-german"
  | "stale-revision"
  | "no-components";

export type SdsHintSeverity = "warning" | "info";

export type SdsHint = {
  code: SdsHintCode;
  severity: SdsHintSeverity;
  detail?: string;
};

// Fixed CLP code identifiers (structural, not thresholds).
const FLAMMABLE_H = /^H22[0-9]$/; // H220–H229 flammable gases/aerosols/liquids/solids
const AQUATIC_H = new Set(["H400", "H410", "H411", "H412", "H413"]);

function codes(list: string[]): string[] {
  return list.map((x) => x.trim().toUpperCase()).filter(Boolean);
}

function hasAnyH(list: string[]): boolean {
  return codes(list).some((c) => /^H[2-4]/.test(c) || /^EUH/.test(c));
}

function parseDate(raw: string | null): Date | null {
  if (!raw) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw.trim());
  if (iso) return new Date(`${iso[1]}-${iso[2]}-${iso[3]}`);
  const dmy = /^(\d{1,2})[./](\d{1,2})[./](\d{4})/.exec(raw.trim());
  if (dmy)
    return new Date(
      `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`,
    );
  return null;
}

// true/false/null — null means "can't tell from the free text" (no hint either way).
function marinePollutantYes(raw: string | null): boolean | null {
  if (!raw) return null;
  const t = raw.trim().toLowerCase();
  if (!t) return null;
  if (/\b(nein|no|kein|nicht|none|n\/a)\b/.test(t)) return false;
  if (/\b(ja|yes|x|marine|umwelt|erfüllt|gef)\b/.test(t)) return true;
  return null;
}

const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;

export function checkSdsConsistency(
  c: ConfirmedSdsData,
  opts: { siteRequiresDe: boolean; now: Date; staleYears: number },
): SdsHint[] {
  const hints: SdsHint[] = [];
  const statements = codes(c.statementCodes);
  const pictograms = codes(c.pictograms);
  const signal = (c.signalWord ?? "").trim().toUpperCase();
  const hasSignal =
    signal === "GEFAHR" ||
    signal === "ACHTUNG" ||
    signal === "DANGER" ||
    signal === "WARNING";

  // Signal word vs. hazard presence.
  if (hasAnyH(statements) && !hasSignal) {
    hints.push({ code: "missing-signal-word", severity: "warning" });
  }
  if (hasSignal && !hasAnyH(statements) && pictograms.length === 0) {
    hints.push({ code: "signal-word-without-hazard", severity: "info" });
  }

  // Flammable pictogram (GHS02) ↔ flammable H-code.
  const hasFlammableH = statements.some((s) => FLAMMABLE_H.test(s));
  const hasGhs02 = pictograms.includes("GHS02");
  if (hasGhs02 && !hasFlammableH) {
    hints.push({ code: "flammable-pictogram-no-h", severity: "info" });
  }
  if (hasFlammableH && !hasGhs02) {
    hints.push({ code: "flammable-h-no-pictogram", severity: "info" });
  }

  // Aquatic hazard ↔ transport marine-pollutant flag (hint level — transport has
  // its own criteria, §2 S3).
  const hasAquaticH = statements.some((s) => AQUATIC_H.has(s));
  const marine = marinePollutantYes(c.marinePollutant);
  if (marine === true && !hasAquaticH) {
    hints.push({ code: "aquatic-flag-no-h", severity: "info" });
  }
  if (hasAquaticH && marine === false) {
    hints.push({ code: "aquatic-h-no-flag", severity: "info" });
  }

  // Formal: German SDS required for AT/DE sites (REACH Art. 31(5)).
  const lang = (c.language ?? "").trim().toLowerCase();
  if (opts.siteRequiresDe && lang && !lang.startsWith("de")) {
    hints.push({ code: "not-german", severity: "warning", detail: lang });
  }

  // Formal: revision age (policy).
  const rev = parseDate(c.revisionDate);
  if (rev && !Number.isNaN(rev.getTime())) {
    const ageYears = (opts.now.getTime() - rev.getTime()) / MS_PER_YEAR;
    if (ageYears > opts.staleYears) {
      hints.push({
        code: "stale-revision",
        severity: "info",
        detail: Math.floor(ageYears).toString(),
      });
    }
  }

  // A classified hazardous substance SDS with no section-3 components is unusual.
  if (hasAnyH(statements) && c.components.length === 0) {
    hints.push({ code: "no-components", severity: "info" });
  }

  return hints;
}
