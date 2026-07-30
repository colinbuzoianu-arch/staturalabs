import { describe, expect, it } from "vitest";
import { riskBandRank, worstRiskBand } from "./band-severity";

describe("riskBandRank", () => {
  it("ranks bands from LOW to HIGH", () => {
    expect(riskBandRank("LOW")).toBeLessThan(riskBandRank("MODERATE"));
    expect(riskBandRank("MODERATE")).toBeLessThan(riskBandRank("ELEVATED"));
    expect(riskBandRank("ELEVATED")).toBeLessThan(riskBandRank("HIGH"));
  });
});

describe("worstRiskBand", () => {
  it("returns null for an empty list", () => {
    expect(worstRiskBand([])).toBeNull();
  });

  it("returns the single band for a one-element list", () => {
    expect(worstRiskBand(["MODERATE"])).toBe("MODERATE");
  });

  it("returns the most severe band regardless of input order", () => {
    expect(worstRiskBand(["LOW", "HIGH", "MODERATE"])).toBe("HIGH");
    expect(worstRiskBand(["HIGH", "LOW"])).toBe("HIGH");
    expect(worstRiskBand(["ELEVATED", "LOW", "MODERATE"])).toBe("ELEVATED");
  });

  it("returns LOW when every band is LOW", () => {
    expect(worstRiskBand(["LOW", "LOW"])).toBe("LOW");
  });
});
