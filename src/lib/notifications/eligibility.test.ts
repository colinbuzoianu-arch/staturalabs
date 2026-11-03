import { describe, expect, it } from "vitest";
import { NotificationEventType } from "@/generated/prisma/enums";
import {
  buildDedupeKey,
  isDueOrPast,
  isDueSoon,
  isOverdue,
} from "./eligibility";

const now = new Date("2026-11-03T00:00:00.000Z");

describe("isOverdue", () => {
  it("is true for a past due date", () => {
    expect(isOverdue(new Date("2026-11-02T00:00:00Z"), now)).toBe(true);
  });
  it("is false for a future due date", () => {
    expect(isOverdue(new Date("2026-11-04T00:00:00Z"), now)).toBe(false);
  });
  it("is false for null", () => {
    expect(isOverdue(null, now)).toBe(false);
  });
});

describe("isDueSoon", () => {
  it("is true within the lead window and not yet due", () => {
    expect(isDueSoon(new Date("2026-11-08T00:00:00Z"), now, 7)).toBe(true);
  });
  it("is false beyond the lead window", () => {
    expect(isDueSoon(new Date("2026-11-20T00:00:00Z"), now, 7)).toBe(false);
  });
  it("is false when already overdue (that is isOverdue's job)", () => {
    expect(isDueSoon(new Date("2026-11-01T00:00:00Z"), now, 7)).toBe(false);
  });
  it("is false for null", () => {
    expect(isDueSoon(null, now, 7)).toBe(false);
  });
  it("includes the exact lead boundary", () => {
    expect(isDueSoon(new Date("2026-11-10T00:00:00Z"), now, 7)).toBe(true);
  });
});

describe("isDueOrPast", () => {
  it("is true for a past date", () => {
    expect(isDueOrPast(new Date("2026-01-01T00:00:00Z"), now, 30)).toBe(true);
  });
  it("is true within the lead window", () => {
    expect(isDueOrPast(new Date("2026-11-20T00:00:00Z"), now, 30)).toBe(true);
  });
  it("is false well beyond the lead window", () => {
    expect(isDueOrPast(new Date("2026-12-31T00:00:00Z"), now, 30)).toBe(false);
  });
  it("is false for null", () => {
    expect(isDueOrPast(null, now, 30)).toBe(false);
  });
});

describe("buildDedupeKey", () => {
  it("is stable per (event, subject)", () => {
    expect(buildDedupeKey(NotificationEventType.ACTION_OVERDUE, "a1")).toBe(
      "ACTION_OVERDUE:a1",
    );
  });
  it("distinguishes due-soon from overdue for the same subject", () => {
    expect(
      buildDedupeKey(NotificationEventType.ACTION_DUE_SOON, "a1"),
    ).not.toBe(buildDedupeKey(NotificationEventType.ACTION_OVERDUE, "a1"));
  });
});
