import type { NotificationEventType } from "@/generated/prisma/enums";

// P5 notifications service (SLD_RESTRUCTURE_PLAN_platform-modules.md §7.9).
// The pure eligibility + dedupe core — no DB, no `server-only`, directly
// unit-tested (same split as matchScoringRule / validateActionTransition).
// The per-tenant configurable NotificationRule (recipients by role/
// permission, digest, custom lead times) is a deferred follow-up; v1 uses
// these built-in lead-time defaults and generates only for events whose
// recipient is unambiguous in today's data (see generate.ts).

// Days before a due date within which an upcoming item becomes "due soon".
export const ACTION_DUE_SOON_LEAD_DAYS = 7;
// Days before a review date within which a document review becomes "due".
export const DOCUMENT_REVIEW_LEAD_DAYS = 30;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

// Due in the future but within the lead window (not yet overdue).
export function isDueSoon(
  dueDate: Date | null,
  now: Date,
  leadDays: number,
): boolean {
  if (dueDate === null) return false;
  return dueDate >= now && dueDate <= addDays(now, leadDays);
}

// Past its due date.
export function isOverdue(dueDate: Date | null, now: Date): boolean {
  if (dueDate === null) return false;
  return dueDate < now;
}

// Due within the lead window OR already past — one combined state for review
// dates (document review, legal-requirement review), which have no separate
// "overdue" event in v1.
export function isDueOrPast(
  date: Date | null,
  now: Date,
  leadDays: number,
): boolean {
  if (date === null) return false;
  return date <= addDays(now, leadDays);
}

// Stable idempotency key: one notification per (recipient, event, subject).
// DUE_SOON and OVERDUE are different events, so an item that crosses from
// upcoming to overdue legitimately yields a second, distinct notification
// rather than mutating the first.
export function buildDedupeKey(
  eventType: NotificationEventType,
  subjectId: string,
): string {
  return `${eventType}:${subjectId}`;
}
