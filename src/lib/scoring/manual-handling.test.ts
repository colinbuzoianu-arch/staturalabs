import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    manualHandlingRule: { findMany: vi.fn() },
    manualInput: { findFirst: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  computeManualHandlingResult,
  lookupManualHandlingRules,
  matchManualHandlingRule,
} from "./manual-handling";

// Mirrors the seeded v2-2026-08 rows from
// prisma/migrations/20260817180000_add_manual_handling_rule, verified
// against the live DB when that migration was applied. Literal fixture,
// not read from the DB — fast, deterministic unit tests.
const RULES = [
  { riskBand: "LOW", riskScore: 1, minKg: 0, maxKg: 10 },
  { riskBand: "MODERATE", riskScore: 2, minKg: 10, maxKg: 15 },
  { riskBand: "ELEVATED", riskScore: 3, minKg: 15, maxKg: 25 },
  { riskBand: "HIGH", riskScore: 4, minKg: 25, maxKg: null },
] as const;

describe("matchManualHandlingRule", () => {
  it.each([
    [0, "LOW"],
    [5, "LOW"],
    [10, "MODERATE"],
    [14.9, "MODERATE"],
    [15, "ELEVATED"],
    [24.9, "ELEVATED"],
    [25, "HIGH"],
    [80, "HIGH"],
  ] as const)("%d kg -> %s", (kg, expectedBand) => {
    expect(matchManualHandlingRule(RULES, kg)?.riskBand).toBe(expectedBand);
  });

  it("returns null for an empty rule set, never a default band", () => {
    expect(matchManualHandlingRule([], 12)).toBeNull();
  });

  it("throws rather than silently picking one of several overlapping matches", () => {
    const overlapping = [
      { riskBand: "LOW" as const, riskScore: 1, minKg: 0, maxKg: 20 },
      { riskBand: "MODERATE" as const, riskScore: 2, minKg: 10, maxKg: 30 },
    ];
    expect(() => matchManualHandlingRule(overlapping, 15)).toThrow(/Ambiguous/);
  });
});

describe("lookupManualHandlingRules", () => {
  beforeEach(() => {
    vi.mocked(prisma.manualHandlingRule.findMany).mockReset();
  });

  it("queries by methodologyVersion", async () => {
    vi.mocked(prisma.manualHandlingRule.findMany).mockResolvedValue(
      RULES as never,
    );

    const result = await lookupManualHandlingRules("v2-2026-08");

    expect(prisma.manualHandlingRule.findMany).toHaveBeenCalledWith({
      where: { methodologyVersion: "v2-2026-08" },
      select: { riskBand: true, riskScore: true, minKg: true, maxKg: true },
    });
    expect(result).toEqual(RULES);
  });
});

describe("computeManualHandlingResult", () => {
  beforeEach(() => {
    vi.mocked(prisma.manualInput.findFirst).mockReset();
    vi.mocked(prisma.manualHandlingRule.findMany).mockReset();
  });

  it("returns null when the task has no LOAD_WEIGHT_KG entry", async () => {
    vi.mocked(prisma.manualInput.findFirst).mockResolvedValue(null);

    const result = await computeManualHandlingResult({
      taskId: "t1",
      methodologyVersion: "v2-2026-08",
    });

    expect(result).toBeNull();
    expect(prisma.manualHandlingRule.findMany).not.toHaveBeenCalled();
  });

  it("queries the most recent LOAD_WEIGHT_KG input and matches it against the active rules", async () => {
    vi.mocked(prisma.manualInput.findFirst).mockResolvedValue({
      value: 18,
    } as never);
    vi.mocked(prisma.manualHandlingRule.findMany).mockResolvedValue(
      RULES as never,
    );

    const result = await computeManualHandlingResult({
      taskId: "t1",
      methodologyVersion: "v2-2026-08",
    });

    expect(prisma.manualInput.findFirst).toHaveBeenCalledWith({
      where: { taskId: "t1", inputType: "LOAD_WEIGHT_KG" },
      orderBy: { createdAt: "desc" },
    });
    expect(result).toEqual({
      loadWeightKg: 18,
      riskBand: "ELEVATED",
      riskScore: 3,
    });
  });

  it("returns null when the recorded value falls outside every seeded range, rather than a default band", async () => {
    vi.mocked(prisma.manualInput.findFirst).mockResolvedValue({
      value: 12,
    } as never);
    vi.mocked(prisma.manualHandlingRule.findMany).mockResolvedValue([]);

    const result = await computeManualHandlingResult({
      taskId: "t1",
      methodologyVersion: "v2-2026-08",
    });

    expect(result).toBeNull();
  });
});
