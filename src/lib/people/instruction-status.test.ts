import { describe, expect, it } from "vitest";
import {
  buildInstructionMatrix,
  instructionCellStatus,
} from "./instruction-status";

const now = new Date("2026-11-04T00:00:00Z");

describe("instructionCellStatus", () => {
  it("missing when no record", () => {
    expect(instructionCellStatus(false, null, now)).toBe("missing");
  });
  it("valid when a record has no recurrence (null validUntil)", () => {
    expect(instructionCellStatus(true, null, now)).toBe("valid");
  });
  it("overdue once validUntil has passed", () => {
    expect(instructionCellStatus(true, new Date("2026-01-01Z"), now)).toBe(
      "overdue",
    );
  });
  it("due-soon within the lead window", () => {
    expect(instructionCellStatus(true, new Date("2026-11-20Z"), now, 30)).toBe(
      "due-soon",
    );
  });
  it("valid beyond the lead window", () => {
    expect(instructionCellStatus(true, new Date("2027-06-01Z"), now, 30)).toBe(
      "valid",
    );
  });
});

describe("buildInstructionMatrix", () => {
  const persons = [{ id: "p1" }, { id: "p2" }];
  const types = [{ id: "t1" }, { id: "t2" }];
  // p1 requires t1 and t2; p2 requires only t1.
  const requiredKeys = new Set(["p1:t1", "p1:t2", "p2:t1"]);

  it("marks non-required cells and counts only required-not-valid as due", () => {
    const { cells, dueCount } = buildInstructionMatrix(
      persons,
      types,
      [
        {
          personId: "p1",
          requirementTypeId: "t1",
          validUntil: new Date("2027-01-01Z"),
        }, // valid
        {
          personId: "p1",
          requirementTypeId: "t2",
          validUntil: new Date("2026-01-01Z"),
        }, // overdue
        // p2:t1 → missing
      ],
      requiredKeys,
      now,
      30,
    );
    const byKey = new Map(
      cells.map((c) => [`${c.personId}:${c.requirementTypeId}`, c]),
    );
    expect(byKey.get("p1:t1")?.status).toBe("valid");
    expect(byKey.get("p1:t2")?.status).toBe("overdue");
    expect(byKey.get("p2:t1")?.status).toBe("missing");
    // p2:t2 is not required → no status, required=false.
    expect(byKey.get("p2:t2")?.required).toBe(false);
    expect(byKey.get("p2:t2")?.status).toBeNull();
    expect(dueCount).toBe(2); // p1:t2 overdue + p2:t1 missing (p2:t2 not counted)
  });

  it("keeps the strongest record per cell", () => {
    const { cells } = buildInstructionMatrix(
      [{ id: "p1" }],
      [{ id: "t1" }],
      [
        {
          personId: "p1",
          requirementTypeId: "t1",
          validUntil: new Date("2026-01-01Z"),
        },
        {
          personId: "p1",
          requirementTypeId: "t1",
          validUntil: new Date("2028-01-01Z"),
        },
      ],
      new Set(["p1:t1"]),
      now,
    );
    expect(cells[0].status).toBe("valid");
    expect(cells[0].validUntil?.toISOString().slice(0, 10)).toBe("2028-01-01");
  });
});
