import { describe, expect, it } from "vitest";
import { defaultEngineFlagState, effectiveEngineState } from "./environment";

describe("defaultEngineFlagState", () => {
  it("production → OFF, sandbox → PREVIEW", () => {
    expect(defaultEngineFlagState("production")).toBe("OFF");
    expect(defaultEngineFlagState("sandbox")).toBe("PREVIEW");
  });
});

describe("effectiveEngineState", () => {
  it("no setting → the environment default", () => {
    expect(effectiveEngineState(null, false, "production")).toBe("OFF");
    expect(effectiveEngineState(null, false, "sandbox")).toBe("PREVIEW");
  });
  it("honours an explicit OFF/PREVIEW", () => {
    expect(effectiveEngineState("OFF", false, "sandbox")).toBe("OFF");
    expect(effectiveEngineState("PREVIEW", false, "production")).toBe(
      "PREVIEW",
    );
  });
  it("VALIDATED with a current review stays VALIDATED", () => {
    expect(effectiveEngineState("VALIDATED", true, "production")).toBe(
      "VALIDATED",
    );
  });
  it("VALIDATED without a current review fails safe to PREVIEW", () => {
    expect(effectiveEngineState("VALIDATED", false, "production")).toBe(
      "PREVIEW",
    );
  });
});
