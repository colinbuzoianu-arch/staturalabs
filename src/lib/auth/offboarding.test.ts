import { describe, expect, it } from "vitest";
import { isPersonOffboarded } from "./offboarding";

const now = new Date("2026-11-25T12:00:00Z");
const base = { active: true, employmentEnd: null, anonymisedAt: null };

describe("isPersonOffboarded", () => {
  it("an active person with no end date is not offboarded", () => {
    expect(isPersonOffboarded(base, now)).toBe(false);
  });
  it("a deactivated person is offboarded", () => {
    expect(isPersonOffboarded({ ...base, active: false }, now)).toBe(true);
  });
  it("an anonymised person is offboarded even if the row still says active", () => {
    expect(
      isPersonOffboarded(
        { ...base, anonymisedAt: new Date("2026-01-01") },
        now,
      ),
    ).toBe(true);
  });
  it("the account stays usable through the last day of employment", () => {
    expect(
      isPersonOffboarded(
        { ...base, employmentEnd: new Date("2026-11-25T00:00:00Z") },
        now,
      ),
    ).toBe(false);
  });
  it("is offboarded the day after the end date", () => {
    expect(
      isPersonOffboarded(
        { ...base, employmentEnd: new Date("2026-11-24T00:00:00Z") },
        now,
      ),
    ).toBe(true);
  });
  it("a future end date does not offboard", () => {
    expect(
      isPersonOffboarded(
        { ...base, employmentEnd: new Date("2027-03-31T00:00:00Z") },
        now,
      ),
    ).toBe(false);
  });
});
