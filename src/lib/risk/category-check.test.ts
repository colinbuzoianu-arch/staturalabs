import { describe, expect, it } from "vitest";
import type { HazardCategory } from "@/generated/prisma/enums";
import {
  ALL_HAZARD_CATEGORIES,
  backfillStatusForCategory,
  canSubmitForReview,
  type HazardCategoryCheckLike,
  initialCategoryCheckRows,
  statusAfterFindingAdded,
} from "./category-check";

// A helper that builds a full 13-row check set, then lets a test override
// specific categories — so "everything assessed except NOISE" stays
// readable.
function checksWith(
  overrides: Partial<Record<HazardCategory, HazardCategoryCheckLike["status"]>>,
): HazardCategoryCheckLike[] {
  return ALL_HAZARD_CATEGORIES.map((category) => ({
    category,
    status: overrides[category] ?? "CHECKED_NO_HAZARD",
  }));
}

describe("canSubmitForReview (pure)", () => {
  it("is ok when every category has a human-set status and no finding contradicts it", () => {
    const checks = checksWith({ NOISE: "HAZARD_PRESENT" });
    expect(canSubmitForReview(checks, ["NOISE"])).toEqual({ ok: true });
  });

  it("blocks and names the single still-open category", () => {
    const checks = checksWith({ NOISE: "OPEN" });
    const result = canSubmitForReview(checks, []);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.openCategories).toEqual(["NOISE"]);
    expect(result.inconsistentCategories).toEqual([]);
  });

  it("treats a category with no check row at all as open (fail-closed), not satisfied", () => {
    const checks = ALL_HAZARD_CATEGORIES.filter(
      (category) => category !== "RADIATION",
    ).map((category) => ({
      category,
      status: "CHECKED_NO_HAZARD" as const,
    }));
    const result = canSubmitForReview(checks, []);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.openCategories).toEqual(["RADIATION"]);
  });

  it("does not let a finding alone satisfy an OPEN category — a human must still set the status", () => {
    const checks = checksWith({ NOISE: "OPEN" });
    const result = canSubmitForReview(checks, ["NOISE"]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.openCategories).toEqual(["NOISE"]);
  });

  it("flags HAZARD_PRESENT with no finding as inconsistent", () => {
    const checks = checksWith({ NOISE: "HAZARD_PRESENT" });
    const result = canSubmitForReview(checks, []);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.inconsistentCategories).toEqual(["NOISE"]);
    expect(result.openCategories).toEqual([]);
  });

  it("flags CHECKED_NO_HAZARD / NOT_APPLICABLE contradicted by an existing finding as inconsistent", () => {
    const checks = checksWith({
      NOISE: "CHECKED_NO_HAZARD",
      CHEMICAL: "NOT_APPLICABLE",
    });
    const result = canSubmitForReview(checks, ["NOISE", "CHEMICAL"]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.inconsistentCategories).toEqual(["NOISE", "CHEMICAL"]);
  });

  it("reports every open category when several are unassessed", () => {
    const checks = checksWith({ NOISE: "OPEN", VIBRATION: "OPEN" });
    const result = canSubmitForReview(checks, []);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.openCategories).toEqual(["NOISE", "VIBRATION"]);
  });
});

describe("statusAfterFindingAdded (pure)", () => {
  it("flips any prior status to HAZARD_PRESENT", () => {
    expect(statusAfterFindingAdded("OPEN")).toBe("HAZARD_PRESENT");
    expect(statusAfterFindingAdded("CHECKED_NO_HAZARD")).toBe("HAZARD_PRESENT");
    expect(statusAfterFindingAdded("NOT_APPLICABLE")).toBe("HAZARD_PRESENT");
    expect(statusAfterFindingAdded("HAZARD_PRESENT")).toBe("HAZARD_PRESENT");
    expect(statusAfterFindingAdded(undefined)).toBe("HAZARD_PRESENT");
  });
});

describe("initialCategoryCheckRows (pure)", () => {
  it("seeds exactly one OPEN row per hazard category", () => {
    const rows = initialCategoryCheckRows("ra1");
    expect(rows).toHaveLength(ALL_HAZARD_CATEGORIES.length);
    expect(new Set(rows.map((r) => r.category))).toEqual(
      new Set(ALL_HAZARD_CATEGORIES),
    );
    expect(rows.every((r) => r.status === "OPEN")).toBe(true);
    expect(rows.every((r) => r.riskAssessmentId === "ra1")).toBe(true);
  });
});

describe("backfillStatusForCategory (pure)", () => {
  it("maps an existing finding to HAZARD_PRESENT and no finding to OPEN", () => {
    expect(backfillStatusForCategory(true)).toBe("HAZARD_PRESENT");
    expect(backfillStatusForCategory(false)).toBe("OPEN");
  });
});
