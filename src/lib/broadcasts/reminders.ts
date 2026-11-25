import { recordAuditEvent } from "@/lib/audit/audit-event";
import { appUrl } from "@/lib/config/base-url";
import { createNotificationIfAbsent } from "@/lib/notifications/service";
import { prisma } from "@/lib/prisma";
import { broadcastInboxHref } from "./publish";
import { broadcastBodyToText } from "./sanitise";

// Confirmation reminders: before the deadline, and once it has passed.
//
// The lead time is configurable per company with a 2-day default (the prompt's
// §"Reminders"). It lives in the existing CompanyRetentionSetting-style
// per-company pattern? No — deliberately NOT a new table: it is a single
// number, so it rides on the FeatureFlag-free, already-present company config
// surface via an env-independent default plus an explicit per-call override.
// A tenant-configurable value lands with the NotificationRule work the P5
// milestone already defers (role routing, digests, custom lead times); until
// then the default is the documented behaviour and the override is what the
// sender's "remind now" button uses.
export const BROADCAST_REMINDER_LEAD_DAYS = 2;

const MS_PER_DAY = 86_400_000;

export type ReminderKind = "due-soon" | "overdue" | "manual";

// Pure: which reminder (if any) is owed for one recipient right now. Separate
// from the DB work so every boundary is unit-testable.
export function reminderDueFor(
  input: {
    requiresConfirmation: boolean;
    confirmationDueAt: Date | null;
    confirmedAt: Date | null;
  },
  now: Date,
  leadDays: number = BROADCAST_REMINDER_LEAD_DAYS,
): ReminderKind | null {
  // Nothing to chase: no confirmation asked for, or already given.
  if (!input.requiresConfirmation) return null;
  if (input.confirmedAt !== null) return null;
  // No deadline → no automatic reminder (a sender can still remind manually).
  if (input.confirmationDueAt === null) return null;

  const due = input.confirmationDueAt.getTime();
  if (due < now.getTime()) return "overdue";
  if (due <= now.getTime() + leadDays * MS_PER_DAY) return "due-soon";
  return null;
}

const EVENT_BY_KIND = {
  "due-soon": "BROADCAST_CONFIRMATION_DUE_SOON",
  overdue: "BROADCAST_CONFIRMATION_OVERDUE",
  // A manual nudge is deliberately filed as the "due soon" event: it is the
  // same ask ("please confirm"), and reusing the event keeps one dedupe key
  // per recipient per stage instead of inventing a third inbox category.
  manual: "BROADCAST_CONFIRMATION_DUE_SOON",
} as const;

const TITLE_DE: Record<ReminderKind, string> = {
  "due-soon": "Bestätigung bald fällig",
  overdue: "Bestätigung überfällig",
  manual: "Erinnerung: bitte bestätigen",
};

export type ReminderResult = { considered: number; created: number };

