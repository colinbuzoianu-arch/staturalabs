import type {
  BroadcastModel,
  PlatformUserModel,
} from "@/generated/prisma/models";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { appUrl } from "@/lib/config/base-url";
import { createNotificationIfAbsent } from "@/lib/notifications/service";
import { prisma } from "@/lib/prisma";
import {
  assertAudienceWithinSenderScope,
  BroadcastGateError,
} from "./broadcast";
import { newRecipientsSince } from "./recipient-merge";
import { resolveBroadcastRecipients } from "./resolve-recipients";
import { broadcastBodyToText } from "./sanitise";
import {
  validateBroadcastPublishable,
  validateBroadcastTransition,
} from "./transitions";

// Publishing: resolve the audience into a RECIPIENT SNAPSHOT, stamp the
// broadcast, write the append-only status event, and deliver.
//
// The snapshot is the whole point of the "fixed at publishing" rule: a
// confirmation list is only proof if it says who was addressed AT THE TIME.
// Someone who joins the department next week is not retroactively someone who
// failed to confirm — they are added only when the sender clicks
// "Empfänger aktualisieren".
//
// Delivery reuses the P5 notification service (which also does the best-effort
// e-mail through the one provider abstraction); there is no second
// notification or confirmation mechanism anywhere in this module.

const EVENT_LABEL_DE = {
  INFO: "Sicherheitsinformation",
  SAFETY_ALERT: "Sicherheitswarnung",
} as const;

// The in-app link a recipient follows. Relative, so it is base-path safe
// (sandbox rule 1); the e-mail gets the absolute form from the ONE configured
// base URL (rule 2) and simply omits the link when none is configured.
export function broadcastInboxHref(broadcastId: string): string {
  return `/app/me/broadcasts/${broadcastId}`;
}

function emailBody(
  broadcast: Pick<
    BroadcastModel,
    "title" | "body" | "confirmationDueAt" | "requiresConfirmation"
  >,
): string {
  const text = broadcastBodyToText(broadcast.body);
  const lines = [broadcast.title, "", text];
  if (broadcast.requiresConfirmation) {
    lines.push(
      "",
      broadcast.confirmationDueAt
        ? `Bitte bis ${broadcast.confirmationDueAt.toISOString().slice(0, 10)} mit "Gelesen und verstanden" bestätigen.`
        : 'Bitte mit "Gelesen und verstanden" bestätigen.',
    );
  }
  return lines.join("\n");
}

async function notifyRecipients(input: {
  broadcast: BroadcastModel;
  recipientUserIds: readonly string[];
}): Promise<number> {
  const { broadcast } = input;
  if (input.recipientUserIds.length === 0) return 0;

  const users = await prisma.platformUser.findMany({
    where: { id: { in: [...input.recipientUserIds] } },
    select: { id: true, email: true },
  });
  const href = broadcastInboxHref(broadcast.id);
  const absolute = appUrl(href);
  const label = EVENT_LABEL_DE[broadcast.priority];
  const bodyText = broadcastBodyToText(broadcast.body);
  let created = 0;

  for (const user of users) {
    const result = await createNotificationIfAbsent({
      recipientUserId: user.id,
      // A synthetic .invalid address (an access-code account, P17 §5) must
      // never be mailed — it cannot receive, and sending would only produce
      // bounces. Those recipients get the in-app blocking card instead.
      recipientEmail: user.email.endsWith("@employee.sld.invalid")
        ? null
        : user.email,
      eventType: "BROADCAST_PUBLISHED",
      companyId: broadcast.companyId,
      siteId: broadcast.siteId,
      subjectType: "Broadcast",
      subjectId: broadcast.id,
      href,
      title: broadcast.title,
      // The notification body is the message's own text — never a description
      // of a person (§3.18).
      body: bodyText.slice(0, 500),
      dueAt: broadcast.confirmationDueAt,
      // One notification per recipient per broadcast; a refresh re-runs this
      // and the service's (recipient, dedupeKey) upsert keeps it idempotent.
      dedupeKey: `broadcast:${broadcast.id}`,
      emailSubject: `[${label}] ${broadcast.title}`,
      emailBody: absolute
        ? `${emailBody(broadcast)}\n\n${absolute}`
        : emailBody(broadcast),
    });
    if (result) created += 1;
  }
  return created;
}

export type PublishResult = {
  broadcast: BroadcastModel;
  recipientCount: number;
  notifiedCount: number;
};

