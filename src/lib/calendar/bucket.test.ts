import { describe, expect, it } from "vitest";
import { bucketCalendarEntries, type CalendarEntry } from "./bucket";

const now = new Date("2026-11-11T12:00:00.000Z");

function entry(dueDate: string, overdue: boolean): CalendarEntry {
  return {
    id: `e-${dueDate}`,
    module: "actions",
    kind: "action-due",
    title: "x",
    siteId: "s1",
    dueDate: new Date(dueDate),
    overdue,
    href: "/",
    responsibleUserId: null,
  };
}

describe("bucketCalendarEntries", () => {
  it("sorts entries into overdue / this week / this month / later", () => {
    const entries = [
      entry("2026-11-01T00:00:00.000Z", true), // past → overdue
      entry("2026-11-13T00:00:00.000Z", false), // within 7 days → this week
      entry("2026-11-25T00:00:00.000Z", false), // same month, >7 days → this month
      entry("2026-12-20T00:00:00.000Z", false), // next month → later
    ];
    const b = bucketCalendarEntries(entries, now);
    expect(b.overdue).toHaveLength(1);
    expect(b.thisWeek).toHaveLength(1);
    expect(b.thisMonth).toHaveLength(1);
    expect(b.later).toHaveLength(1);
  });

  it("puts anything before now in overdue regardless of how recent", () => {
    const b = bucketCalendarEntries(
      [entry("2026-11-11T11:59:00.000Z", true)],
      now,
    );
    expect(b.overdue).toHaveLength(1);
    expect(b.thisWeek).toHaveLength(0);
  });

  it("returns empty buckets for no entries", () => {
    const b = bucketCalendarEntries([], now);
    expect(b.overdue).toEqual([]);
    expect(b.later).toEqual([]);
  });
});
