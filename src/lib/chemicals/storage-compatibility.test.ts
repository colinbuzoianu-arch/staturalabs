import { describe, expect, it } from "vitest";
import {
  checkZusammenlagerung,
  type StorageCompatibilityRuleLite,
} from "./storage-compatibility";

const rules: StorageCompatibilityRuleLite[] = [
  {
    lagerklasseA: "3",
    lagerklasseB: "5.1B",
    result: "NOT_ALLOWED",
    tableRef: "TRGS 510 Tab. 1",
  },
  {
    lagerklasseA: "3",
    lagerklasseB: "8B",
    result: "CONDITIONAL",
    conditionNote: "nur getrennt",
    tableRef: "TRGS 510 Tab. 1",
  },
  { lagerklasseA: "8A", lagerklasseB: "8B", result: "ALLOWED" },
];

describe("checkZusammenlagerung", () => {
  it("reports no matrix when rules empty (honest gap)", () => {
    const r = checkZusammenlagerung(["3", "8B"], []);
    expect(r.hasMatrix).toBe(false);
    expect(r.flags).toEqual([]);
  });
  it("flags a NOT_ALLOWED pair regardless of order", () => {
    const r = checkZusammenlagerung(["5.1B", "3"], rules);
    expect(r.hasMatrix).toBe(true);
    expect(r.flags).toHaveLength(1);
    expect(r.flags[0]).toMatchObject({
      result: "NOT_ALLOWED",
      tableRef: "TRGS 510 Tab. 1",
    });
  });
  it("flags a CONDITIONAL pair with its note", () => {
    const r = checkZusammenlagerung(["3", "8B"], rules);
    expect(r.flags[0]).toMatchObject({
      result: "CONDITIONAL",
      conditionNote: "nur getrennt",
    });
  });
  it("does not flag an ALLOWED pair", () => {
    const r = checkZusammenlagerung(["8A", "8B"], rules);
    expect(r.flags).toEqual([]);
  });
  it("ignores duplicate Lagerklassen and single-class locations", () => {
    expect(checkZusammenlagerung(["3", "3"], rules).flags).toEqual([]);
    expect(checkZusammenlagerung(["3"], rules).flags).toEqual([]);
  });
  it("flags all problem pairs in a multi-class location", () => {
    const r = checkZusammenlagerung(["3", "5.1B", "8B"], rules);
    // 3↔5.1B NOT_ALLOWED, 3↔8B CONDITIONAL, 5.1B↔8B no rule → 2 flags
    expect(r.flags).toHaveLength(2);
  });
});
