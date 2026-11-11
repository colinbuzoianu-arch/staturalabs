import type { WorkforcePeriodType } from "@/generated/prisma/enums";
import type { ImporterDefinition, ImportFieldSpec } from "../framework";

// P14 G3: workforce-figures importer (feeds G1). Person-free — rows are
// aggregates (headcount + hours), never Person records. Site is fixed by the
// import context (the site the upload runs under); each row carries the period
// and figures, optionally an org unit (resolved by name within the site).

export type WorkforcePeriodImportValue = {
  orgUnitId: string | null;
  periodType: WorkforcePeriodType;
  year: number;
  periodIndex: number;
  headcount: number | null;
  hoursWorked: number | null;
};

export type WorkforcePeriodImportContext = {
  // org unit name (trimmed, lower-cased) -> id, within the site.
  orgUnitIdByName: Map<string, string>;
};

const FIELDS: readonly ImportFieldSpec[] = [
  {
    key: "period",
    required: true,
    aliases: ["period", "periode", "zeitraum"],
    example: "YEAR",
  },
  {
    key: "year",
    required: true,
    aliases: ["year", "jahr", "an"],
    example: "2026",
  },
  {
    key: "periodIndex",
    required: false,
    aliases: [
      "index",
      "month",
      "monat",
      "quarter",
      "quartal",
      "luna",
      "trimestru",
    ],
    example: "0",
  },
  {
    key: "orgUnit",
    required: false,
    aliases: [
      "orgunit",
      "org unit",
      "organisationseinheit",
      "abteilung",
      "unitate",
    ],
    example: "",
  },
  {
    key: "headcount",
    required: false,
    aliases: [
      "headcount",
      "personalstand",
      "beschäftigte",
      "beschaeftigte",
      "angajati",
    ],
    example: "45",
  },
  {
    key: "hoursWorked",
    required: false,
    aliases: ["hours", "hoursworked", "arbeitsstunden", "stunden", "ore"],
    example: "81000",
  },
];

const INT = /^\d+$/;

function parsePeriodType(raw: string): WorkforcePeriodType | null {
  const v = raw.trim().toUpperCase();
  if (v === "YEAR" || v === "JAHR" || v === "AN") return "YEAR";
  if (v === "QUARTER" || v === "QUARTAL" || v === "TRIMESTRU") return "QUARTER";
  if (v === "MONTH" || v === "MONAT" || v === "LUNA") return "MONTH";
  return null;
}

export const workforcePeriodImporter: ImporterDefinition<
  WorkforcePeriodImportValue,
  WorkforcePeriodImportContext
> = {
  entity: "workforce-period",
  fields: FIELDS,
  validateRow(cells, ctx) {
    const periodType = parsePeriodType(cells.period);
    if (!periodType) return { status: "error", reason: "invalid-period" };
    if (!INT.test(cells.year))
      return { status: "error", reason: "invalid-year" };
    const year = Number.parseInt(cells.year, 10);
    if (year < 2000 || year > 2100)
      return { status: "error", reason: "year-out-of-range" };

    // periodIndex: required+ranged for MONTH/QUARTER, forced 0 for YEAR.
    let periodIndex = 0;
    if (periodType !== "YEAR") {
      if (!INT.test(cells.periodIndex))
        return { status: "error", reason: "missing-period-index" };
      periodIndex = Number.parseInt(cells.periodIndex, 10);
      const max = periodType === "MONTH" ? 12 : 4;
      if (periodIndex < 1 || periodIndex > max)
        return { status: "error", reason: "period-index-out-of-range" };
    }

    let orgUnitId: string | null = null;
    if (cells.orgUnit) {
      const id = ctx.orgUnitIdByName.get(cells.orgUnit.toLowerCase());
      if (!id) return { status: "error", reason: "unknown-org-unit" };
      orgUnitId = id;
    }

    const parseFig = (raw: string): number | null | "bad" => {
      if (!raw) return null;
      if (!INT.test(raw)) return "bad";
      return Number.parseInt(raw, 10);
    };
    const headcount = parseFig(cells.headcount);
    const hoursWorked = parseFig(cells.hoursWorked);
    if (headcount === "bad" || hoursWorked === "bad")
      return { status: "error", reason: "invalid-figure" };

    if (headcount === null && hoursWorked === null)
      return { status: "skip", reason: "no-figures" };

    return {
      status: "create",
      value: {
        orgUnitId,
        periodType,
        year,
        periodIndex,
        headcount,
        hoursWorked,
      },
    };
  },
};
