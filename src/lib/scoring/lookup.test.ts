import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ScoringRuleModel } from "@/generated/prisma/models";

vi.mock("@/lib/prisma", () => ({
  prisma: { scoringRule: { findMany: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { lookupScoringRule, matchScoringRule } from "./lookup";

// Mirrors the seeded `v1-2026-07` rows from
// prisma/migrations/20260708161629_add_scoring_rule_and_seed_v1 and
// 20260709083741_add_neck_extension_rules (NECK's backward-extension
// rows), verified against the live DB when each migration was applied.
// Kept as a literal fixture rather than read from the DB — these are unit
// tests: fast, deterministic, no network/DB dependency. Update this
// fixture if v1-2026-07's rows ever change.
const TRUNK = [
  { riskBand: "LOW", riskScore: 1, angleMin: 0, angleMax: 20 },
  { riskBand: "MODERATE", riskScore: 2, angleMin: 20, angleMax: 60 },
  { riskBand: "HIGH", riskScore: 3, angleMin: 60, angleMax: null },
];

// Non-monotonic around 0°, same shape as ELBOW below: forward flexion
// (positive) and backward extension (negative) each get their own
// MODERATE/HIGH rows, added later once a real capture (a normal backward
// head tilt) turned up "no threshold matched" — v1-2026-07 originally only
// covered forward flexion. The two HIGH rows deliberately carry different
// riskScores (3 forward, 4 backward).
const NECK = [
  { riskBand: "HIGH", riskScore: 4, angleMin: null, angleMax: -20 },
  { riskBand: "ELEVATED", riskScore: 3, angleMin: -20, angleMax: -10 },
  { riskBand: "MODERATE", riskScore: 2, angleMin: -10, angleMax: 0 },
  { riskBand: "LOW", riskScore: 1, angleMin: 0, angleMax: 10 },
  { riskBand: "MODERATE", riskScore: 2, angleMin: 10, angleMax: 25 },
  { riskBand: "HIGH", riskScore: 3, angleMin: 25, angleMax: null },
];

const SHOULDER_LEFT = [
  { riskBand: "LOW", riskScore: 1, angleMin: 0, angleMax: 20 },
  { riskBand: "MODERATE", riskScore: 2, angleMin: 20, angleMax: 45 },
  { riskBand: "ELEVATED", riskScore: 3, angleMin: 45, angleMax: 90 },
  { riskBand: "HIGH", riskScore: 4, angleMin: 90, angleMax: null },
];

// SHOULDER_RIGHT/ELBOW_RIGHT/KNEE_RIGHT carry identical thresholds to their
// _LEFT counterparts in the seed (risk doesn't differ by side) — reused
// directly rather than retyped, but still exercised below to cover every
// seeded BodyRegion value, not just every distinct threshold shape.
const SHOULDER_RIGHT = SHOULDER_LEFT;

const ELBOW_LEFT = [
  { riskBand: "LOW", riskScore: 1, angleMin: 20, angleMax: 100 },
  { riskBand: "HIGH", riskScore: 3, angleMin: 100, angleMax: null },
  { riskBand: "HIGH", riskScore: 3, angleMin: null, angleMax: 20 },
];

const ELBOW_RIGHT = ELBOW_LEFT;

const KNEE_LEFT = [
  { riskBand: "LOW", riskScore: 1, angleMin: 0, angleMax: 10 },
  { riskBand: "MODERATE", riskScore: 2, angleMin: 10, angleMax: 60 },
  { riskBand: "HIGH", riskScore: 3, angleMin: 60, angleMax: null },
];

const KNEE_RIGHT = KNEE_LEFT;

describe("matchScoringRule", () => {
  describe("one case per body region per risk band (mirrors all 26 seeded v1-2026-07 rows)", () => {
    it.each([
      ["TRUNK", TRUNK, 10, "LOW"],
      ["TRUNK", TRUNK, 40, "MODERATE"],
      ["TRUNK", TRUNK, 75, "HIGH"],
      ["NECK", NECK, 5, "LOW"],
      ["NECK", NECK, 18, "MODERATE"],
      ["NECK", NECK, 30, "HIGH"],
      ["NECK", NECK, -5, "MODERATE"],
      ["NECK", NECK, -15, "ELEVATED"],
      ["NECK", NECK, -25, "HIGH"],
      ["SHOULDER_LEFT", SHOULDER_LEFT, 10, "LOW"],
      ["SHOULDER_LEFT", SHOULDER_LEFT, 30, "MODERATE"],
      ["SHOULDER_LEFT", SHOULDER_LEFT, 60, "ELEVATED"],
      ["SHOULDER_LEFT", SHOULDER_LEFT, 120, "HIGH"],
      ["SHOULDER_RIGHT", SHOULDER_RIGHT, 10, "LOW"],
      ["SHOULDER_RIGHT", SHOULDER_RIGHT, 30, "MODERATE"],
      ["SHOULDER_RIGHT", SHOULDER_RIGHT, 60, "ELEVATED"],
      ["SHOULDER_RIGHT", SHOULDER_RIGHT, 120, "HIGH"],
      ["ELBOW_LEFT", ELBOW_LEFT, 50, "LOW"],
      ["ELBOW_LEFT", ELBOW_LEFT, 10, "HIGH"],
      ["ELBOW_LEFT", ELBOW_LEFT, 150, "HIGH"],
      ["ELBOW_RIGHT", ELBOW_RIGHT, 50, "LOW"],
      ["ELBOW_RIGHT", ELBOW_RIGHT, 10, "HIGH"],
      ["ELBOW_RIGHT", ELBOW_RIGHT, 150, "HIGH"],
      ["KNEE_LEFT", KNEE_LEFT, 5, "LOW"],
      ["KNEE_LEFT", KNEE_LEFT, 30, "MODERATE"],
      ["KNEE_LEFT", KNEE_LEFT, 80, "HIGH"],
      ["KNEE_RIGHT", KNEE_RIGHT, 5, "LOW"],
      ["KNEE_RIGHT", KNEE_RIGHT, 30, "MODERATE"],
      ["KNEE_RIGHT", KNEE_RIGHT, 80, "HIGH"],
    ] as const)("%s at %d° -> %s", (_label, rules, angle, expectedBand) => {
      expect(matchScoringRule(rules, angle)?.riskBand).toBe(expectedBand);
    });
  });

  describe("boundary cases (angleMin inclusive, angleMax exclusive)", () => {
    it("TRUNK: 20.0° lands in MODERATE, not LOW (the case explicitly called out)", () => {
      expect(matchScoringRule(TRUNK, 20)?.riskBand).toBe("MODERATE");
      expect(matchScoringRule(TRUNK, 19.9)?.riskBand).toBe("LOW");
    });
    it("TRUNK: 0° (lower edge of the very first band) lands in LOW", () => {
      expect(matchScoringRule(TRUNK, 0)?.riskBand).toBe("LOW");
    });
    it("TRUNK: 60.0° lands in HIGH, 59.9° in MODERATE", () => {
      expect(matchScoringRule(TRUNK, 60)?.riskBand).toBe("HIGH");
      expect(matchScoringRule(TRUNK, 59.9)?.riskBand).toBe("MODERATE");
    });

    it("NECK: 10.0° lands in MODERATE, 9.9° in LOW", () => {
      expect(matchScoringRule(NECK, 10)?.riskBand).toBe("MODERATE");
      expect(matchScoringRule(NECK, 9.9)?.riskBand).toBe("LOW");
    });
    it("NECK: 25.0° lands in HIGH, 24.9° in MODERATE", () => {
      expect(matchScoringRule(NECK, 25)?.riskBand).toBe("HIGH");
      expect(matchScoringRule(NECK, 24.9)?.riskBand).toBe("MODERATE");
    });

    it("NECK backward extension: -20.0° lands in ELEVATED (its inclusive lower bound), just past it lands in HIGH", () => {
      expect(matchScoringRule(NECK, -20)?.riskBand).toBe("ELEVATED");
      expect(matchScoringRule(NECK, -20.1)?.riskBand).toBe("HIGH");
    });

    it("SHOULDER: each of 20.0°/45.0°/90.0° lands in the upper band, not the lower", () => {
      expect(matchScoringRule(SHOULDER_LEFT, 20)?.riskBand).toBe("MODERATE");
      expect(matchScoringRule(SHOULDER_LEFT, 19.9)?.riskBand).toBe("LOW");
      expect(matchScoringRule(SHOULDER_LEFT, 45)?.riskBand).toBe("ELEVATED");
      expect(matchScoringRule(SHOULDER_LEFT, 44.9)?.riskBand).toBe("MODERATE");
      expect(matchScoringRule(SHOULDER_LEFT, 90)?.riskBand).toBe("HIGH");
      expect(matchScoringRule(SHOULDER_LEFT, 89.9)?.riskBand).toBe("ELEVATED");
    });

    it("ELBOW (non-monotonic): 20.0° lands in LOW, not the below-20 HIGH band", () => {
      expect(matchScoringRule(ELBOW_LEFT, 20)?.riskBand).toBe("LOW");
      expect(matchScoringRule(ELBOW_LEFT, 19.9)?.riskBand).toBe("HIGH");
    });
    it("ELBOW (non-monotonic): 100.0° lands in the above-100 HIGH band, 99.9° in LOW", () => {
      expect(matchScoringRule(ELBOW_LEFT, 100)?.riskBand).toBe("HIGH");
      expect(matchScoringRule(ELBOW_LEFT, 99.9)?.riskBand).toBe("LOW");
    });

    it("KNEE: 10.0°/60.0° land in the upper band, not the lower", () => {
      expect(matchScoringRule(KNEE_LEFT, 10)?.riskBand).toBe("MODERATE");
      expect(matchScoringRule(KNEE_LEFT, 9.9)?.riskBand).toBe("LOW");
      expect(matchScoringRule(KNEE_LEFT, 60)?.riskBand).toBe("HIGH");
      expect(matchScoringRule(KNEE_LEFT, 59.9)?.riskBand).toBe("MODERATE");
    });
  });

  describe("no match is surfaced as null, never a silent default", () => {
    it("an empty rule set (a body region with nothing seeded, e.g. HIP) returns null", () => {
      expect(matchScoringRule([], 45)).toBeNull();
    });

    it("an angle outside every seeded range for a real region returns null", () => {
      // TRUNK has no rule covering negative angles in v1-2026-07.
      expect(matchScoringRule(TRUNK, -5)).toBeNull();
    });
  });

  describe("ambiguous rule sets", () => {
    it("throws rather than silently picking one of several overlapping matches", () => {
      const overlapping = [
        { riskBand: "LOW", riskScore: 1, angleMin: 0, angleMax: 50 },
        { riskBand: "MODERATE", riskScore: 2, angleMin: 30, angleMax: 100 },
      ];
      expect(() => matchScoringRule(overlapping, 40)).toThrow(/Ambiguous/);
    });
  });
});

describe("lookupScoringRule", () => {
  beforeEach(() => {
    vi.mocked(prisma.scoringRule.findMany).mockReset();
  });

  it("queries by bodyRegion + methodologyVersion and delegates to matchScoringRule", async () => {
    vi.mocked(prisma.scoringRule.findMany).mockResolvedValue(
      TRUNK as unknown as ScoringRuleModel[],
    );

    const result = await lookupScoringRule({
      bodyRegion: "TRUNK",
      angleDegrees: 40,
      methodologyVersion: "v1-2026-07",
    });

    expect(prisma.scoringRule.findMany).toHaveBeenCalledWith({
      where: { bodyRegion: "TRUNK", methodologyVersion: "v1-2026-07" },
    });
    expect(result?.riskBand).toBe("MODERATE");
  });

  it("returns null, not a default, when no rows come back for the (bodyRegion, methodologyVersion) pair", async () => {
    vi.mocked(prisma.scoringRule.findMany).mockResolvedValue([]);

    const result = await lookupScoringRule({
      bodyRegion: "HIP",
      angleDegrees: 45,
      methodologyVersion: "v1-2026-07",
    });

    expect(result).toBeNull();
  });
});
