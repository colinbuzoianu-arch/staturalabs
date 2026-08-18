import { describe, expect, it } from "vitest";
import {
  derivePostureCategories,
  formatCategoryRange,
  type ScoringRuleRow,
} from "./posture-categories";

// Mirrors the real seeded v2-2026-08 ScoringRule rows exactly (queried
// live against the DB when this test was written — see the migrations
// this data traces to: 20260708161629_add_scoring_rule_and_seed_v1's
// TRUNK/NECK/SHOULDER/ELBOW/KNEE rows verbatim-copied into v2 by
// 20260817150000_add_hold_time, plus 20260818090100_add_wrist_scoring_
// rules). Literal fixture, not read from the DB — fast, deterministic
// unit tests, same precedent as manual-handling.test.ts/repetition.test.ts.
const ALL_RULES: ScoringRuleRow[] = [
  // TRUNK — 3 tiers, plain monotonic.
  {
    bodyRegion: "TRUNK",
    riskBand: "LOW",
    riskScore: 1,
    angleMin: 0,
    angleMax: 20,
  },
  {
    bodyRegion: "TRUNK",
    riskBand: "MODERATE",
    riskScore: 2,
    angleMin: 20,
    angleMax: 60,
  },
  {
    bodyRegion: "TRUNK",
    riskBand: "HIGH",
    riskScore: 3,
    angleMin: 60,
    angleMax: null,
  },
  // NECK — 6 tiers, signed: negative = backward extension, positive =
  // forward flexion, the two HIGH rows have DIFFERENT riskScores (4
  // backward, 3 forward) per CLAUDE.md's scoring-methodology section —
  // the exact case the plan calls out as likely to silently break.
  {
    bodyRegion: "NECK",
    riskBand: "HIGH",
    riskScore: 4,
    angleMin: null,
    angleMax: -20,
  },
  {
    bodyRegion: "NECK",
    riskBand: "ELEVATED",
    riskScore: 3,
    angleMin: -20,
    angleMax: -10,
  },
  {
    bodyRegion: "NECK",
    riskBand: "MODERATE",
    riskScore: 2,
    angleMin: -10,
    angleMax: 0,
  },
  {
    bodyRegion: "NECK",
    riskBand: "LOW",
    riskScore: 1,
    angleMin: 0,
    angleMax: 10,
  },
  {
    bodyRegion: "NECK",
    riskBand: "MODERATE",
    riskScore: 2,
    angleMin: 10,
    angleMax: 25,
  },
  {
    bodyRegion: "NECK",
    riskBand: "HIGH",
    riskScore: 3,
    angleMin: 25,
    angleMax: null,
  },
  // SHOULDER_LEFT — 4 tiers (LOW/MODERATE/ELEVATED/HIGH), the plan's other
  // named silent-breakage risk.
  {
    bodyRegion: "SHOULDER_LEFT",
    riskBand: "LOW",
    riskScore: 1,
    angleMin: 0,
    angleMax: 20,
  },
  {
    bodyRegion: "SHOULDER_LEFT",
    riskBand: "MODERATE",
    riskScore: 2,
    angleMin: 20,
    angleMax: 45,
  },
  {
    bodyRegion: "SHOULDER_LEFT",
    riskBand: "ELEVATED",
    riskScore: 3,
    angleMin: 45,
    angleMax: 90,
  },
  {
    bodyRegion: "SHOULDER_LEFT",
    riskBand: "HIGH",
    riskScore: 4,
    angleMin: 90,
    angleMax: null,
  },
  // KNEE_LEFT — 3 tiers, plain monotonic.
  {
    bodyRegion: "KNEE_LEFT",
    riskBand: "LOW",
    riskScore: 1,
    angleMin: 0,
    angleMax: 10,
  },
  {
    bodyRegion: "KNEE_LEFT",
    riskBand: "MODERATE",
    riskScore: 2,
    angleMin: 10,
    angleMax: 60,
  },
  {
    bodyRegion: "KNEE_LEFT",
    riskBand: "HIGH",
    riskScore: 3,
    angleMin: 60,
    angleMax: null,
  },
  // ELBOW_LEFT — HIGH/LOW/HIGH, non-monotonic with a shared riskScore on
  // both HIGH rows (unlike NECK) and an open-min first row.
  {
    bodyRegion: "ELBOW_LEFT",
    riskBand: "HIGH",
    riskScore: 3,
    angleMin: null,
    angleMax: 20,
  },
  {
    bodyRegion: "ELBOW_LEFT",
    riskBand: "LOW",
    riskScore: 1,
    angleMin: 20,
    angleMax: 100,
  },
  {
    bodyRegion: "ELBOW_LEFT",
    riskBand: "HIGH",
    riskScore: 3,
    angleMin: 100,
    angleMax: null,
  },
  // WRIST_LEFT — symmetric HIGH/LOW/HIGH around neutral, B8e's new region.
  {
    bodyRegion: "WRIST_LEFT",
    riskBand: "HIGH",
    riskScore: 3,
    angleMin: null,
    angleMax: -15,
  },
  {
    bodyRegion: "WRIST_LEFT",
    riskBand: "LOW",
    riskScore: 1,
    angleMin: -15,
    angleMax: 15,
  },
  {
    bodyRegion: "WRIST_LEFT",
    riskBand: "HIGH",
    riskScore: 3,
    angleMin: 15,
    angleMax: null,
  },
];

