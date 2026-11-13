import { describe, expect, it } from "vitest";
import {
  buildConfirmedPayload,
  emptySdsExtraction,
} from "./sds-extraction-schema";
import { diffSdsRevisions } from "./sds-revision-diff";

function confirmed(over: Record<string, unknown> = {}) {
  const base = buildConfirmedPayload(emptySdsExtraction());
  return { ...base, ...over };
}

describe("diffSdsRevisions", () => {
  it("returns nothing for a first revision (no prev)", () => {
    expect(
      diffSdsRevisions(null, confirmed({ classification: "Flam. Liq. 2" })),
    ).toEqual([]);
  });
  it("detects a changed scalar", () => {
    const d = diffSdsRevisions(
      confirmed({ classification: "Flam. Liq. 3" }),
      confirmed({ classification: "Flam. Liq. 2" }),
    );
    expect(d).toContainEqual({
      field: "Einstufung",
      kind: "changed",
      before: "Flam. Liq. 3",
      after: "Flam. Liq. 2",
    });
  });
  it("detects an added H statement", () => {
    const d = diffSdsRevisions(
      confirmed({ statementCodes: ["H225"] }),
      confirmed({ statementCodes: ["H225", "H336"] }),
    );
    expect(d).toContainEqual({
      field: "H/P/EUH",
      kind: "added",
      before: null,
      after: "H336",
    });
  });
  it("detects a removed pictogram", () => {
    const d = diffSdsRevisions(
      confirmed({ pictograms: ["GHS02", "GHS07"] }),
      confirmed({ pictograms: ["GHS02"] }),
    );
    expect(d).toContainEqual({
      field: "Piktogramme",
      kind: "removed",
      before: "GHS07",
      after: null,
    });
  });
  it("detects a new component by CAS", () => {
    const comp = (cas: string, name: string) => ({
      name,
      casNumber: cas,
      ecNumber: null,
      concentration: null,
      classification: null,
      specificConcentrationLimits: null,
      mFactor: null,
      acuteToxicityEstimate: null,
    });
    const d = diffSdsRevisions(
      confirmed({ components: [comp("67-64-1", "Aceton")] }),
      confirmed({
        components: [comp("67-64-1", "Aceton"), comp("64-17-5", "Ethanol")],
      }),
    );
    expect(d).toContainEqual({
      field: "Komponente",
      kind: "added",
      before: null,
      after: "Ethanol",
    });
  });
  it("sees no change when values are identical", () => {
    const x = confirmed({
      classification: "Flam. Liq. 2",
      statementCodes: ["H225"],
    });
    expect(diffSdsRevisions(x, { ...x })).toEqual([]);
  });
});
