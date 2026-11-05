import { describe, expect, it } from "vitest";
import {
  percentage,
  ratePerMillionHours,
  ratePerThousand,
  ratio,
  roundTo,
} from "./kpi-formulas";

describe("KPI formulas (P12)", () => {
  it("accident rate per 1000 employees", () => {
    expect(ratePerThousand(3, 150)).toBe(20);
    expect(ratePerThousand(3, 0)).toBeNull();
    expect(ratePerThousand(3, null)).toBeNull();
  });

  it("accident rate per million hours", () => {
    expect(ratePerMillionHours(5, 2_500_000)).toBe(2);
    expect(ratePerMillionHours(5, null)).toBeNull();
  });

  it("ratio and percentage guard the denominator", () => {
    expect(ratio(4, 2)).toBe(2);
    expect(ratio(4, 0)).toBeNull();
    expect(percentage(1, 4)).toBe(25);
    expect(percentage(1, 0)).toBeNull();
  });

  it("roundTo passes null through", () => {
    expect(roundTo(20.126, 2)).toBe(20.13);
    expect(roundTo(null, 2)).toBeNull();
  });
});
