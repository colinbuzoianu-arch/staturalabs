import { describe, expect, it } from "vitest";
import { computeEnvironmentalSignificance } from "./significance";

describe("computeEnvironmentalSignificance (pure)", () => {
  it("is significant at ELEVATED or HIGH band", () => {
    expect(
      computeEnvironmentalSignificance({
        riskBand: "ELEVATED",
        legallyRelevant: false,
      }),
    ).toBe(true);
    expect(
      computeEnvironmentalSignificance({
        riskBand: "HIGH",
        legallyRelevant: false,
      }),
    ).toBe(true);
  });

  it("is not significant at LOW/MODERATE band on its own", () => {
    expect(
      computeEnvironmentalSignificance({
        riskBand: "LOW",
        legallyRelevant: false,
      }),
    ).toBe(false);
    expect(
      computeEnvironmentalSignificance({
        riskBand: "MODERATE",
        legallyRelevant: false,
      }),
    ).toBe(false);
  });

  it("is significant whenever legally relevant, regardless of band", () => {
    expect(
      computeEnvironmentalSignificance({
        riskBand: "LOW",
        legallyRelevant: true,
      }),
    ).toBe(true);
  });
});
