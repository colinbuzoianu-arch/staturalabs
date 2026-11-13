import type { SubstanceStatementKind } from "@/generated/prisma/enums";
import { isValidStatementCode } from "./clp-code-format";

// P15 §1: the automated reconciliation gate that MUST pass before a bulk
// `official-import` catalogue version can be activated. Pure — unit-tested
// against fixtures. Nothing here fetches, parses or guesses: it validates rows
// a (separate, provenance-recording) importer has already produced, and refuses
// to let a version go live unless the rows are internally sound. This is the
// mechanical half of "do not seed a legal value from recollection" (§0.7/§7):
// even correct-looking data is held inactive until it reconciles.

export type ClpStatementImportRow = {
  kind: SubstanceStatementKind;
  code: string;
  textEn: string;
  textDe: string;
  sourceRef: string;
};

export type ReconciliationReport = {
  passed: boolean;
  checkedAt: string;
  totalRows: number;
  expectedRows: number | null;
  acceptedRows: number;
  errors: string[];
  excludedRows: { code: string; reason: string }[];
};

// CAS Registry Number check-digit validation (§1 "CAS-number checksum valid").
// Format NNNNNN-NN-N (2-7 + 2 + 1 digits). The last digit is a checksum: sum of
// each preceding digit multiplied by its position counted from the right
// (1-based), modulo 10. Returns false for anything malformed — never throws.
export function casChecksumValid(cas: string): boolean {
  const m = /^(\d{2,7})-(\d{2})-(\d)$/.exec(cas.trim());
  if (!m) return false;
  const digits = (m[1] + m[2]).split("").map(Number);
  const check = Number(m[3]);
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    // rightmost body digit has weight 1
    sum += digits[digits.length - 1 - i] * (i + 1);
  }
  return sum % 10 === check;
}

// Two-pass agreement for PDF-only sources (§1): a row is accepted only when both
// independent extraction passes produce identical text for the same code. Any
// code present in only one pass, or with differing text, is excluded and listed
// — never reconciled by guessing. Keyed by code.
export function reconcileTwoPass(
  passA: ClpStatementImportRow[],
  passB: ClpStatementImportRow[],
): {
  agreed: ClpStatementImportRow[];
  disagreements: { code: string; reason: string }[];
} {
  const byCodeB = new Map(passB.map((r) => [r.code.trim().toUpperCase(), r]));
  const seenB = new Set<string>();
  const agreed: ClpStatementImportRow[] = [];
  const disagreements: { code: string; reason: string }[] = [];

  for (const a of passA) {
    const code = a.code.trim().toUpperCase();
    const b = byCodeB.get(code);
    if (!b) {
      disagreements.push({ code, reason: "present in pass A only" });
      continue;
    }
    seenB.add(code);
    if (
      a.kind !== b.kind ||
      a.textEn.trim() !== b.textEn.trim() ||
      a.textDe.trim() !== b.textDe.trim()
    ) {
      disagreements.push({ code, reason: "extraction passes disagree" });
      continue;
    }
    agreed.push(a);
  }
  for (const b of passB) {
    const code = b.code.trim().toUpperCase();
    if (!seenB.has(code)) {
      disagreements.push({ code, reason: "present in pass B only" });
    }
  }
  return { agreed, disagreements };
}

// The final gate for the H/P/EUH phrase catalogue. `expectedRows` is the row
// count claimed by the source (e.g. "Annex III Part 1 lists N hazard
// statements"); a mismatch fails the gate. Any malformed row (bad code shape,
// empty EN or DE text, missing source reference) or any duplicate code fails
// the gate and is listed — the importer must not activate a version that does
// not reconcile.
export function reconcileClpStatements(
  rows: ClpStatementImportRow[],
  opts: {
    expectedRows?: number | null;
    priorExclusions?: { code: string; reason: string }[];
  } = {},
): ReconciliationReport {
  const errors: string[] = [];
  const excludedRows: { code: string; reason: string }[] = [
    ...(opts.priorExclusions ?? []),
  ];
  const seen = new Set<string>();
  let accepted = 0;

  for (const r of rows) {
    const code = r.code.trim().toUpperCase();
    if (seen.has(code)) {
      excludedRows.push({ code, reason: "duplicate code" });
      errors.push(`duplicate code ${code}`);
      continue;
    }
    seen.add(code);
    if (!isValidStatementCode(r.kind, code)) {
      excludedRows.push({ code, reason: `invalid ${r.kind} code shape` });
      errors.push(`invalid code shape ${code} (${r.kind})`);
      continue;
    }
    if (!r.textEn.trim() || !r.textDe.trim()) {
      excludedRows.push({ code, reason: "missing EN or DE text" });
      errors.push(`missing text for ${code}`);
      continue;
    }
    if (!r.sourceRef.trim()) {
      excludedRows.push({ code, reason: "missing source reference" });
      errors.push(`missing sourceRef for ${code}`);
      continue;
    }
    accepted++;
  }

  const expectedRows = opts.expectedRows ?? null;
  if (expectedRows !== null && expectedRows !== rows.length) {
    errors.push(`row count ${rows.length} != expected ${expectedRows}`);
  }

  // The gate passes only when nothing failed: no parse/shape errors, no
  // duplicates, no count mismatch. Prior two-pass disagreements are listed for
  // the report but do not by themselves fail the gate (those rows were already
  // excluded upstream); a malformed row among the rows we DO import does.
  const passed = errors.length === 0;
  return {
    passed,
    checkedAt: new Date().toISOString(),
    totalRows: rows.length,
    expectedRows,
    acceptedRows: accepted,
    errors,
    excludedRows,
  };
}
