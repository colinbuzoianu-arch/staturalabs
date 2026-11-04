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
  it("valid while validUntil is in the future", () => {
    expect(instructionCellStatus(true, new Date("2027-01-01Z"), now)).toBe(
      "valid",
    );
  });
  it("expired once validUntil has passed", () => {
    expect(instructionCellStatus(true, new Date("2026-01-01Z"), now)).toBe(
      "expired",
    );
  });
});

describe("buildInstructionMatrix", () => {
  const persons = [{ id: "p1" }, { id: "p2" }];
  const types = [{ id: "t1" }, { id: "t2" }];

  it("fills every person×type cell and counts due", () => {
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
        }, // expired
        { personId: "p2", requirementTypeId: "t1", validUntil: null }, // valid (indefinite)
        // p2/t2 → missing
      ],
      now,
    );
    expect(cells).toHaveLength(4);
    const byKey = new Map(
      cells.map((c) => [`${c.personId}:${c.requirementTypeId}`, c.status]),
    );
    expect(byKey.get("p1:t1")).toBe("valid");
    expect(byKey.get("p1:t2")).toBe("expired");
    expect(byKey.get("p2:t1")).toBe("valid");
    expect(byKey.get("p2:t2")).toBe("missing");
    expect(dueCount).toBe(2); // p1:t2 expired + p2:t2 missing
  });

  it("keeps the strongest record per cell (indefinite beats dated; later beats earlier)", () => {
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
      now,
    );
    expect(cells[0].status).toBe("valid");
    expect(cells[0].validUntil?.toISOString().slice(0, 10)).toBe("2028-01-01");
  });
});
