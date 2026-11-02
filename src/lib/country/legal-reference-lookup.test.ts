import { describe, expect, it } from "vitest";
import { matchLegalReferences } from "./legal-reference-lookup";

// Fixture rows (not seeded data — these mirror the SHAPE the founder-verified
// catalogue will hold). The point under test is the §3.15 no-cross-country
// -fallback rule and the multi-row-per-topic behaviour.
const ROWS = [
  { country: "AT" as const, topic: "risk-assessment", code: "ASchG §4" },
  { country: "AT" as const, topic: "instruction", code: "ASchG §14" },
  { country: "DE" as const, topic: "risk-assessment", code: "ArbSchG §5" },
  { country: "DE" as const, topic: "risk-assessment", code: "ArbSchG §6" },
];

describe("matchLegalReferences", () => {
  it("returns every reference for a country+topic", () => {
    const de = matchLegalReferences(ROWS, "DE", "risk-assessment");
    expect(de.map((r) => r.code).sort()).toEqual(["ArbSchG §5", "ArbSchG §6"]);
  });

  it("never falls back to another country (§3.15): a missing country/topic is empty", () => {
    // CH has no rows at all → honest gap, not AT's or DE's references.
    expect(matchLegalReferences(ROWS, "CH", "risk-assessment")).toEqual([]);
    // RO has no rows → empty, never a borrowed value.
    expect(matchLegalReferences(ROWS, "RO", "instruction")).toEqual([]);
    // AT has no "ppe" topic → empty, not DE's.
    expect(matchLegalReferences(ROWS, "AT", "ppe")).toEqual([]);
  });

  it("does not leak one country's reference into another's result", () => {
    const at = matchLegalReferences(ROWS, "AT", "risk-assessment");
    expect(at.every((r) => r.country === "AT")).toBe(true);
    expect(at.map((r) => r.code)).toEqual(["ASchG §4"]);
  });
});
