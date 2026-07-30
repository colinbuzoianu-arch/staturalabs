import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RiskMatrixCellModel } from "@/generated/prisma/models";

vi.mock("@/lib/prisma", () => ({
  prisma: { riskMatrixCell: { findMany: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { lookupRiskMatrixCell, matchRiskMatrixCell } from "./matrix-lookup";

// Mirrors the seeded v1-generic-5x5 cells from
// prisma/migrations/20260730120300_add_risk_core, verified against the
// live DB when the migration was applied. Kept as a literal fixture
// (score = probability * severity, banded LOW <=4 / MODERATE 5-9 /
// ELEVATED 10-14 / HIGH >=15) rather than read from the DB — fast,
// deterministic unit tests.
const CELLS = [
  { probability: 1, severity: 1, riskScore: 1, riskBand: "LOW" },
  { probability: 1, severity: 5, riskScore: 5, riskBand: "MODERATE" },
  { probability: 2, severity: 5, riskScore: 10, riskBand: "ELEVATED" },
  { probability: 3, severity: 5, riskScore: 15, riskBand: "HIGH" },
  { probability: 5, severity: 5, riskScore: 25, riskBand: "HIGH" },
];

describe("matchRiskMatrixCell", () => {
  it.each([
    [1, 1, "LOW"],
    [1, 5, "MODERATE"],
    [2, 5, "ELEVATED"],
    [3, 5, "HIGH"],
    [5, 5, "HIGH"],
  ] as const)(
    "probability=%d, severity=%d -> %s",
    (probability, severity, expectedBand) => {
      expect(matchRiskMatrixCell(CELLS, probability, severity)?.riskBand).toBe(
        expectedBand,
      );
    },
  );

  it("returns null, never a default, for a probability/severity pair with no seeded row", () => {
    expect(matchRiskMatrixCell(CELLS, 4, 2)).toBeNull();
  });

  it("returns null for an empty cell set", () => {
    expect(matchRiskMatrixCell([], 1, 1)).toBeNull();
  });

  it("throws rather than silently picking one of several overlapping matches", () => {
    const overlapping = [
      { probability: 1, severity: 1, riskScore: 1, riskBand: "LOW" },
      { probability: 1, severity: 1, riskScore: 2, riskBand: "MODERATE" },
    ];
    expect(() => matchRiskMatrixCell(overlapping, 1, 1)).toThrow(/Ambiguous/);
  });
});

describe("lookupRiskMatrixCell", () => {
  beforeEach(() => {
    vi.mocked(prisma.riskMatrixCell.findMany).mockReset();
  });

  it("queries by matrixVersion and delegates to matchRiskMatrixCell", async () => {
    vi.mocked(prisma.riskMatrixCell.findMany).mockResolvedValue(
      CELLS as unknown as RiskMatrixCellModel[],
    );

    const result = await lookupRiskMatrixCell({
      probability: 3,
      severity: 5,
      matrixVersion: "v1-generic-5x5",
    });

    expect(prisma.riskMatrixCell.findMany).toHaveBeenCalledWith({
      where: { matrixVersion: "v1-generic-5x5" },
    });
    expect(result?.riskBand).toBe("HIGH");
  });

  it("returns null when no rows come back for the matrixVersion", async () => {
    vi.mocked(prisma.riskMatrixCell.findMany).mockResolvedValue([]);

    const result = await lookupRiskMatrixCell({
      probability: 1,
      severity: 1,
      matrixVersion: "unknown-version",
    });

    expect(result).toBeNull();
  });
});