describe("derivePostureCategories", () => {
  it("TRUNK: 3 categories, plain monotonic ranges, midpoint representativeDegrees", () => {
    const categories = derivePostureCategories(ALL_RULES, "TRUNK");
    expect(categories).toHaveLength(3);
    expect(categories.map((c) => c.band)).toEqual(["LOW", "MODERATE", "HIGH"]);
    expect(categories.map((c) => c.ruleRange)).toEqual([
      [0, 20],
      [20, 60],
      [60, null],
    ]);
    expect(categories.map((c) => c.representativeDegrees)).toEqual([
      10, // midpoint of [0,20)
      40, // midpoint of [20,60)
      75, // open max: 60 + 15
    ]);
    expect(categories.map((c) => c.riskScore)).toEqual([1, 2, 3]);
  });

  it("NECK: 6 categories, both signs, sorted backward-extension-first, non-monotonic riskScore preserved", () => {
    const categories = derivePostureCategories(ALL_RULES, "NECK");
    expect(categories).toHaveLength(6);
    expect(categories.map((c) => c.band)).toEqual([
      "HIGH",
      "ELEVATED",
      "MODERATE",
      "LOW",
      "MODERATE",
      "HIGH",
    ]);
    expect(categories.map((c) => c.ruleRange)).toEqual([
      [null, -20],
      [-20, -10],
      [-10, 0],
      [0, 10],
      [10, 25],
      [25, null],
    ]);
    // The two HIGH bands must NOT collapse into "the same category twice"
    // — different riskScores (backward extension is scored worse than
    // forward flexion), and the derivation must not lose that distinction
    // by e.g. deduplicating on band alone.
    expect(categories[0].riskScore).toBe(4); // backward HIGH
    expect(categories[5].riskScore).toBe(3); // forward HIGH
    expect(categories.map((c) => c.representativeDegrees)).toEqual([
      -35, // open min: -20 - 15
      -15, // midpoint of [-20,-10)
      -5, // midpoint of [-10,0)
      5, // midpoint of [0,10)
      17.5, // midpoint of [10,25)
      40, // open max: 25 + 15
    ]);
  });

  it("SHOULDER_LEFT: 4 categories (LOW/MODERATE/ELEVATED/HIGH), count and boundaries from the data", () => {
    const categories = derivePostureCategories(ALL_RULES, "SHOULDER_LEFT");
    expect(categories).toHaveLength(4);
    expect(categories.map((c) => c.band)).toEqual([
      "LOW",
      "MODERATE",
      "ELEVATED",
      "HIGH",
    ]);
    expect(categories.map((c) => c.ruleRange)).toEqual([
      [0, 20],
      [20, 45],
      [45, 90],
      [90, null],
    ]);
    expect(categories.map((c) => c.representativeDegrees)).toEqual([
      10, 32.5, 67.5, 105,
    ]);
  });

  it("KNEE_LEFT: 3 categories, plain monotonic", () => {
    const categories = derivePostureCategories(ALL_RULES, "KNEE_LEFT");
    expect(categories).toHaveLength(3);
    expect(categories.map((c) => c.band)).toEqual(["LOW", "MODERATE", "HIGH"]);
    expect(categories.map((c) => c.representativeDegrees)).toEqual([5, 35, 75]);
  });

  it("ELBOW_LEFT: HIGH/LOW/HIGH with an open-min first row, shared riskScore on both HIGH rows", () => {
    const categories = derivePostureCategories(ALL_RULES, "ELBOW_LEFT");
    expect(categories).toHaveLength(3);
    expect(categories.map((c) => c.band)).toEqual(["HIGH", "LOW", "HIGH"]);
    expect(categories.map((c) => c.riskScore)).toEqual([3, 1, 3]);
    expect(categories.map((c) => c.representativeDegrees)).toEqual([
      5, // open min: 20 - 15
      60, // midpoint of [20,100)
      115, // open max: 100 + 15
    ]);
  });

  it("WRIST_LEFT: symmetric HIGH/LOW/HIGH around neutral (B8e region)", () => {
    const categories = derivePostureCategories(ALL_RULES, "WRIST_LEFT");
    expect(categories).toHaveLength(3);
    expect(categories.map((c) => c.band)).toEqual(["HIGH", "LOW", "HIGH"]);
    expect(categories.map((c) => c.representativeDegrees)).toEqual([
      -30, // open min: -15 - 15
      0, // midpoint of [-15,15)
      30, // open max: 15 + 15
    ]);
  });

  it("returns an empty array for a region with no rows in the given rule set", () => {
    expect(derivePostureCategories(ALL_RULES, "HIP")).toEqual([]);
  });

  describe("formatCategoryRange", () => {
    it.each([
      [[0, 20], "0–20°"],
      [[60, null], "≥60°"],
      [[null, -20], "<-20°"],
      [[null, null], "—"],
    ] as const)("%j -> %s", (range, expected) => {
      expect(formatCategoryRange([...range])).toBe(expected);
    });
  });

  it("re-matching every category's representativeDegrees against its own range never lands outside it", () => {
    for (const region of [
      "TRUNK",
      "NECK",
      "SHOULDER_LEFT",
      "KNEE_LEFT",
      "ELBOW_LEFT",
      "WRIST_LEFT",
    ] as const) {
      const categories = derivePostureCategories(ALL_RULES, region);
      for (const category of categories) {
        const [min, max] = category.ruleRange;
        const degrees = category.representativeDegrees;
        expect(degrees).toBeGreaterThanOrEqual(min ?? Number.NEGATIVE_INFINITY);
        expect(degrees).toBeLessThan(max ?? Number.POSITIVE_INFINITY);
      }
    }
  });
});
