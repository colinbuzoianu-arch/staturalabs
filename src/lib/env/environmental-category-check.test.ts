import { describe, expect, it } from "vitest";
import type { EnvironmentalAspectCategory } from "@/generated/prisma/enums";
import {
  ALL_ENVIRONMENTAL_CATEGORIES,
  canSubmitForReview,
  type EnvironmentalCategoryCheckLike,
  initialCategoryCheckRows,
  statusAfterFindingAdded,
} from "./environmental-category-check";

function checksWith(
  overrides: Partial<
    Record<
      EnvironmentalAspectCategory,
      EnvironmentalCategoryCheckLike["status"]
    >
  >,
): EnvironmentalCategoryCheckLike[] {
  return ALL_ENVIRONMENTAL_CATEGORIES.map((category) => ({
    category,
    status: overrides[category] ?? "CHECKED_NO_HAZARD",
  }));
}

describe("environmental canSubmitForReview (pure)", () => {
  it("is ok when every category is assessed and findings are consistent", () => {
    const checks = checksWith({ WASTE_HAZARDOUS: "HAZARD_PRESENT" });
    expect(canSubmitForReview(checks, ["WASTE_HAZARDOUS"])).toEqual({
      ok: true,
    });
  });

  it("blocks and names a still-open category", () => {
    const checks = checksWith({ ENERGY_USE: "OPEN" });
    const result = canSubmitForReview(checks, []);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.openCategories).toEqual(["ENERGY_USE"]);
  });

  it("treats a missing check row as open (fail-closed)", () => {
    const checks = ALL_ENVIRONMENTAL_CATEGORIES.filter(
      (c) => c !== "ODOUR",
    ).map((category) => ({ category, status: "CHECKED_NO_HAZARD" as const }));
    const result = canSubmitForReview(checks, []);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.openCategories).toEqual(["ODOUR"]);
  });

  it("flags HAZARD_PRESENT with no finding as inconsistent", () => {
    const checks = checksWith({ WASTEWATER: "HAZARD_PRESENT" });
    const result = canSubmitForReview(checks, []);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.inconsistentCategories).toEqual(["WASTEWATER"]);
  });
});

describe("environmental statusAfterFindingAdded (pure)", () => {
  it("always flips to HAZARD_PRESENT", () => {
    expect(statusAfterFindingAdded("OPEN")).toBe("HAZARD_PRESENT");
    expect(statusAfterFindingAdded("CHECKED_NO_HAZARD")).toBe("HAZARD_PRESENT");
  });
});

describe("environmental initialCategoryCheckRows (pure)", () => {
  it("seeds one OPEN row per environmental category", () => {
    const rows = initialCategoryCheckRows("ea1");
    expect(rows).toHaveLength(ALL_ENVIRONMENTAL_CATEGORIES.length);
    expect(new Set(rows.map((r) => r.category))).toEqual(
      new Set(ALL_ENVIRONMENTAL_CATEGORIES),
    );
    expect(rows.every((r) => r.status === "OPEN")).toBe(true);
    expect(rows.every((r) => r.environmentalAssessmentId === "ea1")).toBe(true);
  });
});