// Send the reminders owed for one broadcast. Idempotent per stage: the
// notification service upserts on (recipient, dedupeKey), and the key carries
// the stage, so a recipient gets at most one "due soon" and one "overdue" —
// a manual nudge after an automatic one is therefore a no-op, by design, until
// the stage changes.
export async function sendBroadcastReminders(input: {
  broadcastId: string;
  actorUserId: string | null;
  // Restrict to these recipient rows (the leader's "remind my people" button).
  recipientIds?: readonly string[];
  kind?: ReminderKind;
  leadDays?: number;
  now?: Date;
}): Promise<ReminderResult> {
  const now = input.now ?? new Date();
  const broadcast = await prisma.broadcast.findUnique({
    where: { id: input.broadcastId },
    select: {
      id: true,
      companyId: true,
      siteId: true,
      title: true,
      body: true,
      status: true,
      priority: true,
      requiresConfirmation: true,
      confirmationDueAt: true,
    },
  });
  if (!broadcast || broadcast.status !== "PUBLISHED") {
    return { considered: 0, created: 0 };
  }

  const recipients = await prisma.broadcastRecipient.findMany({
    where: {
      broadcastId: broadcast.id,
      confirmedAt: null,
      platformUserId: { not: null },
      ...(input.recipientIds ? { id: { in: [...input.recipientIds] } } : {}),
    },
    select: { id: true, platformUserId: true },
  });
  if (recipients.length === 0) return { considered: 0, created: 0 };

  const users = await prisma.platformUser.findMany({
    where: {
      id: {
        in: recipients
          .map((r) => r.platformUserId)
          .filter((id): id is string => id !== null),
      },
      disabledAt: null,
    },
    select: { id: true, email: true },
  });
  const emailById = new Map(users.map((u) => [u.id, u.email]));

  const href = broadcastInboxHref(broadcast.id);
  const absolute = appUrl(href);
  const bodyText = broadcastBodyToText(broadcast.body);
  let created = 0;

  for (const recipient of recipients) {
    if (!recipient.platformUserId) continue;
    if (!emailById.has(recipient.platformUserId)) continue; // disabled account

    const kind =
      input.kind ??
      reminderDueFor(
        {
          requiresConfirmation: broadcast.requiresConfirmation,
          confirmationDueAt: broadcast.confirmationDueAt,
          confirmedAt: null,
        },
        now,
        input.leadDays,
      );
    if (!kind) continue;

    const email = emailById.get(recipient.platformUserId) as string;
    const result = await createNotificationIfAbsent({
      recipientUserId: recipient.platformUserId,
      // Access-code accounts have no deliverable address (P17 §5).
      recipientEmail: email.endsWith("@employee.sld.invalid") ? null : email,
      eventType: EVENT_BY_KIND[kind],
      companyId: broadcast.companyId,
      siteId: broadcast.siteId,
      subjectType: "Broadcast",
      subjectId: broadcast.id,
      href,
      title: `${TITLE_DE[kind]}: ${broadcast.title}`,
      body: bodyText.slice(0, 500),
      dueAt: broadcast.confirmationDueAt,
      dedupeKey: `broadcast-reminder:${EVENT_BY_KIND[kind]}:${broadcast.id}`,
      emailSubject: `[${TITLE_DE[kind]}] ${broadcast.title}`,
      emailBody: absolute
        ? `${broadcast.title}\n\n${bodyText}\n\n${absolute}`
        : `${broadcast.title}\n\n${bodyText}`,
    });
    if (result) created += 1;
  }

  if (created > 0) {
    await recordAuditEvent({
      actorUserId: input.actorUserId,
      action: "broadcast.remind",
      entityType: "Broadcast",
      entityId: broadcast.id,
      companyId: broadcast.companyId,
      siteId: broadcast.siteId,
      diff: { created, kind: input.kind ?? "auto" },
    });
  }
  return { considered: recipients.length, created };
}

// The automatic pass over every published broadcast with an outstanding
// confirmation in the given sites. Called from the same "check for due items"
// surface as the P5 generator, so there is one trigger, not two.
export async function generateBroadcastReminders(input: {
  siteIds: readonly string[];
  companyId: string;
  now?: Date;
  leadDays?: number;
}): Promise<ReminderResult> {
  const now = input.now ?? new Date();
  const broadcasts = await prisma.broadcast.findMany({
    where: {
      companyId: input.companyId,
      status: "PUBLISHED",
      requiresConfirmation: true,
      confirmationDueAt: { not: null },
      OR: [{ siteId: null }, { siteId: { in: [...input.siteIds] } }],
    },
    select: { id: true },
  });
  const total: ReminderResult = { considered: 0, created: 0 };
  for (const broadcast of broadcasts) {
    const result = await sendBroadcastReminders({
      broadcastId: broadcast.id,
      actorUserId: null,
      now,
      leadDays: input.leadDays,
    });
    total.considered += result.considered;
    total.created += result.created;
  }
  return total;
}
