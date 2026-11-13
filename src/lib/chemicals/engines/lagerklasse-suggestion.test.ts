import { describe, expect, it } from "vitest";
import {
  type LagerklasseRule,
  suggestLagerklasse,
} from "./lagerklasse-suggestion";

// Illustrative FIXTURE scheme — not the real TRGS 510 scheme.
const scheme: LagerklasseRule[] = [
  {
    lagerklasse: "3",
    requiresFlammablePictogram: true,
    anyHCode: ["H224", "H225", "H226"],
    priority: 1,
  },
  { lagerklasse: "8B", anyHCode: ["H314", "H318"], priority: 2 },
  { lagerklasse: "10", anyHCode: ["H319"], priority: 3 },
];

describe("suggestLagerklasse (scheme supplied by TRGS 510 config)", () => {
  it("refuses without a loaded scheme", () => {
    expect(
      suggestLagerklasse({ hCodes: ["H225"], pictograms: ["GHS02"] }, []).value,
    ).toBeNull();
  });
  it("suggests the first matching rule by priority", () => {
    expect(
      suggestLagerklasse(
        { hCodes: ["H225", "H319"], pictograms: ["GHS02"] },
        scheme,
      ).value,
    ).toBe("3");
  });
  it("skips a flammable rule when GHS02 is absent", () => {
    expect(
      suggestLagerklasse({ hCodes: ["H225"], pictograms: ["GHS07"] }, scheme)
        .value,
    ).toBeNull();
  });
  it("matches a lower-priority rule when the first does not apply", () => {
    expect(
      suggestLagerklasse({ hCodes: ["H319"], pictograms: [] }, scheme).value,
    ).toBe("10");
  });
});
