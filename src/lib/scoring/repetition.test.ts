import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    repetitionRule: { findMany: vi.fn() },
    manualInput: { findFirst: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  computeRepetitionResult,
  lookupRepetitionRules,
  matchRepetitionRule,
} from "./repetition";

// Mirrors the seeded v2-2026-08 rows from
// prisma/migrations/20260818090000_add_repetition_rule, verified against
// the live DB when that migration was applied. Literal fixture, not read
// from the DB — fast, deterministic unit tests.
const RULES = [
  { riskBand: "LOW", riskScore: 1, minReps: 0, maxReps: 30 },
  { riskBand: "MODERATE", riskScore: 2, minReps: 30, maxReps: 60 },
  { riskBand: "ELEVATED", riskScore: 3, minReps: 60, maxReps: 120 },
  { riskBand: "HIGH", riskScore: 4, minReps: 120, maxReps: null },
] as const;

describe("matchRepetitionRule", () => {
  it.each([
    [0, "LOW"],
    [29, "LOW"],
    [30, "MODERATE"],
    [59, "MODERATE"],
    [60, "ELEVATED"],
    [119, "ELEVATED"],
    [120, "HIGH"],
    [450, "HIGH"],
  ] as const)("%d reps -> %s", (reps, expectedBand) => {
    expect(matchRepetitionRule(RULES, reps)?.riskBand).toBe(expectedBand);
  });

  it("returns null for an empty rule set, never a default band", () => {
    expect(matchRepetitionRule([], 40)).toBeNull();
  });

  it("throws rather than silently picking one of several overlapping matches", () => {
    const overlapping = [
      { riskBand: "LOW" as const, riskScore: 1, minReps: 0, maxReps: 50 },
      { riskBand: "MODERATE" as const, riskScore: 2, minReps: 25, maxReps: 75 },
    ];
    expect(() => matchRepetitionRule(overlapping, 40)).toThrow(/Ambiguous/);
  });
});

describe("lookupRepetitionRules", () => {
  beforeEach(() => {
    vi.mocked(prisma.repetitionRule.findMany).mockReset();
  });

  it("queries by methodologyVersion", async () => {
    vi.mocked(prisma.repetitionRule.findMany).mockResolvedValue(RULES as never);

    const result = await lookupRepetitionRules("v2-2026-08");

    expect(prisma.repetitionRule.findMany).toHaveBeenCalledWith({
      where: { methodologyVersion: "v2-2026-08" },
      select: {
        riskBand: true,
        riskScore: true,
        minReps: true,
        maxReps: true,
      },
    });
    expect(result).toEqual(RULES);
  });
});

describe("computeRepetitionResult", () => {
  beforeEach(() => {
    vi.mocked(prisma.manualInput.findFirst).mockReset();
    vi.mocked(prisma.repetitionRule.findMany).mockReset();
  });

  it("returns null when the task has no REPETITION_COUNT entry", async () => {
    vi.mocked(prisma.manualInput.findFirst).mockResolvedValue(null);

    const result = await computeRepetitionResult({
      taskId: "t1",
      methodologyVersion: "v2-2026-08",
    });

    expect(result).toBeNull();
    expect(prisma.repetitionRule.findMany).not.toHaveBeenCalled();
  });

  it("queries the most recent REPETITION_COUNT input and matches it against the active rules", async () => {
    vi.mocked(prisma.manualInput.findFirst).mockResolvedValue({
      value: 450,
    } as never);
    vi.mocked(prisma.repetitionRule.findMany).mockResolvedValue(RULES as never);

    const result = await computeRepetitionResult({
      taskId: "t1",
      methodologyVersion: "v2-2026-08",
    });

    expect(prisma.manualInput.findFirst).toHaveBeenCalledWith({
      where: { taskId: "t1", inputType: "REPETITION_COUNT" },
      orderBy: { createdAt: "desc" },
    });
    expect(result).toEqual({
      repetitionCount: 450,
      riskBand: "HIGH",
      riskScore: 4,
    });
  });

  it("returns null when the recorded value falls outside every seeded range, rather than a default band", async () => {
    vi.mocked(prisma.manualInput.findFirst).mockResolvedValue({
      value: 40,
    } as never);
    vi.mocked(prisma.repetitionRule.findMany).mockResolvedValue([]);

    const result = await computeRepetitionResult({
      taskId: "t1",
      methodologyVersion: "v2-2026-08",
    });

    expect(result).toBeNull();
  });
});
