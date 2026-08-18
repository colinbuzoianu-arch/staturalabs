import { describe, expect, it } from "vitest";
import { deriveAppliedStandards } from "./applied-standards";

describe("deriveAppliedStandards", () => {
  it("returns nothing when no rule table has rows", () => {
    expect(
      deriveAppliedStandards({
        hasScoringRules: false,
        hasHoldTimeRules: false,
        hasManualHandlingRules: false,
        hasRepetitionRules: false,
      }),
    ).toEqual([]);
  });

  it("includes ISO 11228 / EN 1005-4 only when scoring rules exist", () => {
    const standards = deriveAppliedStandards({
      hasScoringRules: true,
      hasHoldTimeRules: false,
      hasManualHandlingRules: false,
      hasRepetitionRules: false,
    });
    expect(standards).toHaveLength(2);
    expect(standards.map((s) => s.reference).join(" ")).toContain("ISO 11228");
    expect(standards.map((s) => s.reference).join(" ")).toContain("EN 1005-4");
  });

  it("includes ISO 11226 only when hold-time rules exist", () => {
    const standards = deriveAppliedStandards({
      hasScoringRules: false,
      hasHoldTimeRules: true,
      hasManualHandlingRules: false,
      hasRepetitionRules: false,
    });
    expect(standards).toHaveLength(1);
    expect(standards[0].reference).toContain("ISO 11226");
  });

  it("includes ISO 11228-1 / EN 1005-2, naming §64 ASchG's no-mandated-method gap, only when manual-handling rules exist", () => {
    const standards = deriveAppliedStandards({
      hasScoringRules: false,
      hasHoldTimeRules: false,
      hasManualHandlingRules: true,
      hasRepetitionRules: false,
    });
    expect(standards).toHaveLength(1);
    expect(standards[0].reference).toContain("ISO 11228-1");
    expect(standards[0].reference).toContain("EN 1005-2");
    expect(standards[0].appliesTo).toContain("§64 ASchG");
    expect(standards[0].note).toContain("keine Methode vor");
  });

  it("includes ISO 11228-3 / EN 1005-5 only when repetition rules exist", () => {
    const standards = deriveAppliedStandards({
      hasScoringRules: false,
      hasHoldTimeRules: false,
      hasManualHandlingRules: false,
      hasRepetitionRules: true,
    });
    expect(standards).toHaveLength(1);
    expect(standards[0].reference).toContain("ISO 11228-3");
    expect(standards[0].reference).toContain("EN 1005-5");
  });

  it("includes all five when every rule table has rows", () => {
    const standards = deriveAppliedStandards({
      hasScoringRules: true,
      hasHoldTimeRules: true,
      hasManualHandlingRules: true,
      hasRepetitionRules: true,
    });
    expect(standards).toHaveLength(5);
  });
});
