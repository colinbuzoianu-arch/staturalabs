import { describe, expect, it } from "vitest";
import {
  buildSelfInstructions,
  countDueSelfInstructions,
  isSelfConfirmableDelivery,
  type SelfRecord,
  type SelfRequiredType,
} from "./self-instructions";

const now = new Date("2026-06-15T00:00:00Z");

const docType: SelfRequiredType = {
  requirementTypeId: "t-doc",
  title: "Betriebsanweisung lesen",
  deliveryMethod: "DOCUMENT_READ_CONFIRMATION",
  recurrenceMonths: 12,
  sourceTypes: ["WORKSTATION"],
};
const inPersonType: SelfRequiredType = {
  requirementTypeId: "t-person",
  title: "Erste Hilfe",
  deliveryMethod: "IN_PERSON",
  recurrenceMonths: 24,
  sourceTypes: ["ORG_UNIT"],
};

describe("isSelfConfirmableDelivery", () => {
  it("allows only document-read confirmation", () => {
    expect(isSelfConfirmableDelivery("DOCUMENT_READ_CONFIRMATION")).toBe(true);
    expect(isSelfConfirmableDelivery("IN_PERSON")).toBe(false);
    expect(isSelfConfirmableDelivery("ELEARNING")).toBe(false);
  });
});

describe("buildSelfInstructions", () => {
  it("marks a required type with no record as missing", () => {
    const [result] = buildSelfInstructions([docType], [], now);
    expect(result.status).toBe("missing");
    expect(result.validUntil).toBeNull();
    // Missing + document-read → self-confirmable.
    expect(result.selfConfirmable).toBe(true);
  });

  it("is valid with a future record and then NOT self-confirmable", () => {
    const records: SelfRecord[] = [
      { requirementTypeId: "t-doc", validUntil: new Date("2027-01-01") },
    ];
    const [result] = buildSelfInstructions([docType], records, now);
    expect(result.status).toBe("valid");
    expect(result.selfConfirmable).toBe(false);
  });

  it("is overdue with a past record and self-confirmable again", () => {
    const records: SelfRecord[] = [
      { requirementTypeId: "t-doc", validUntil: new Date("2026-01-01") },
    ];
    const [result] = buildSelfInstructions([docType], records, now);
    expect(result.status).toBe("overdue");
    expect(result.selfConfirmable).toBe(true);
  });

  it("never self-confirmable for an in-person session, even when overdue", () => {
    const records: SelfRecord[] = [
      { requirementTypeId: "t-person", validUntil: new Date("2026-01-01") },
    ];
    const [result] = buildSelfInstructions([inPersonType], records, now);
    expect(result.status).toBe("overdue");
    expect(result.selfConfirmable).toBe(false);
  });

  it("picks the strongest record per type (null validUntil wins)", () => {
    const records: SelfRecord[] = [
      { requirementTypeId: "t-doc", validUntil: new Date("2026-01-01") },
      { requirementTypeId: "t-doc", validUntil: null },
    ];
    const [result] = buildSelfInstructions([docType], records, now);
    expect(result.status).toBe("valid");
    expect(result.validUntil).toBeNull();
  });

  it("counts due instructions (anything not valid)", () => {
    const required = [docType, inPersonType];
    const records: SelfRecord[] = [
      { requirementTypeId: "t-doc", validUntil: new Date("2027-01-01") },
    ];
    const built = buildSelfInstructions(required, records, now);
    expect(countDueSelfInstructions(built)).toBe(1);
  });
});
