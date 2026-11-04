import { describe, expect, it } from "vitest";
import {
  autoDetectMapping,
  buildImportPlan,
  type ImportContext,
  parseCsv,
} from "./csv-import";

describe("parseCsv", () => {
  it("parses a simple grid with a header", () => {
    expect(parseCsv("a,b\n1,2\n3,4")).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });
  it("handles quoted commas and escaped quotes", () => {
    expect(parseCsv('name,note\n"Doe, John","said ""hi"""')).toEqual([
      ["name", "note"],
      ["Doe, John", 'said "hi"'],
    ]);
  });
  it("handles newlines inside quotes", () => {
    expect(parseCsv('a\n"line1\nline2"')).toEqual([["a"], ["line1\nline2"]]);
  });
  it("drops empty trailing rows", () => {
    expect(parseCsv("a\n1\n\n")).toEqual([["a"], ["1"]]);
  });
});

describe("autoDetectMapping", () => {
  it("maps German and English headers case-insensitively", () => {
    expect(
      autoDetectMapping(["Vorname", "Nachname", "Personalnummer", "Abteilung"]),
    ).toEqual({
      firstName: 0,
      lastName: 1,
      personnelNumber: 2,
      orgUnitName: 3,
    });
  });
  it("ignores unknown headers", () => {
    expect(autoDetectMapping(["first name", "mystery"])).toEqual({
      firstName: 0,
    });
  });
});

describe("buildImportPlan", () => {
  const ctx: ImportContext = {
    existingByPersonnelNumber: new Map([["P-1", "person-1"]]),
    orgUnitIdByName: new Map([["montage", "ou-montage"]]),
  };
  const mapping = {
    firstName: 0,
    lastName: 1,
    personnelNumber: 2,
    orgUnitName: 3,
    employmentStart: 4,
  };

  it("classifies create / update / error and resolves org unit", () => {
    const plan = buildImportPlan(
      [
        ["Anna", "Berger", "P-9", "Montage", "2026-01-15"], // create
        ["Bernd", "Hofer", "P-1", "", ""], // update (P-1 exists)
        ["", "NoFirst", "P-2", "", ""], // error: missing-name
        ["Clara", "Mayer", "P-3", "Unknown", ""], // error: unknown-org-unit
        ["Dora", "Klein", "P-4", "", "15.01.2026"], // error: invalid-date
      ],
      mapping,
      ctx,
    );
    expect(plan.summary).toEqual({ create: 1, update: 1, error: 3 });
    expect(plan.rows[0]).toMatchObject({
      action: "create",
      values: { orgUnitId: "ou-montage", employmentStart: "2026-01-15" },
    });
    expect(plan.rows[1]).toMatchObject({
      action: "update",
      existingPersonId: "person-1",
    });
    expect(plan.rows[2]).toMatchObject({
      action: "error",
      reason: "missing-name",
    });
    expect(plan.rows[3]).toMatchObject({
      action: "error",
      reason: "unknown-org-unit",
    });
    expect(plan.rows[4]).toMatchObject({
      action: "error",
      reason: "invalid-date",
    });
  });

  it("creates (not updates) a row whose personnel number is new or absent", () => {
    const plan = buildImportPlan([["X", "Y", "", "", ""]], mapping, ctx);
    expect(plan.summary.create).toBe(1);
    expect(plan.rows[0].action).toBe("create");
  });
});
