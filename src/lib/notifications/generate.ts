import {
  NotificationEventType as EventType,
  type NotificationEventType,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import {
  ACTION_DUE_SOON_LEAD_DAYS,
  buildDedupeKey,
  DOCUMENT_REVIEW_LEAD_DAYS,
  isDueOrPast,
  isDueSoon,
  isOverdue,
} from "./eligibility";
import { createNotificationIfAbsent } from "./service";

// P5 notifications service (SLD_RESTRUCTURE_PLAN_platform-modules.md §7.9) —
// the due-event generator. It materialises in-app notifications for the
// events whose recipient is UNAMBIGUOUS in today's data:
//   - ACTION_DUE_SOON / ACTION_OVERDUE  → Action.responsibleUserId
//   - ACTION_VERIFICATION_DUE           → Action.responsibleUserId (IMPLEMENTED)
//   - DOCUMENT_REVIEW_DUE               → Document.createdByUserId
// Events whose recipient needs role/permission routing (assessment review
// due, inspection due, incident reported, …) are reserved enum values with
// NO generator yet — they land with the per-tenant NotificationRule config
// and their owning modules (P6–P12). No recipient is ever invented; a record
// whose would-be recipient is null is simply skipped.
//
// Idempotent: createNotificationIfAbsent upserts on (recipientUserId,
// dedupeKey), so this is safe to run repeatedly (a manual "check for due
// items" button today; a scheduled EU job in production — deferred).
//
// A notification NEVER describes a person's behaviour or health (§3.18, plan
// §6): the stored title is the subject record's own name, the body is the
// site name — both data, no worker reference anywhere.

// German labels for the EMAIL channel only (DACH email language, matching the
// SGD/AWK German-only precedent). The in-app inbox localises the event badge
// itself at display time from the dashboard dictionary.
const EMAIL_EVENT_LABEL_DE: Partial<Record<NotificationEventType, string>> = {
  [EventType.ACTION_DUE_SOON]: "Maßnahme fällig",
  [EventType.ACTION_OVERDUE]: "Maßnahme überfällig",
  [EventType.ACTION_VERIFICATION_DUE]: "Wirksamkeitsprüfung fällig",
  [EventType.DOCUMENT_REVIEW_DUE]: "Dokumentenprüfung fällig",
};

export type GenerateOptions = {
  now?: Date;
  // Restrict generation to these site ids (the requesting user's scope).
  siteIds: string[];
  // When set, only materialise notifications whose resolved recipient is this
  // user (so a per-user "check" button never writes other users' inboxes).
  recipientUserId?: string;
};

export type GenerateResult = {
  scanned: number;
  created: number;
};

type Candidate = {
  recipientUserId: string;
  eventType: NotificationEventType;
  companyId: string | null;
  siteId: string | null;
  subjectType: string;
  subjectId: string;
  href: string;
  title: string;
  body: string;
  dueAt: Date | null;
};

export async function generateDueNotifications(
  options: GenerateOptions,
): Promise<GenerateResult> {
  const now = options.now ?? new Date();
  const { siteIds } = options;
  if (siteIds.length === 0) return { scanned: 0, created: 0 };

  const [actions, documents, sites] = await Promise.all([
    prisma.action.findMany({
      where: {
        siteId: { in: siteIds },
        responsibleUserId: { not: null },
        status: { in: ["OPEN", "IN_PROGRESS", "IMPLEMENTED"] },
      },
      select: {
        id: true,
        siteId: true,
        title: true,
        dueDate: true,
        status: true,
        responsibleUserId: true,
      },
    }),
    prisma.document.findMany({
      where: {
        siteId: { in: siteIds },
        createdByUserId: { not: null },
        reviewDueDate: { not: null },
      },
      select: {
        id: true,
        siteId: true,
        companyId: true,
        title: true,
        reviewDueDate: true,
        createdByUserId: true,
      },
    }),
    prisma.site.findMany({
      where: { id: { in: siteIds } },
      select: { id: true, name: true, companyId: true },
    }),
  ]);

  const siteById = new Map(sites.map((s) => [s.id, s]));
  const candidates: Candidate[] = [];
  let scanned = 0;

  for (const action of actions) {
    scanned++;
    const recipient = action.responsibleUserId;
    if (!recipient) continue;
    const site = siteById.get(action.siteId);
    const href = `/app/s/${action.siteId}/actions/${action.id}`;
    const base = {
      recipientUserId: recipient,
      companyId: site?.companyId ?? null,
      siteId: action.siteId,
      subjectType: "Action",
      subjectId: action.id,
      href,
      title: action.title,
      body: site?.name ?? "",
    };

    if (action.status === "IMPLEMENTED") {
      candidates.push({
        ...base,
        eventType: EventType.ACTION_VERIFICATION_DUE,
        dueAt: null,
      });
      continue;
    }
    // OPEN / IN_PROGRESS with a due date.
    if (isOverdue(action.dueDate, now)) {
      candidates.push({
        ...base,
        eventType: EventType.ACTION_OVERDUE,
        dueAt: action.dueDate,
      });
    } else if (isDueSoon(action.dueDate, now, ACTION_DUE_SOON_LEAD_DAYS)) {
      candidates.push({
        ...base,
        eventType: EventType.ACTION_DUE_SOON,
        dueAt: action.dueDate,
      });
    }
  }

  for (const doc of documents) {
    scanned++;
    const recipient = doc.createdByUserId;
    if (!recipient) continue;
    if (!isDueOrPast(doc.reviewDueDate, now, DOCUMENT_REVIEW_LEAD_DAYS)) {
      continue;
    }
    const site = siteById.get(doc.siteId);
    candidates.push({
      recipientUserId: recipient,
      eventType: EventType.DOCUMENT_REVIEW_DUE,
      companyId: doc.companyId,
      siteId: doc.siteId,
      subjectType: "Document",
      subjectId: doc.id,
      href: `/app/s/${doc.siteId}/documents/library`,
      title: doc.title,
      body: site?.name ?? "",
      dueAt: doc.reviewDueDate,
    });
  }

  const filtered = options.recipientUserId
    ? candidates.filter((c) => c.recipientUserId === options.recipientUserId)
    : candidates;

  // Resolve recipient emails in one query for the best-effort email channel.
  const recipientIds = [...new Set(filtered.map((c) => c.recipientUserId))];
  const users = await prisma.platformUser.findMany({
    where: { id: { in: recipientIds } },
    select: { id: true, email: true },
  });
  const emailById = new Map(users.map((u) => [u.id, u.email]));

  let created = 0;
  for (const c of filtered) {
    const emailLabel = EMAIL_EVENT_LABEL_DE[c.eventType] ?? "Benachrichtigung";
    const result = await createNotificationIfAbsent({
      recipientUserId: c.recipientUserId,
      recipientEmail: emailById.get(c.recipientUserId) ?? null,
      eventType: c.eventType,
      companyId: c.companyId,
      siteId: c.siteId,
      subjectType: c.subjectType,
      subjectId: c.subjectId,
      href: c.href,
      title: c.title,
      body: c.body,
      dueAt: c.dueAt,
      dedupeKey: buildDedupeKey(c.eventType, c.subjectId),
      emailSubject: `${emailLabel}: ${c.title}`,
      emailBody: `${emailLabel} — ${c.title}${c.body ? ` (${c.body})` : ""}${
        c.dueAt ? ` — ${c.dueAt.toISOString().slice(0, 10)}` : ""
      }`,
    });
    if (result) created++;
  }

  return { scanned, created };
}
