import type { RiskMatrixCellModel } from "@/generated/prisma/models";
import { prisma } from "@/lib/prisma";

// Deliberately no `import "server-only"` here — needs to be directly
// unit-testable, same reasoning as scoring/lookup.ts, which this file
// mirrors exactly.

type CellCandidate = {
  probability: number;
  severity: number;
};

// Pure core — exported so it can be unit tested directly against fixture
// rows, with no DB involved. Mirrors matchScoringRule
// (src/lib/scoring/lookup.ts): a real per-row check, not an assumption
// that (probability, severity) uniquely identifies a row. The DB enforces
// that uniqueness (RiskMatrixCell_matrixVersion_probability_severity_key),
// but this function doesn't trust that invariant blindly — more than one
// candidate is a data problem to surface loudly, not silently resolve.
export function matchRiskMatrixCell<T extends CellCandidate>(
  cells: T[],
  probability: number,
  severity: number,
): T | null {
  const matches = cells.filter(
    (cell) => cell.probability === probability && cell.severity === severity,
  );

  if (matches.length > 1) {
    throw new Error(
      `Ambiguous RiskMatrixCell match: (probability=${probability}, severity=${severity}) matched ${matches.length} rows (expected at most 1)`,
    );
  }

  return matches[0] ?? null;
}

// Given (probability, severity, matrixVersion), returns the matching
// RiskMatrixCell row, or null if none matches (e.g. a probability/severity
// pair outside the matrix's defined 1-5 range). A null result is a data
// problem to surface — callers must not substitute a default risk band
// for it.
//
// Takes matrixVersion as an explicit param rather than resolving the
// active version itself, mirroring lookupScoringRule exactly — active-
// version resolution is getActiveRiskMatrixVersion's job
// (src/lib/risk/matrix-version.ts), kept separate so a caller can also
// look up a cell under a specific past version (e.g. re-displaying an
// already-scored finding) without that meaning "this is now active."
export async function lookupRiskMatrixCell(params: {
  probability: number;
  severity: number;
  matrixVersion: string;
}): Promise<RiskMatrixCellModel | null> {
  const candidates = await prisma.riskMatrixCell.findMany({
    where: { matrixVersion: params.matrixVersion },
  });

  return matchRiskMatrixCell(candidates, params.probability, params.severity);
}
