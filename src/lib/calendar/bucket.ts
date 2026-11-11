// P14 G2: the Aktivitätenkalender's shared entry types + the pure agenda
// bucketing. No `server-only` and no DB, so it is unit-testable directly (same
// pure/impure split as matchScoringRule/lookupScoringRule). The impure
// collector that fills these from the DB lives in collect.ts.

export type CalendarModule =
  | "actions"
  | "inspections"
  | "risk"
  | "legal"
  | "incidents";

export type CalendarEntryKind =
  | "action-due"
  | "action-verification"
  | "inspection-planned"
  | "assessment-review"
  | "legal-review"
  | "incident-notification";

export type CalendarEntry = {
  // Stable per-result id (module-prefixed so two modules can't collide).
  id: string;
  module: CalendarModule;
  // i18n key suffix for the entry kind (calendar.kinds.<kind>).
  kind: CalendarEntryKind;
  title: string;
  siteId: string;
  dueDate: Date;
  overdue: boolean;
  href: string;
  responsibleUserId: string | null;
};

// Agenda buckets: overdue first, then this week, this month, later.
export type CalendarBucketKey = "overdue" | "thisWeek" | "thisMonth" | "later";

export function bucketCalendarEntries(
  entries: CalendarEntry[],
  now: Date,
): Record<CalendarBucketKey, CalendarEntry[]> {
  const endOfWeek = new Date(now.getTime());
  endOfWeek.setUTCDate(endOfWeek.getUTCDate() + 7);
  const endOfMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59),
  );
  const buckets: Record<CalendarBucketKey, CalendarEntry[]> = {
    overdue: [],
    thisWeek: [],
    thisMonth: [],
    later: [],
  };
  for (const e of entries) {
    if (e.dueDate < now) buckets.overdue.push(e);
    else if (e.dueDate <= endOfWeek) buckets.thisWeek.push(e);
    else if (e.dueDate <= endOfMonth) buckets.thisMonth.push(e);
    else buckets.later.push(e);
  }
  return buckets;
}
