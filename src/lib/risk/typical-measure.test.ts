import { describe, expect, it } from "vitest";
import {
  HIERARCHY_RANK,
  isHigherTier,
  orderTypicalMeasures,
  shouldShowStopHint,
} from "./typical-measure";

describe("orderTypicalMeasures", () => {
  it("orders by prevention tier, then by within-category order", () => {
    const input = [
      { id: "a", hierarchyOfControl: "PPE" as const, order: 1 },
      { id: "b", hierarchyOfControl: "ELIMINATION" as const, order: 9 },
      {
        id: "c",
        hierarchyOfControl: "ADMINISTRATIVE_CONTROL" as const,
        order: 2,
      },
      {
        id: "d",
        hierarchyOfControl: "ADMINISTRATIVE_CONTROL" as const,
        order: 1,
      },
      { id: "e", hierarchyOfControl: "ENGINEERING_CONTROL" as const, order: 5 },
    ];
    expect(orderTypicalMeasures(input).map((m) => m.id)).toEqual([
      "b", // ELIMINATION
      "e", // ENGINEERING_CONTROL
      "d", // ADMIN, order 1
      "c", // ADMIN, order 2
      "a", // PPE
    ]);
  });
  it("does not mutate its input", () => {
    const input = [
      { hierarchyOfControl: "PPE" as const, order: 1 },
      { hierarchyOfControl: "ELIMINATION" as const, order: 1 },
    ];
    const copy = [...input];
    orderTypicalMeasures(input);
    expect(input).toEqual(copy);
  });
});

describe("isHigherTier", () => {
  it("is true for elimination/substitution/engineering", () => {
    expect(isHigherTier("ELIMINATION")).toBe(true);
    expect(isHigherTier("SUBSTITUTION")).toBe(true);
    expect(isHigherTier("ENGINEERING_CONTROL")).toBe(true);
  });
  it("is false for administrative/PPE", () => {
    expect(isHigherTier("ADMINISTRATIVE_CONTROL")).toBe(false);
    expect(isHigherTier("PPE")).toBe(false);
  });
});

describe("shouldShowStopHint", () => {
  it("shows for a low-tier pick with no higher-tier action yet", () => {
    expect(shouldShowStopHint("PPE", false)).toBe(true);
    expect(shouldShowStopHint("ADMINISTRATIVE_CONTROL", false)).toBe(true);
  });
  it("is suppressed once a higher-tier action exists", () => {
    expect(shouldShowStopHint("PPE", true)).toBe(false);
    expect(shouldShowStopHint("ADMINISTRATIVE_CONTROL", true)).toBe(false);
  });
  it("never shows for a higher-tier pick", () => {
    expect(shouldShowStopHint("ELIMINATION", false)).toBe(false);
    expect(shouldShowStopHint("ENGINEERING_CONTROL", false)).toBe(false);
  });
});

describe("HIERARCHY_RANK", () => {
  it("ranks STOP order ascending", () => {
    expect(HIERARCHY_RANK.ELIMINATION).toBeLessThan(
      HIERARCHY_RANK.SUBSTITUTION,
    );
    expect(HIERARCHY_RANK.SUBSTITUTION).toBeLessThan(
      HIERARCHY_RANK.ENGINEERING_CONTROL,
    );
    expect(HIERARCHY_RANK.ENGINEERING_CONTROL).toBeLessThan(
      HIERARCHY_RANK.ADMINISTRATIVE_CONTROL,
    );
    expect(HIERARCHY_RANK.ADMINISTRATIVE_CONTROL).toBeLessThan(
      HIERARCHY_RANK.PPE,
    );
  });
});
