// P6 §6 review cycle (SLD_RESTRUCTURE_PLAN_platform-modules.md). Pure
// date helpers — no DB, no `server-only`, directly unit-tested. The legal
// trigger WORDING per country ("Überprüfung erforderlich") comes from the
// country catalogue / dictionaries, never from here; this only does the dates.

export const ASSESSMENT_REVIEW_LEAD_DAYS = 30;

// Next review date = base date + N calendar months (clamping the day to the
// target month's length, so e.g. Jan 31 + 1 month → Feb 28/29). Returns null
// when no interval is set (a review date can still be set directly instead).
export function computeNextReviewDate(
  base: Date,
  intervalMonths: number | null,
): Date | null {
  if (intervalMonths === null || intervalMonths <= 0) return null;
  const year = base.getUTCFullYear();
  const month = base.getUTCMonth();
  const day = base.getUTCDate();
  const targetMonthIndex = month + intervalMonths;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDayOfTarget = new Date(
    Date.UTC(targetYear, targetMonth + 1, 0),
  ).getUTCDate();
  const clampedDay = Math.min(day, lastDayOfTarget);
  return new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      clampedDay,
      base.getUTCHours(),
      base.getUTCMinutes(),
      base.getUTCSeconds(),
      base.getUTCMilliseconds(),
    ),
  );
}

// A review is due when it is flagged required, or its next-review date is
// within the lead window / already past.
export function isReviewDue(
  nextReviewDate: Date | null,
  reviewRequired: boolean,
  now: Date,
  leadDays: number = ASSESSMENT_REVIEW_LEAD_DAYS,
): boolean {
  if (reviewRequired) return true;
  if (nextReviewDate === null) return false;
  const lead = new Date(now.getTime() + leadDays * 24 * 60 * 60 * 1000);
  return nextReviewDate <= lead;
}
