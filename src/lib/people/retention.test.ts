import { describe, expect, it } from "vitest";
import {
  addDuration,
  isRetentionMatured,
  parseIsoDuration,
  resolveEffectiveRetention,
  retentionDueDate,
} from "./retention";

describe("parseIsoDuration", () => {
  it("parses Y/M/D combinations", () => {
    expect(parseIsoDuration("P10Y")).toEqual({ years: 10, months: 0, days: 0 });
    expect(parseIsoDuration("P1Y6M")).toEqual({ years: 1, months: 6, days: 0 });
    expect(parseIsoDuration("P30D")).toEqual({ years: 0, months: 0, days: 30 });
  });
  it("returns null for empty/invalid", () => {
    expect(parseIsoDuration(null)).toBeNull();
    expect(parseIsoDuration("")).toBeNull();
    expect(parseIsoDuration("10 years")).toBeNull();
    expect(parseIsoDuration("P")).toBeNull();
  });
});

describe("addDuration", () => {
  it("adds years", () => {
    expect(
      addDuration(new Date("2026-03-01Z"), { years: 10, months: 0, days: 0 })
        .toISOString()
        .slice(0, 10),
    ).toBe("2036-03-01");
  });
  it("clamps day to month length", () => {
    expect(
      addDuration(new Date("2026-01-31Z"), { years: 0, months: 1, days: 0 })
        .toISOString()
        .slice(0, 10),
    ).toBe("2026-02-28");
  });
});

describe("resolveEffectiveRetention", () => {
  it("uses the company setting when there is no statutory floor", () => {
    expect(
      resolveEffectiveRetention({
        companySettingRetention: "P10Y",
        catalogBasis: "NO_STATUTORY_PERIOD",
        catalogMinRetention: null,
      }),
    ).toEqual({ retention: "P10Y", basis: "POLICY_DEFAULT" });
  });
  it("never goes shorter than a statutory floor", () => {
    expect(
      resolveEffectiveRetention({
        companySettingRetention: "P1Y",
        catalogBasis: "STATUTORY",
        catalogMinRetention: "P5Y",
      }),
    ).toEqual({ retention: "P5Y", basis: "STATUTORY" });
  });
  it("keeps a longer company setting above the statutory floor", () => {
    expect(
      resolveEffectiveRetention({
        companySettingRetention: "P10Y",
        catalogBasis: "STATUTORY",
        catalogMinRetention: "P5Y",
      }),
    ).toEqual({ retention: "P10Y", basis: "STATUTORY" });
  });
  it("falls back to the catalogue when no company setting (no period)", () => {
    expect(
      resolveEffectiveRetention({
        companySettingRetention: null,
        catalogBasis: "NO_STATUTORY_PERIOD",
        catalogMinRetention: null,
      }),
    ).toEqual({ retention: null, basis: "NO_STATUTORY_PERIOD" });
  });
});

describe("retentionDueDate / isRetentionMatured", () => {
  const now = new Date("2026-11-04Z");
  it("computes the due date", () => {
    expect(
      retentionDueDate(new Date("2015-01-01Z"), "P10Y")
        ?.toISOString()
        .slice(0, 10),
    ).toBe("2025-01-01");
  });
  it("matured when the due date has passed", () => {
    expect(isRetentionMatured(new Date("2015-01-01Z"), "P10Y", now)).toBe(true);
  });
  it("not matured when the period is still running", () => {
    expect(isRetentionMatured(new Date("2020-01-01Z"), "P10Y", now)).toBe(
      false,
    );
  });
  it("never matures with no trigger date or no period", () => {
    expect(isRetentionMatured(null, "P10Y", now)).toBe(false);
    expect(isRetentionMatured(new Date("2000-01-01Z"), null, now)).toBe(false);
  });
});
