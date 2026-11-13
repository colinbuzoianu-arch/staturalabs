import { describe, expect, it } from "vitest";
import {
  estimateBoilingRangeLowerBound,
  estimateFlashPoint,
  estimateMixtureDensity,
  type MixtureComponent,
} from "./physical-estimates";

describe("estimateMixtureDensity (mass-weighted ideal mixing)", () => {
  it("computes 1/ρ = Σ(w/ρ) for a binary mixture", () => {
    // 50% ethanol (0.789) + 50% water (0.997): 1/(0.5/0.789 + 0.5/0.997) = 0.8807...
    const r = estimateMixtureDensity([
      { name: "ethanol", massFraction: 0.5, density: 0.789 },
      { name: "water", massFraction: 0.5, density: 0.997 },
    ]);
    expect(r.marker).toBe("PREPARED_ENGINE");
    expect(r.value).toBeCloseTo(0.8807, 3);
  });
  it("returns the single density for a pure component", () => {
    expect(
      estimateMixtureDensity([{ massFraction: 1, density: 1.2 }]).value,
    ).toBeCloseTo(1.2, 6);
  });
  it("refuses when a density is missing", () => {
    const r = estimateMixtureDensity([
      { massFraction: 0.5, density: 0.8 },
      { name: "x", massFraction: 0.5 },
    ]);
    expect(r.value).toBeNull();
    expect(r.unavailableReason).toContain("missing density");
  });
  it("refuses when fractions do not sum to 1", () => {
    expect(
      estimateMixtureDensity([{ massFraction: 0.5, density: 0.8 }]).value,
    ).toBeNull();
  });
});

describe("estimateBoilingRangeLowerBound", () => {
  it("is the lowest component boiling point", () => {
    const comps: MixtureComponent[] = [
      { massFraction: 0.5, boilingPoint: 78 },
      { massFraction: 0.5, boilingPoint: 100 },
    ];
    expect(estimateBoilingRangeLowerBound(comps).value).toBe(78);
  });
  it("refuses when none known", () => {
    expect(
      estimateBoilingRangeLowerBound([{ massFraction: 1 }]).value,
    ).toBeNull();
  });
});

describe("estimateFlashPoint", () => {
  it("is the lowest component flash point (conservative)", () => {
    const comps: MixtureComponent[] = [
      { massFraction: 0.5, flashPoint: -17 },
      { massFraction: 0.5, flashPoint: 12 },
    ];
    expect(estimateFlashPoint(comps).value).toBe(-17);
  });
  it("refuses when none known", () => {
    expect(estimateFlashPoint([{ massFraction: 1 }]).value).toBeNull();
  });
});
