import { describe, expect, it } from "vitest";
import {
  type ClpStatementImportRow,
  casChecksumValid,
  reconcileClpStatements,
  reconcileTwoPass,
} from "./clp-import-reconciliation";

const row = (
  over: Partial<ClpStatementImportRow> = {},
): ClpStatementImportRow => ({
  kind: "H",
  code: "H225",
  textEn: "Highly flammable liquid and vapour.",
  textDe: "Flüssigkeit und Dampf leicht entzündbar.",
  sourceRef: "Annex III Part 1",
  ...over,
});

describe("casChecksumValid", () => {
  it("accepts valid CAS numbers", () => {
    expect(casChecksumValid("7732-18-5")).toBe(true); // water
    expect(casChecksumValid("79-01-6")).toBe(true); // trichloroethylene
    expect(casChecksumValid("50-00-0")).toBe(true); // formaldehyde
  });
  it("rejects a wrong check digit", () => {
    expect(casChecksumValid("7732-18-4")).toBe(false);
  });
  it("rejects malformed input, never throws", () => {
    expect(casChecksumValid("abc")).toBe(false);
    expect(casChecksumValid("7732185")).toBe(false);
    expect(casChecksumValid("")).toBe(false);
  });
});

describe("reconcileClpStatements", () => {
  it("passes a clean set", () => {
    const r = reconcileClpStatements([
      row(),
      row({ code: "H226" }),
      row({ kind: "P", code: "P280" }),
    ]);
    expect(r.passed).toBe(true);
    expect(r.acceptedRows).toBe(3);
    expect(r.errors).toEqual([]);
  });
  it("fails and lists a malformed code", () => {
    const r = reconcileClpStatements([row(), row({ code: "H100" })]);
    expect(r.passed).toBe(false);
    expect(r.excludedRows.some((e) => e.code === "H100")).toBe(true);
    expect(r.acceptedRows).toBe(1);
  });
  it("fails on a duplicate code", () => {
    const r = reconcileClpStatements([row(), row()]);
    expect(r.passed).toBe(false);
    expect(r.errors.join()).toContain("duplicate");
  });
  it("fails on missing DE text", () => {
    const r = reconcileClpStatements([row({ textDe: "  " })]);
    expect(r.passed).toBe(false);
  });
  it("fails on an expected-row-count mismatch", () => {
    const r = reconcileClpStatements([row()], { expectedRows: 2 });
    expect(r.passed).toBe(false);
    expect(r.errors.join()).toContain("expected 2");
  });
});

describe("reconcileTwoPass", () => {
  it("accepts only rows both passes agree on", () => {
    const a = [row(), row({ code: "H226" })];
    const b = [row(), row({ code: "H226", textDe: "ETWAS ANDERES" })];
    const { agreed, disagreements } = reconcileTwoPass(a, b);
    expect(agreed.map((r) => r.code)).toEqual(["H225"]);
    expect(disagreements.some((d) => d.code === "H226")).toBe(true);
  });
  it("lists codes present in only one pass", () => {
    const { disagreements } = reconcileTwoPass(
      [row()],
      [row(), row({ code: "H226" })],
    );
    expect(disagreements).toContainEqual({
      code: "H226",
      reason: "present in pass B only",
    });
  });
});
