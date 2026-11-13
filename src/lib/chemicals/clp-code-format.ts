import type { SubstanceStatementKind } from "@/generated/prisma/enums";

// P15 S1: CLP H/P/EUH code-shape validators. Pure. These mirror EXACTLY the DB
// CHECK on SubstanceStatement / ClpStatement (prisma/migrations/
// 20261104180100_add_substances, 20261113100000_add_clp_reference_catalogue),
// so a code that passes here passes the DB and vice-versa — one validated
// vocabulary shared by the catalogue, the per-substance statements and the SDS
// extraction review form (S2). They validate SHAPE only; whether a code is a
// real CLP statement is a catalogue lookup (lookupClpStatement), not a regex.
const H_RE = /^H[2-4][0-9]{2}[A-Za-z]{0,3}$/;
const EUH_RE = /^EUH[0-9]{3}[A-Za-z]?$/;
const P_RE = /^P[1-5][0-9]{2}(\+P[1-5][0-9]{2})*$/;

export function isValidStatementCode(
  kind: SubstanceStatementKind,
  code: string,
): boolean {
  const c = code.trim().toUpperCase();
  switch (kind) {
    case "H":
      return H_RE.test(c);
    case "EUH":
      return EUH_RE.test(c);
    case "P":
      return P_RE.test(c);
    default:
      return false;
  }
}

// Infer the statement kind from a code shape alone (used by the SDS-extraction
// review form, where the model returns bare codes). Returns null for anything
// that matches no known shape — never guesses a kind.
export function inferStatementKind(
  code: string,
): SubstanceStatementKind | null {
  const c = code.trim().toUpperCase();
  if (EUH_RE.test(c)) return "EUH";
  if (H_RE.test(c)) return "H";
  if (P_RE.test(c)) return "P";
  return null;
}
