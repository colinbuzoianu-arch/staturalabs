import { describe, expect, it } from "vitest";
import {
  type DerivationMaps,
  deriveRequiredTrainings,
} from "./requirement-derivation";

// Tree: plant → dept → line. ws1 in line, ws2 in dept.
const maps: DerivationMaps = {
  workstationOrgUnit: new Map([
    ["ws1", "line"],
    ["ws2", "dept"],
  ]),
  orgUnitAncestors: new Map([
    ["line", ["line", "dept", "plant"]],
    ["dept", ["dept", "plant"]],
    ["plant", ["plant"]],
  ]),
  processWorkstations: new Map([["proc1", new Set(["ws1"])]]),
};

describe("deriveRequiredTrainings", () => {
  it("matches a workstation requirement to an assigned person", () => {
    const out = deriveRequiredTrainings(
      [{ workstationId: "ws1", orgUnitId: null }],
      [
        {
          requirementTypeId: "t1",
          subjectType: "WORKSTATION",
          subjectId: "ws1",
        },
      ],
      maps,
    );
    expect(out).toHaveLength(1);
    expect(out[0].requirementTypeId).toBe("t1");
  });

  it("inherits an ancestor org-unit requirement down the tree", () => {
    // requirement on 'plant'; person assigned to ws1 (in line → dept → plant).
    const out = deriveRequiredTrainings(
      [{ workstationId: "ws1", orgUnitId: null }],
      [
        {
          requirementTypeId: "t1",
          subjectType: "ORG_UNIT",
          subjectId: "plant",
        },
      ],
      maps,
    );
    expect(out.map((r) => r.requirementTypeId)).toEqual(["t1"]);
  });

  it("does NOT apply a descendant requirement upward", () => {
    // requirement on 'line'; person assigned to ws2 (in dept, not line).
    const out = deriveRequiredTrainings(
      [{ workstationId: "ws2", orgUnitId: null }],
      [{ requirementTypeId: "t1", subjectType: "ORG_UNIT", subjectId: "line" }],
      maps,
    );
    expect(out).toHaveLength(0);
  });

  it("matches a process requirement via a hosting workstation", () => {
    const out = deriveRequiredTrainings(
      [{ workstationId: "ws1", orgUnitId: null }],
      [{ requirementTypeId: "t1", subjectType: "PROCESS", subjectId: "proc1" }],
      maps,
    );
    expect(out).toHaveLength(1);
  });

  it("ignores a SUBSTANCE source when no substanceSubjects map is given", () => {
    const out = deriveRequiredTrainings(
      [{ workstationId: "ws1", orgUnitId: null }],
      [
        {
          requirementTypeId: "t1",
          subjectType: "SUBSTANCE",
          subjectId: "sub1",
        },
      ],
      maps,
    );
    expect(out).toHaveLength(0);
  });

  it("matches a SUBSTANCE source via the substance's active-use workstation", () => {
    const out = deriveRequiredTrainings(
      [{ workstationId: "ws1", orgUnitId: null }],
      [
        {
          requirementTypeId: "t1",
          subjectType: "SUBSTANCE",
          subjectId: "sub1",
        },
      ],
      {
        ...maps,
        substanceSubjects: new Map([
          [
            "sub1",
            {
              workstationIds: new Set(["ws1"]),
              orgUnitIds: new Set<string>(),
              processIds: new Set<string>(),
            },
          ],
        ]),
      },
    );
    expect(out.map((r) => r.requirementTypeId)).toEqual(["t1"]);
  });

  it("collects multiple sources (the why) for one type", () => {
    const out = deriveRequiredTrainings(
      [{ workstationId: "ws1", orgUnitId: "dept" }],
      [
        {
          requirementTypeId: "t1",
          subjectType: "WORKSTATION",
          subjectId: "ws1",
        },
        { requirementTypeId: "t1", subjectType: "ORG_UNIT", subjectId: "dept" },
      ],
      maps,
    );
    expect(out).toHaveLength(1);
    expect(out[0].sources).toHaveLength(2);
  });

  it("returns nothing for a person with no assignments", () => {
    const out = deriveRequiredTrainings(
      [],
      [
        {
          requirementTypeId: "t1",
          subjectType: "WORKSTATION",
          subjectId: "ws1",
        },
      ],
      maps,
    );
    expect(out).toHaveLength(0);
  });
});
