import type { NotificationEventType } from "@/generated/prisma/enums";
import type { NotificationModel } from "@/generated/prisma/models";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { prisma } from "@/lib/prisma";
import { sendNotificationEmail } from "./email";

// P5 notifications service (SLD_RESTRUCTURE_PLAN_platform-modules.md §7.9) —
// the in-app notification store. No `import "server-only"`: unit-testable
// with a mocked prisma, same reasoning as the audit helper it calls.

export type CreateNotificationInput = {
  recipientUserId: string;
  recipientEmail?: string | null;
  eventType: NotificationEventType;
  companyId?: string | null;
  siteId?: string | null;
  subjectType?: string | null;
  subjectId?: string | null;
  href: string;
  title: string;
  body: string;
  dueAt?: Date | null;
  dedupeKey: string;
  // Optional composed strings for the email channel (the in-app inbox uses
  // title/body and localises the event badge itself). Fall back to
  // title/body when omitted.
  emailSubject?: string;
  emailBody?: string;
};

// Create a notification once. If one already exists for this
// (recipientUserId, dedupeKey) it is left untouched — never un-read, never
// re-emailed — so re-running the generator is idempotent. Returns the new
// row, or null when it already existed. A created notification is audited
// (actor null = system) and triggers a best-effort email (no-op when no
// provider is configured; never blocks or throws).
export async function createNotificationIfAbsent(
  input: CreateNotificationInput,
): Promise<NotificationModel | null> {
  const existing = await prisma.notification.findUnique({
    where: {
      recipientUserId_dedupeKey: {
        recipientUserId: input.recipientUserId,
        dedupeKey: input.dedupeKey,
      },
    },
    select: { id: true },
  });
  if (existing) return null;

  const emailResult = await sendNotificationEmail({
    to: input.recipientEmail ?? null,
    subject: input.emailSubject ?? input.title,
    body: input.emailBody ?? input.body,
  });

  const created = await prisma.notification.create({
    data: {
      recipientUserId: input.recipientUserId,
      eventType: input.eventType,
      companyId: input.companyId ?? null,
      siteId: input.siteId ?? null,
      subjectType: input.subjectType ?? null,
      subjectId: input.subjectId ?? null,
      href: input.href,
      title: input.title,
      body: input.body,
      dueAt: input.dueAt ?? null,
      dedupeKey: input.dedupeKey,
      emailedAt: emailResult.sent ? new Date() : null,
    },
  });

  await recordAuditEvent({
    actorUserId: null,
    action: "notification.create",
    entityType: "Notification",
    entityId: created.id,
    companyId: input.companyId ?? null,
    siteId: input.siteId ?? null,
    diff: { eventType: input.eventType, emailed: emailResult.sent },
  });

  return created;
}

// Mark one notification read, scoped to its recipient (a user can never mark
// another user's notification read). No-op if already read or not theirs.
export async function markNotificationRead(
  notificationId: string,
  recipientUserId: string,
): Promise<void> {
  const result = await prisma.notification.updateMany({
    where: { id: notificationId, recipientUserId, readAt: null },
    data: { readAt: new Date() },
  });
  if (result.count > 0) {
    await recordAuditEvent({
      actorUserId: recipientUserId,
      action: "notification.read",
      entityType: "Notification",
      entityId: notificationId,
    });
  }
}

export async function markAllNotificationsRead(
  recipientUserId: string,
): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { recipientUserId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}

export async function listNotifications(
  recipientUserId: string,
  limit = 50,
): Promise<NotificationModel[]> {
  return prisma.notification.findMany({
    where: { recipientUserId },
    // Unread first, then most recently due / created.
    orderBy: [
      { readAt: { sort: "asc", nulls: "first" } },
      { createdAt: "desc" },
    ],
    take: limit,
  });
}

export async function countUnreadNotifications(
  recipientUserId: string,
): Promise<number> {
  return prisma.notification.count({
    where: { recipientUserId, readAt: null },
  });
}
