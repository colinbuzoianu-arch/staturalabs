import { describe, expect, it } from "vitest";
import {
  computeIncidentDeletionCandidates,
  type IncidentRecordCandidateInput,
  isIncidentRecordMatured,
} from "./incident-retention";

const NOW = new Date("2026-11-05T00:00:00.000Z");
const longAgo = new Date("2010-01-01T00:00:00.000Z"); // >5y and >10y before NOW
const recent = new Date("2025-01-01T00:00:00.000Z"); // <5y before NOW

describe("incident-record retention (P10e)", () => {
  it("matures a closed incident past its 5-year period", () => {
    const i: IncidentRecordCandidateInput = {
      recordType: "INCIDENT",
      recordId: "a",
      triggerDate: longAgo,
      retention: "P5Y",
      legalHold: false,
    };
    expect(isIncidentRecordMatured(i, NOW)).toBe(true);
  });

  it("does not mature a recent record", () => {
    expect(
      isIncidentRecordMatured(
        {
          recordType: "FIRST_AID_RECORD",
          recordId: "b",
          triggerDate: recent,
          retention: "P5Y",
          legalHold: false,
        },
        NOW,
      ),
    ).toBe(false);
  });

  it("suppresses a matured INCIDENT_HEALTH record on legal hold", () => {
    const base: IncidentRecordCandidateInput = {
      recordType: "INCIDENT_HEALTH",
      recordId: "c",
      triggerDate: longAgo,
      retention: "P10Y",
      legalHold: true,
    };
    expect(isIncidentRecordMatured(base, NOW)).toBe(false);
    expect(isIncidentRecordMatured({ ...base, legalHold: false }, NOW)).toBe(
      true,
    );
  });

  it("never matures without a trigger date or period", () => {
    expect(
      isIncidentRecordMatured(
        {
          recordType: "INCIDENT",
          recordId: "d",
          triggerDate: null,
          retention: "P5Y",
          legalHold: false,
        },
        NOW,
      ),
    ).toBe(false);
    expect(
      isIncidentRecordMatured(
        {
          recordType: "INCIDENT",
          recordId: "e",
          triggerDate: longAgo,
          retention: null,
          legalHold: false,
        },
        NOW,
      ),
    ).toBe(false);
  });

  it("collects only matured, non-held candidates with their due date", () => {
    const out = computeIncidentDeletionCandidates(
      [
        {
          recordType: "INCIDENT",
          recordId: "a",
          triggerDate: longAgo,
          retention: "P5Y",
          legalHold: false,
        },
        {
          recordType: "FIRST_AID_RECORD",
          recordId: "b",
          triggerDate: recent,
          retention: "P5Y",
          legalHold: false,
        },
        {
          recordType: "INCIDENT_HEALTH",
          recordId: "c",
          triggerDate: longAgo,
          retention: "P10Y",
          legalHold: true,
        },
      ],
      NOW,
    );
    expect(out.map((o) => o.recordId)).toEqual(["a"]);
    expect(out[0].maturedAt).toBeInstanceOf(Date);
  });
});
