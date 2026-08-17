import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { holdTimeRule: { findMany: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import {
  type HoldTimeRuleRow,
  lookupHoldTimeRules,
  matchHoldTimeBand,
  worstScoredPostureBand,
} from "./hold-time";

// Mirrors the seeded v2-2026-08 rows from
// prisma/migrations/20260817150000_add_hold_time, verified against the
// live DB when that migration was applied.
const V2_RULES: HoldTimeRuleRow[] = [
  { postureRiskBand: "LOW", maxHoldSeconds: 14400 },
  { postureRiskBand: "MODERATE", maxHoldSeconds: 1800 },
  { postureRiskBand: "ELEVATED", maxHoldSeconds: 300 },
  { postureRiskBand: "HIGH", maxHoldSeconds: null },
];

describe("matchHoldTimeBand", () => {
  it("returns null when held within the LOW-band ceiling", () => {
    expect(matchHoldTimeBand(V2_RULES, "LOW", 100)).toBeNull();
    expect(matchHoldTimeBand(V2_RULES, "LOW", 14400)).toBeNull(); // inclusive boundary
  });

  it("escalates to HIGH when the LOW-band ceiling is exceeded — the '2-second reach vs. 4-hour bend' case", () => {
    expect(matchHoldTimeBand(V2_RULES, "LOW", 14401)).toBe("HIGH");
  });

  it("returns null within the MODERATE/ELEVATED ceilings, HIGH once exceeded", () => {
    expect(matchHoldTimeBand(V2_RULES, "MODERATE", 1800)).toBeNull();
    expect(matchHoldTimeBand(V2_RULES, "MODERATE", 1801)).toBe("HIGH");
    expect(matchHoldTimeBand(V2_RULES, "ELEVATED", 300)).toBeNull();
    expect(matchHoldTimeBand(V2_RULES, "ELEVATED", 301)).toBe("HIGH");
  });

  it("never escalates an already-HIGH posture band (null ceiling)", () => {
    expect(matchHoldTimeBand(V2_RULES, "HIGH", 1)).toBeNull();
    expect(matchHoldTimeBand(V2_RULES, "HIGH", 999_999)).toBeNull();
  });

  it("returns null when no rule exists for the given band", () => {
    expect(matchHoldTimeBand([], "LOW", 100)).toBeNull();
  });
});

describe("worstScoredPostureBand", () => {
  it("returns null for an empty list", () => {
    expect(worstScoredPostureBand([])).toBeNull();
  });

  it("returns the single band for a one-element list", () => {
    expect(worstScoredPostureBand(["MODERATE"])).toBe("MODERATE");
  });

  it("returns the most severe band regardless of order", () => {
    expect(worstScoredPostureBand(["LOW", "HIGH", "MODERATE"])).toBe("HIGH");
    expect(worstScoredPostureBand(["ELEVATED", "LOW"])).toBe("ELEVATED");
  });
});

describe("lookupHoldTimeRules", () => {
  beforeEach(() => {
    vi.mocked(prisma.holdTimeRule.findMany).mockReset();
  });

  it("fetches all rules for the given methodology version", async () => {
    vi.mocked(prisma.holdTimeRule.findMany).mockResolvedValue(
      V2_RULES as never,
    );
    const rows = await lookupHoldTimeRules("v2-2026-08");
    expect(rows).toEqual(V2_RULES);
    expect(prisma.holdTimeRule.findMany).toHaveBeenCalledWith({
      where: { methodologyVersion: "v2-2026-08" },
      select: { postureRiskBand: true, maxHoldSeconds: true },
    });
  });
});
