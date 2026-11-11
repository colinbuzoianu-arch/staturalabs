import { describe, expect, it } from "vitest";
import {
  autoDetectMapping,
  buildPlan,
  buildTemplateCsv,
  parseCsv,
} from "./framework";
import { incidentImporter } from "./importers/incident";
import { workforcePeriodImporter } from "./importers/workforce-period";

describe("parseCsv", () => {
  it("parses quoted cells with embedded commas and newlines", () => {
    const rows = parseCsv('a,b\n"x,y","line\nbreak"');
    expect(rows).toEqual([
      ["a", "b"],
      ["x,y", "line\nbreak"],
    ]);
  });
});

describe("buildTemplateCsv", () => {
  it("emits a BOM, the field keys and one example row", () => {
    const csv = buildTemplateCsv(workforcePeriodImporter);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("period,year,periodIndex");
    expect(csv).toContain("YEAR");
  });
});

describe("workforcePeriodImporter", () => {
  const ctx = { orgUnitIdByName: new Map([["werk a", "ou-1"]]) };
  const run = (csv: string) => {
    const rows = parseCsv(csv);
    const [header, ...data] = rows;
    const mapping = autoDetectMapping(header, workforcePeriodImporter.fields);
    return buildPlan(data, mapping, workforcePeriodImporter, ctx);
  };

  it("creates a valid YEAR row and forces periodIndex 0", () => {
    const plan = run("period,year,headcount,hoursWorked\nYEAR,2026,45,81000");
    expect(plan.summary).toMatchObject({ create: 1, error: 0 });
    expect(plan.rows[0].value).toMatchObject({
      periodType: "YEAR",
      periodIndex: 0,
      headcount: 45,
      hoursWorked: 81000,
    });
  });

  it("requires a valid month index for MONTH periods", () => {
    const plan = run("period,year,periodIndex\nMONTH,2026,13");
    expect(plan.summary.error).toBe(1);
    expect(plan.rows[0].reason).toBe("period-index-out-of-range");
  });

  it("skips a row with no figures and errors an unknown org unit", () => {
    const plan = run(
      "period,year,orgUnit,headcount\nYEAR,2026,,\nYEAR,2026,Nope,10",
    );
    expect(plan.summary.skip).toBe(1);
    expect(plan.summary.error).toBe(1);
    expect(plan.rows[1].reason).toBe("unknown-org-unit");
  });
});

describe("incidentImporter", () => {
  const ctx = {
    workstationIdByName: new Map([["presse 1", "ws-1"]]),
    orgUnitIdByName: new Map<string, string>(),
  };
  const run = (csv: string) => {
    const rows = parseCsv(csv);
    const [header, ...data] = rows;
    const mapping = autoDetectMapping(header, incidentImporter.fields);
    return buildPlan(data, mapping, incidentImporter, ctx);
  };

  it("creates a valid person-free incident row", () => {
    const plan = run(
      "type,title,description,occurredAt,workstation\nARBEITSUNFALL,Sturz,Hergang,2026-03-14,Presse 1",
    );
    expect(plan.summary).toMatchObject({ create: 1, error: 0 });
    expect(plan.rows[0].value).toMatchObject({
      type: "ARBEITSUNFALL",
      subjectWorkstationId: "ws-1",
    });
  });

  it("rejects an unknown type and a bad date", () => {
    const plan = run(
      "type,title,description,occurredAt\nNOPE,T,D,2026-03-14\nARBEITSUNFALL,T,D,14.03.2026",
    );
    expect(plan.summary.error).toBe(2);
    expect(plan.rows[0].reason).toBe("invalid-type");
    expect(plan.rows[1].reason).toBe("invalid-date");
  });
});
