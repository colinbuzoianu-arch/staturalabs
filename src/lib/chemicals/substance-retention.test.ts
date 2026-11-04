import { describe, expect, it } from "vitest";
import {
  computeSubstanceDeletionCandidates,
  isSubstanceRecordMatured,
  type SubstanceRecordCandidateInput,
  substanceRecordDueDate,
} from "./substance-retention";

const NOW = new Date("2026-11-04T00:00:00Z");

describe("substanceRecordDueDate", () => {
  it("adds the retention to the last-used date", () => {
    const due = substanceRecordDueDate({
      recordType: "SDS",
      recordId: "s1",
      lastUsedAt: new Date("2015-01-01T00:00:00Z"),
      retention: "P10Y",
    });
    expect(due?.toISOString().slice(0, 10)).toBe("2025-01-01");
  });

  it("never matures without a last-used date", () => {
    expect(
      substanceRecordDueDate({
        recordType: "SDS",
        recordId: "s1",
        lastUsedAt: null,
        retention: "P10Y",
      }),
    ).toBeNull();
  });

  it("never matures without a retention period", () => {
    expect(
      substanceRecordDueDate({
        recordType: "SUBSTANCE_USE",
        recordId: "u1",
        lastUsedAt: new Date("2000-01-01T00:00:00Z"),
        retention: null,
      }),
    ).toBeNull();
  });
});

describe("isSubstanceRecordMatured", () => {
  const base: SubstanceRecordCandidateInput = {
    recordType: "SDS",
    recordId: "s1",
    lastUsedAt: new Date("2015-01-01T00:00:00Z"),
    retention: "P10Y",
  };

  it("is matured when the period has fully elapsed", () => {
    expect(isSubstanceRecordMatured(base, NOW)).toBe(true);
  });

  it("is not matured one day before the due date", () => {
    expect(
      isSubstanceRecordMatured(
        { ...base, lastUsedAt: new Date("2016-11-05T00:00:00Z") },
        NOW,
      ),
    ).toBe(false);
  });

  it("an in-use record (no lastUsedAt) is never matured", () => {
    expect(isSubstanceRecordMatured({ ...base, lastUsedAt: null }, NOW)).toBe(
      false,
    );
  });
});

describe("computeSubstanceDeletionCandidates", () => {
  it("returns only matured records, carrying type/id/maturedAt", () => {
    const records: SubstanceRecordCandidateInput[] = [
      {
        recordType: "SDS",
        recordId: "sds-old",
        lastUsedAt: new Date("2010-01-01T00:00:00Z"),
        retention: "P10Y",
      },
      {
        recordType: "SUBSTANCE_USE",
        recordId: "use-recent",
        lastUsedAt: new Date("2025-01-01T00:00:00Z"),
        retention: "P10Y",
      },
      {
        recordType: "SDS",
        recordId: "sds-active",
        lastUsedAt: null,
        retention: "P10Y",
      },
    ];
    const out = computeSubstanceDeletionCandidates(records, NOW);
    expect(out).toEqual([
      {
        recordType: "SDS",
        recordId: "sds-old",
        maturedAt: new Date("2020-01-01T00:00:00Z"),
      },
    ]);
  });

  it("returns an empty list when nothing has matured", () => {
    expect(
      computeSubstanceDeletionCandidates(
        [
          {
            recordType: "SDS",
            recordId: "s1",
            lastUsedAt: new Date("2025-01-01T00:00:00Z"),
            retention: "P10Y",
          },
        ],
        NOW,
      ),
    ).toEqual([]);
  });
});
