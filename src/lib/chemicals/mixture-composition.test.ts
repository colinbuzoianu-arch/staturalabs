import { describe, expect, it } from "vitest";
import {
  conservativeConcentrationPct,
  parseConcentration,
  validateComposition,
} from "./mixture-composition";

describe("parseConcentration", () => {
  it("parses a range", () => {
    expect(parseConcentration("25-50%")).toEqual({
      exactPct: null,
      minPct: 25,
      maxPct: 50,
    });
    expect(parseConcentration("25 – 50 %")).toEqual({
      exactPct: null,
      minPct: 25,
      maxPct: 50,
    });
  });
  it("parses >= and <=", () => {
    expect(parseConcentration("≥ 99%")).toEqual({
      exactPct: null,
      minPct: 99,
      maxPct: 100,
    });
    expect(parseConcentration("<1%")).toEqual({
      exactPct: null,
      minPct: 0,
      maxPct: 1,
    });
  });
  it("parses exact", () => {
    expect(parseConcentration("10 %")).toEqual({
      exactPct: 10,
      minPct: null,
      maxPct: null,
    });
    expect(parseConcentration("0,5%")).toEqual({
      exactPct: 0.5,
      minPct: null,
      maxPct: null,
    });
  });
  it("returns all null for unknown", () => {
    expect(parseConcentration("Rest")).toEqual({
      exactPct: null,
      minPct: null,
      maxPct: null,
    });
    expect(parseConcentration(null)).toEqual({
      exactPct: null,
      minPct: null,
      maxPct: null,
    });
  });
});

describe("validateComposition", () => {
  it("accepts a valid composition", () => {
    const r = validateComposition([
      { name: "Aceton", casNumber: "67-64-1", concentrationExactPct: 60 },
      {
        name: "Ethanol",
        casNumber: "64-17-5",
        concentrationMinPct: 10,
        concentrationMaxPct: 30,
      },
    ]);
    expect(r.errors).toEqual([]);
  });
  it("flags exact sum > 100", () => {
    const r = validateComposition([
      { name: "A", concentrationExactPct: 60 },
      { name: "B", concentrationExactPct: 60 },
    ]);
    expect(r.errors.join()).toContain("> 100");
  });
  it("errors on exact+range both set and min>max", () => {
    expect(
      validateComposition([
        { name: "A", concentrationExactPct: 5, concentrationMinPct: 1 },
      ]).errors.length,
    ).toBeGreaterThan(0);
    expect(
      validateComposition([
        { name: "A", concentrationMinPct: 50, concentrationMaxPct: 10 },
      ]).errors.join(),
    ).toContain("above max");
  });
  it("warns on a bad CAS checksum and duplicate CAS", () => {
    const r = validateComposition([
      { name: "A", casNumber: "67-64-2", concentrationExactPct: 10 },
      { name: "B", casNumber: "64-17-5", concentrationExactPct: 10 },
      { name: "C", casNumber: "64-17-5", concentrationExactPct: 10 },
    ]);
    expect(r.warnings.join()).toContain("checksum");
    expect(r.warnings.join()).toContain("Duplicate");
  });
});

describe("conservativeConcentrationPct", () => {
  it("uses exact, else the range max", () => {
    expect(conservativeConcentrationPct({ concentrationExactPct: 12 })).toEqual(
      { value: 12, basis: "exact" },
    );
    expect(
      conservativeConcentrationPct({
        concentrationMinPct: 10,
        concentrationMaxPct: 30,
      }),
    ).toEqual({ value: 30, basis: "range-max" });
    expect(conservativeConcentrationPct({})).toEqual({
      value: null,
      basis: "unknown",
    });
  });
});

import { parseNumericProperty } from "./mixture-composition";

describe("parseNumericProperty", () => {
  it("parses a leading number with units/unicode minus", () => {
    expect(parseNumericProperty("0.79 g/cm³")).toBe(0.79);
    expect(parseNumericProperty("-17 °C")).toBe(-17);
    expect(parseNumericProperty("−95 °C")).toBe(-95);
    expect(parseNumericProperty("56 °C (closed cup)")).toBe(56);
    expect(parseNumericProperty("0,82 g/cm³")).toBe(0.82);
  });
  it("returns null when there is no number", () => {
    expect(parseNumericProperty("insoluble")).toBeNull();
    expect(parseNumericProperty(null)).toBeNull();
  });
});
