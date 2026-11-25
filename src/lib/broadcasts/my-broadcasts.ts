import "server-only";

import type { PlatformUserModel } from "@/generated/prisma/models";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { selfPersonId } from "@/lib/auth/scope";
import { prisma } from "@/lib/prisma";

// The RECIPIENT side: what a signed-in user was addressed with, and the two
// stamps they can set on it (read, confirmed).
//
// A recipient row is found by the login account OR by the linked Person — a
// worker addressed through their workstation has a personId row, and once they
// have an account the publish-time merge puts both ids on the same row. Looking
// both ways means an employee provisioned AFTER publishing still finds their
// message (the person side matches), which is the common case for access-code
// accounts.

export type MyBroadcast = {
  recipientId: string;
  broadcastId: string;
  title: string;
  body: string;
  priority: "INFO" | "SAFETY_ALERT";
  domain: "OSH" | "ENVIRONMENT" | "GENERAL";
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  publishedAt: Date | null;
  requiresConfirmation: boolean;
  confirmationDueAt: Date | null;
  readAt: Date | null;
  confirmedAt: Date | null;
  siteId: string | null;
};

async function recipientWhere(user: PlatformUserModel) {
  const personId = await selfPersonId(user);
  return {
    OR: [{ platformUserId: user.id }, ...(personId ? [{ personId }] : [])],
  };
}

// Everything addressed to this user that has actually been published. A DRAFT
// has no recipients at all, so there is nothing to hide here; ARCHIVED stays
// visible because the message was still something they were told.
export async function listMyBroadcasts(
  user: PlatformUserModel,
): Promise<MyBroadcast[]> {
  const rows = await prisma.broadcastRecipient.findMany({
    where: {
      ...(await recipientWhere(user)),
      broadcast: { status: { in: ["PUBLISHED", "ARCHIVED"] } },
    },
    orderBy: [{ confirmedAt: { sort: "asc", nulls: "first" } }],
    select: {
      id: true,
      readAt: true,
      confirmedAt: true,
      broadcast: {
        select: {
          id: true,
          title: true,
          body: true,
          priority: true,
          domain: true,
          status: true,
          publishedAt: true,
          requiresConfirmation: true,
          confirmationDueAt: true,
          siteId: true,
        },
      },
    },
  });
  return rows
    .map((r) => ({
      recipientId: r.id,
      broadcastId: r.broadcast.id,
      title: r.broadcast.title,
      body: r.broadcast.body,
      priority: r.broadcast.priority,
      domain: r.broadcast.domain,
      status: r.broadcast.status,
      publishedAt: r.broadcast.publishedAt,
      requiresConfirmation: r.broadcast.requiresConfirmation,
      confirmationDueAt: r.broadcast.confirmationDueAt,
      readAt: r.readAt,
      confirmedAt: r.confirmedAt,
      siteId: r.broadcast.siteId,
    }))
    .sort((a, b) => {
      // Unconfirmed safety alerts first, then by publication date.
      const weight = (x: MyBroadcast) =>
        x.priority === "SAFETY_ALERT" && x.confirmedAt === null ? 0 : 1;
      const w = weight(a) - weight(b);
      if (w !== 0) return w;
      return (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0);
    });
}

export async function getMyBroadcast(
  user: PlatformUserModel,
  broadcastId: string,
): Promise<MyBroadcast | null> {
  const all = await listMyBroadcasts(user);
  return all.find((b) => b.broadcastId === broadcastId) ?? null;
}

// The blocking/banner set: published safety alerts this user has not confirmed
// yet, plus anything whose confirmation is still outstanding. An INFO message
// with no confirmation requirement never blocks.
export async function listOutstandingForUser(
  user: PlatformUserModel,
): Promise<MyBroadcast[]> {
  const all = await listMyBroadcasts(user);
  return all.filter(
    (b) =>
      b.status === "PUBLISHED" &&
      b.confirmedAt === null &&
      (b.priority === "SAFETY_ALERT" || b.requiresConfirmation),
  );
}

// Reading is a fact, not a claim: stamped the first time the recipient opens
// the message, never overwritten (the first time is the one that matters).
export async function markBroadcastRead(input: {
  user: PlatformUserModel;
  broadcastId: string;
  now?: Date;
}): Promise<void> {
  const now = input.now ?? new Date();
  const where = await recipientWhere(input.user);
  const result = await prisma.broadcastRecipient.updateMany({
    where: { ...where, broadcastId: input.broadcastId, readAt: null },
    data: { readAt: now },
  });
  if (result.count > 0) {
    await recordAuditEvent({
      actorUserId: input.user.id,
      action: "broadcast.read",
      entityType: "Broadcast",
      entityId: input.broadcastId,
      companyId: input.user.companyId,
    });
  }
}
