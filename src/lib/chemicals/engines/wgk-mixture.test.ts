import { describe, expect, it } from "vitest";
import { computeMixtureWgk } from "./wgk-mixture";

const rules = { wgk3MinPct: 0.1, wgk2MinPct: 3, wgk1MinPct: 3 };

describe("computeMixtureWgk (AwSV presence-threshold framework)", () => {
  it("refuses without loaded thresholds", () => {
    expect(
      computeMixtureWgk([{ concentrationPct: 5, wgk: 3 }], null).value,
    ).toBeNull();
  });
  it("takes WGK 3 when a small amount of a WGK-3 component is present", () => {
    expect(
      computeMixtureWgk([{ concentrationPct: 0.2, wgk: 3 }], rules).value,
    ).toBe(3);
  });
  it("takes WGK 2 when WGK-3+2 sum meets the wgk2 threshold but no WGK-3 threshold", () => {
    expect(
      computeMixtureWgk([{ concentrationPct: 5, wgk: 2 }], rules).value,
    ).toBe(2);
  });
  it("takes WGK 1 for a low-hazard mix meeting the wgk1 threshold", () => {
    expect(
      computeMixtureWgk([{ concentrationPct: 10, wgk: 1 }], rules).value,
    ).toBe(1);
  });
  it("returns nwg (null) below all thresholds", () => {
    expect(
      computeMixtureWgk([{ concentrationPct: 1, wgk: 1 }], rules).value,
    ).toBeNull();
  });
});
