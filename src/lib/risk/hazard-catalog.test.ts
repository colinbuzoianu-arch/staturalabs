import { describe, expect, it } from "vitest";
import { isOtherHazardCode } from "./hazard-catalog";

describe("isOtherHazardCode (pure)", () => {
  it("recognises the -99 fallback rows across categories", () => {
    expect(isOtherHazardCode("MECH-99")).toBe(true);
    expect(isOtherHazardCode("PSYCH-99")).toBe(true);
    expect(isOtherHazardCode("RAD-99")).toBe(true);
  });

  it("does not match a normal catalogue code", () => {
    expect(isOtherHazardCode("MECH-01")).toBe(false);
    expect(isOtherHazardCode("NOISE-02")).toBe(false);
    expect(isOtherHazardCode("PSYCH-09")).toBe(false);
  });
});
