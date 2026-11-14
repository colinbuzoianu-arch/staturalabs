import { describe, expect, it } from "vitest";
import { assessEngineReadiness, type ReadinessInput } from "./data-readiness";

const base: ReadinessInput = {
  components: [],
  hStatementCodes: [],
  unNumber: null,
  flashPointKnown: false,
};
const byKey = (rs: ReturnType<typeof assessEngineReadiness>, k: string) =>
  rs.find((r) => r.engineKey === k)!;

describe("assessEngineReadiness", () => {
  it("nothing available: only SDS authoring is ready; others list missing inputs", () => {
    const rs = assessEngineReadiness(base);
    expect(byKey(rs, "sds.authoring").ready).toBe(true);
    expect(byKey(rs, "clp.mixtureCalculation").ready).toBe(false);
    expect(byKey(rs, "clp.mixtureCalculation").missing).toContain("components");
    expect(byKey(rs, "transport.classification").missing).toContain(
      "UN number",
    );
    expect(byKey(rs, "storage.lagerklasseSuggestion").missing).toContain(
      "H-statements",
    );
  });
  it("CLP ready with concentration + classification on every/some component", () => {
    const rs = assessEngineReadiness({
      ...base,
      components: [
        {
          hasConcentration: true,
          hasClassificationOrAte: true,
          hasDensity: false,
          hasWgk: false,
        },
      ],
    });
    expect(byKey(rs, "clp.mixtureCalculation").ready).toBe(true);
    expect(byKey(rs, "mixture.physicalEstimates").missing).toContain(
      "component densities",
    );
    expect(byKey(rs, "wgk.mixtureCalculation").missing).toContain(
      "component WGK",
    );
  });
  it("physical + WGK ready with densities / WGK present", () => {
    const rs = assessEngineReadiness({
      ...base,
      components: [
        {
          hasConcentration: true,
          hasClassificationOrAte: false,
          hasDensity: true,
          hasWgk: true,
        },
      ],
    });
    expect(byKey(rs, "mixture.physicalEstimates").ready).toBe(true);
    expect(byKey(rs, "wgk.mixtureCalculation").ready).toBe(true);
  });
  it("transport + lagerklasse ready from UN number / H-codes", () => {
    const rs = assessEngineReadiness({
      ...base,
      unNumber: "UN1090",
      hStatementCodes: ["H225"],
    });
    expect(byKey(rs, "transport.classification").ready).toBe(true);
    expect(byKey(rs, "storage.lagerklasseSuggestion").ready).toBe(true);
  });
  it("missing concentration on a component blocks the mixture engines", () => {
    const rs = assessEngineReadiness({
      ...base,
      components: [
        {
          hasConcentration: false,
          hasClassificationOrAte: true,
          hasDensity: true,
          hasWgk: true,
        },
      ],
    });
    expect(byKey(rs, "clp.mixtureCalculation").missing).toContain(
      "component concentrations",
    );
  });
});
