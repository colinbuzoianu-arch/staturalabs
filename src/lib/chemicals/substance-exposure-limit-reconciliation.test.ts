import { describe, expect, it } from "vitest";
import {
  jurisdictionForCountry,
  reconcileSubstanceExposureLimits,
  type SubstanceExposureLimitImportRow,
} from "./substance-exposure-limit-reconciliation";

const row = (
  o: Partial<SubstanceExposureLimitImportRow> = {},
): SubstanceExposureLimitImportRow => ({
  jurisdiction: "AT",
  casNumber: "67-64-1",
  ecNumber: "200-662-2",
  substanceName: "Aceton",
  limitType: "MAK",
  value: 1200,
  unit: "mg/m³",
  averagingPeriod: "8h",
  sourceName: "GKV Anhang I",
  ...o,
});

describe("jurisdictionForCountry", () => {
  it("maps AT/DE/CH and nulls RO", () => {
    expect(jurisdictionForCountry("AT")).toBe("AT");
    expect(jurisdictionForCountry("DE")).toBe("DE");
    expect(jurisdictionForCountry("CH")).toBe("CH");
    expect(jurisdictionForCountry("RO")).toBeNull();
  });
});

describe("reconcileSubstanceExposureLimits", () => {
  it("passes a clean set", () => {
    const r = reconcileSubstanceExposureLimits([
      row(),
      row({ limitType: "TRK", value: 50 }),
    ]);
    expect(r.passed).toBe(true);
    expect(r.acceptedRows).toBe(2);
  });
  it("accepts a reference-only row (value null, unit omitted)", () => {
    const r = reconcileSubstanceExposureLimits([
      row({ value: null, unit: null }),
    ]);
    expect(r.passed).toBe(true);
  });
  it("fails a value with a non-whitelisted unit", () => {
    const r = reconcileSubstanceExposureLimits([row({ unit: "bananas" })]);
    expect(r.passed).toBe(false);
    expect(r.errors.join()).toContain("unit not whitelisted");
  });
  it("fails a bad CAS checksum", () => {
    const r = reconcileSubstanceExposureLimits([row({ casNumber: "67-64-2" })]);
    expect(r.passed).toBe(false);
  });
  it("fails a duplicate jurisdiction+cas+type+period key", () => {
    const r = reconcileSubstanceExposureLimits([row(), row()]);
    expect(r.passed).toBe(false);
    expect(r.errors.join()).toContain("duplicate");
  });
  it("fails a missing jurisdiction", () => {
    const r = reconcileSubstanceExposureLimits([row({ jurisdiction: "  " })]);
    expect(r.passed).toBe(false);
  });
  it("fails an expected-row-count mismatch", () => {
    const r = reconcileSubstanceExposureLimits([row()], { expectedRows: 2 });
    expect(r.passed).toBe(false);
  });
});