export async function publishBroadcast(input: {
  broadcastId: string;
  user: PlatformUserModel;
  now?: Date;
}): Promise<PublishResult> {
  const now = input.now ?? new Date();
  const broadcast = await prisma.broadcast.findUnique({
    where: { id: input.broadcastId },
    include: { audiences: true },
  });
  if (!broadcast) throw new BroadcastGateError("not-found");

  const transition = validateBroadcastTransition(broadcast.status, "PUBLISHED");
  if (!transition.ok) throw new BroadcastGateError(transition.reason);

  const publishable = validateBroadcastPublishable(
    {
      title: broadcast.title,
      body: broadcast.body,
      audienceCount: broadcast.audiences.length,
      requiresConfirmation: broadcast.requiresConfirmation,
      confirmationDueAt: broadcast.confirmationDueAt,
    },
    now,
  );
  if (!publishable.ok) throw new BroadcastGateError(publishable.reason);

  // Re-check the audience against the sender's CURRENT scope: a draft may have
  // been composed before a role or site assignment was revoked.
  await assertAudienceWithinSenderScope({
    user: input.user,
    companyId: broadcast.companyId,
    siteId: broadcast.siteId,
    audiences: broadcast.audiences.map((a) => ({
      scope: a.scope,
      siteId: a.siteId,
      orgUnitId: a.orgUnitId,
      workstationId: a.workstationId,
      role: a.role,
    })),
  });

  const resolved = await resolveBroadcastRecipients(broadcast);
  if (resolved.length === 0) {
    // An audience that resolves to nobody is a mistake worth surfacing, not a
    // message to send into the void.
    throw new BroadcastGateError("audience-resolves-to-nobody");
  }

  const published = await prisma.$transaction(async (tx) => {
    const row = await tx.broadcast.update({
      where: { id: broadcast.id },
      data: { status: "PUBLISHED", publishedAt: now },
    });
    for (const recipient of resolved) {
      await tx.broadcastRecipient.create({
        data: {
          broadcastId: broadcast.id,
          platformUserId: recipient.platformUserId,
          personId: recipient.personId,
          audienceId: recipient.audienceId,
          // Delivered = the message is available to them in the app. The
          // e-mail is a secondary channel and may legitimately not exist.
          deliveredAt: now,
        },
      });
    }
    await tx.broadcastStatusEvent.create({
      data: {
        broadcastId: broadcast.id,
        fromStatus: broadcast.status,
        toStatus: "PUBLISHED",
        note: `${resolved.length} Empfänger`,
        actorUserId: input.user.id,
      },
    });
    return row;
  });

  const notifiedCount = await notifyRecipients({
    broadcast: published,
    recipientUserIds: resolved
      .map((r) => r.platformUserId)
      .filter((id): id is string => id !== null),
  });

  await recordAuditEvent({
    actorUserId: input.user.id,
    action: "broadcast.publish",
    entityType: "Broadcast",
    entityId: broadcast.id,
    companyId: broadcast.companyId,
    siteId: broadcast.siteId,
    diff: {
      priority: broadcast.priority,
      recipientCount: resolved.length,
      notified: notifiedCount,
      requiresConfirmation: broadcast.requiresConfirmation,
    },
  });

  return {
    broadcast: published,
    recipientCount: resolved.length,
    notifiedCount,
  };
}

export type RefreshResult = { added: number; notified: number };

// "Empfänger aktualisieren": add the people who have joined the audience since
// publishing. Existing rows are never touched — their readAt/confirmedAt
// stamps are the proof trail — and nobody is ever removed, because "this
// person was addressed" stays true even after they move on.
export async function refreshBroadcastRecipients(input: {
  broadcastId: string;
  user: PlatformUserModel;
  now?: Date;
}): Promise<RefreshResult> {
  const now = input.now ?? new Date();
  const broadcast = await prisma.broadcast.findUnique({
    where: { id: input.broadcastId },
    include: { audiences: true, recipients: true },
  });
  if (!broadcast) throw new BroadcastGateError("not-found");
  if (broadcast.status !== "PUBLISHED") {
    throw new BroadcastGateError("only-published-refreshable");
  }

  const resolved = await resolveBroadcastRecipients(broadcast);
  const added = newRecipientsSince(
    broadcast.recipients.map((r) => ({
      platformUserId: r.platformUserId,
      personId: r.personId,
    })),
    resolved,
  );

  if (added.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const recipient of added) {
        await tx.broadcastRecipient.create({
          data: {
            broadcastId: broadcast.id,
            platformUserId: recipient.platformUserId,
            personId: recipient.personId,
            audienceId: recipient.audienceId,
            deliveredAt: now,
          },
        });
      }
      await tx.broadcast.update({
        where: { id: broadcast.id },
        data: { recipientsRefreshedAt: now },
      });
    });
  } else {
    await prisma.broadcast.update({
      where: { id: broadcast.id },
      data: { recipientsRefreshedAt: now },
    });
  }

  const notified = await notifyRecipients({
    broadcast,
    recipientUserIds: added
      .map((r) => r.platformUserId)
      .filter((id): id is string => id !== null),
  });

  await recordAuditEvent({
    actorUserId: input.user.id,
    action: "broadcast.refresh_recipients",
    entityType: "Broadcast",
    entityId: broadcast.id,
    companyId: broadcast.companyId,
    siteId: broadcast.siteId,
    diff: { added: added.length, notified },
  });

  return { added: added.length, notified };
}
