import { describe, expect, it } from "vitest";
import { BROADCAST_REMINDER_LEAD_DAYS, reminderDueFor } from "./reminders";

const now = new Date("2026-11-25T12:00:00Z");
const base = {
  requiresConfirmation: true,
  confirmationDueAt: null as Date | null,
  confirmedAt: null as Date | null,
};

describe("reminderDueFor", () => {
  it("defaults to a 2-day lead time", () => {
    expect(BROADCAST_REMINDER_LEAD_DAYS).toBe(2);
  });
  it("owes nothing when no confirmation was asked for", () => {
    expect(
      reminderDueFor(
        {
          ...base,
          requiresConfirmation: false,
          confirmationDueAt: new Date("2026-11-26T12:00:00Z"),
        },
        now,
      ),
    ).toBeNull();
  });
  it("owes nothing once the recipient has confirmed", () => {
    expect(
      reminderDueFor(
        {
          ...base,
          confirmationDueAt: new Date("2026-11-26T12:00:00Z"),
          confirmedAt: new Date("2026-11-24T08:00:00Z"),
        },
        now,
      ),
    ).toBeNull();
  });
  it("owes nothing without a deadline — a sender may still remind by hand", () => {
    expect(reminderDueFor(base, now)).toBeNull();
  });
  it("owes a due-soon reminder inside the lead window", () => {
    expect(
      reminderDueFor(
        { ...base, confirmationDueAt: new Date("2026-11-26T12:00:00Z") },
        now,
      ),
    ).toBe("due-soon");
  });
  it("owes nothing yet outside the lead window", () => {
    expect(
      reminderDueFor(
        { ...base, confirmationDueAt: new Date("2026-12-10T12:00:00Z") },
        now,
      ),
    ).toBeNull();
  });
  it("owes an overdue reminder once the deadline has passed", () => {
    expect(
      reminderDueFor(
        { ...base, confirmationDueAt: new Date("2026-11-24T12:00:00Z") },
        now,
      ),
    ).toBe("overdue");
  });
  it("honours a custom lead time", () => {
    expect(
      reminderDueFor(
        { ...base, confirmationDueAt: new Date("2026-12-01T12:00:00Z") },
        now,
        10,
      ),
    ).toBe("due-soon");
  });
  it("is due-soon exactly at the lead boundary, overdue just past the deadline", () => {
    expect(
      reminderDueFor(
        { ...base, confirmationDueAt: new Date("2026-11-27T12:00:00Z") },
        now,
      ),
    ).toBe("due-soon");
    expect(
      reminderDueFor(
        { ...base, confirmationDueAt: new Date("2026-11-25T11:59:59Z") },
        now,
      ),
    ).toBe("overdue");
  });
});
