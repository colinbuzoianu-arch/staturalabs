import { describe, expect, it } from "vitest";
import { computeAteMix, summationMethod } from "./clp-mixture";

describe("computeAteMix (CLP additivity formula)", () => {
  it("computes 100/Σ(C/ATE)", () => {
    // 20% @ ATE 500 + 80% @ ATE 5000 -> 100/(0.04+0.016) = 1785.71
    const r = computeAteMix([
      { concentrationPct: 20, ate: 500 },
      { concentrationPct: 80, ate: 5000 },
    ]);
    expect(r.value?.ateMix).toBeCloseTo(1785.71, 1);
    expect(r.value?.unknownPct).toBe(0);
  });
  it("reports the unknown fraction and excludes it from the sum", () => {
    const r = computeAteMix([
      { concentrationPct: 50, ate: 300 },
      { name: "unknown", concentrationPct: 50, ate: null },
    ]);
    expect(r.value?.ateMix).toBeCloseTo(600, 6); // 100/(50/300)
    expect(r.value?.unknownPct).toBe(50);
  });
  it("refuses when no ATE is known", () => {
    expect(computeAteMix([{ concentrationPct: 100 }]).value).toBeNull();
  });
});

describe("summationMethod (threshold supplied by the CLP config)", () => {
  it("meets the category when Σ(conc×multiplier) ≥ cut-off", () => {
    // two components at 2% with M-factor 10 -> 40 ≥ 25
    const r = summationMethod(
      [
        { concentrationPct: 2, multiplier: 10 },
        { concentrationPct: 2, multiplier: 10 },
      ],
      25,
    );
    expect(r.value?.sum).toBe(40);
    expect(r.value?.meetsCategory).toBe(true);
  });
  it("does not meet below the cut-off", () => {
    expect(
      summationMethod([{ concentrationPct: 1, multiplier: 1 }], 25).value
        ?.meetsCategory,
    ).toBe(false);
  });
  it("refuses without a cut-off (config not loaded)", () => {
    expect(
      summationMethod([{ concentrationPct: 10, multiplier: 1 }], 0).value,
    ).toBeNull();
  });
});
