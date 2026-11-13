import type { CountryCode } from "@/generated/prisma/enums";
import { casChecksumValid } from "./clp-import-reconciliation";

// P15 S4 §1: the reconciliation gate for the occupational-exposure-limit
// catalogue. Pure, unit-tested. A bulk official-import version activates only
// when this passes (CAS checksum where present, unit from a whitelist, no
// duplicate keys, jurisdiction + type present, value numeric-or-null). Nothing
// is fetched or guessed here — it validates rows an importer already produced.

export type SubstanceExposureLimitImportRow = {
  jurisdiction: string;
  casNumber: string | null;
  ecNumber: string | null;
  substanceName: string;
  limitType: string;
  value: number | null;
  unit: string | null;
  averagingPeriod: string | null;
  sourceName: string;
};

export type ExposureLimitReconciliationReport = {
  passed: boolean;
  checkedAt: string;
  totalRows: number;
  acceptedRows: number;
  errors: string[];
  excludedRows: { key: string; reason: string }[];
};

// Common OEL units. Extend as new official sources add units; a unit outside the
// whitelist fails the gate rather than being silently accepted.
export const EXPOSURE_LIMIT_UNITS = new Set([
  "mg/m³",
  "mg/m3",
  "ppm",
  "ml/m³",
  "ml/m3",
  "f/cm³",
  "f/cm3",
  "fibres/cm³",
  "mg/l",
  "%",
  "e/cm³",
  "e/cm3",
]);

// Map a site country to the limit catalogue jurisdiction. EU is never a country's
// jurisdiction — it is queried separately as supplementary data. RO has no
// jurisdiction (dev-only), so it returns null (honest gap, no fallback §3.15).
export function jurisdictionForCountry(country: CountryCode): string | null {
  switch (country) {
    case "AT":
      return "AT";
    case "DE":
      return "DE";
    case "CH":
      return "CH";
    default:
      return null;
  }
}

export function reconcileSubstanceExposureLimits(
  rows: SubstanceExposureLimitImportRow[],
  opts: { expectedRows?: number | null } = {},
): ExposureLimitReconciliationReport {
  const errors: string[] = [];
  const excludedRows: { key: string; reason: string }[] = [];
  const seen = new Set<string>();
  let accepted = 0;

  for (const r of rows) {
    const key = [
      r.jurisdiction,
      r.casNumber ?? r.substanceName,
      r.limitType,
      r.averagingPeriod ?? "",
    ]
      .join("|")
      .toUpperCase();
    if (seen.has(key)) {
      excludedRows.push({ key, reason: "duplicate key" });
      errors.push(`duplicate ${key}`);
      continue;
    }
    seen.add(key);
    if (!r.jurisdiction.trim()) {
      excludedRows.push({ key, reason: "missing jurisdiction" });
      errors.push(`missing jurisdiction for ${key}`);
      continue;
    }
    if (!r.limitType.trim()) {
      excludedRows.push({ key, reason: "missing limitType" });
      errors.push(`missing limitType for ${key}`);
      continue;
    }
    if (!r.substanceName.trim()) {
      excludedRows.push({ key, reason: "missing substanceName" });
      errors.push(`missing substanceName for ${key}`);
      continue;
    }
    if (r.casNumber && !casChecksumValid(r.casNumber)) {
      excludedRows.push({ key, reason: `invalid CAS ${r.casNumber}` });
      errors.push(`invalid CAS ${r.casNumber}`);
      continue;
    }
    // value + unit must agree: a numeric value needs a whitelisted unit; a
    // reference-only row has value null (and may omit the unit).
    if (r.value != null) {
      if (!Number.isFinite(r.value)) {
        excludedRows.push({ key, reason: "non-finite value" });
        errors.push(`non-finite value for ${key}`);
        continue;
      }
      if (!r.unit || !EXPOSURE_LIMIT_UNITS.has(r.unit.trim())) {
        excludedRows.push({
          key,
          reason: `unit not in whitelist: ${r.unit ?? "∅"}`,
        });
        errors.push(`unit not whitelisted for ${key}: ${r.unit ?? "∅"}`);
        continue;
      }
    }
    accepted++;
  }

  const expected = opts.expectedRows ?? null;
  if (expected !== null && expected !== rows.length) {
    errors.push(`row count ${rows.length} != expected ${expected}`);
  }

  return {
    passed: errors.length === 0,
    checkedAt: new Date().toISOString(),
    totalRows: rows.length,
    acceptedRows: accepted,
    errors,
    excludedRows,
  };
}
