import type { BroadcastStatus } from "@/generated/prisma/enums";

// Sicherheitsinformationen status machine. Pure + unit-tested, the same shape
// as ACTION_STATUS_TRANSITIONS and the inspection/incident transition tables.
//
// DRAFT → PUBLISHED → ARCHIVED, and nothing else. In particular:
//   * there is NO un-publish. Once a message has gone out to recipients,
//     pretending it did not is a lie about what people were told; a wrong
//     message is archived and replaced, which the append-only
//     BroadcastStatusEvent history records.
//   * ARCHIVED is terminal. An archived broadcast stays READABLE with its
//     confirmation list — that list is the proof the information was passed
//     on, so it must survive archiving.
export const BROADCAST_STATUS_TRANSITIONS: Readonly<
  Record<BroadcastStatus, readonly BroadcastStatus[]>
> = {
  DRAFT: ["PUBLISHED"],
  PUBLISHED: ["ARCHIVED"],
  ARCHIVED: [],
};

export type BroadcastTransitionCheck =
  | { ok: true }
  | { ok: false; reason: string };

export function validateBroadcastTransition(
  from: BroadcastStatus,
  to: BroadcastStatus,
): BroadcastTransitionCheck {
  const allowed = BROADCAST_STATUS_TRANSITIONS[from];
  if (!allowed) {
    return { ok: false, reason: `Unknown broadcast status: ${String(from)}` };
  }
  if (!allowed.includes(to)) {
    return {
      ok: false,
      reason:
        allowed.length === 0
          ? `${from} is terminal — a broadcast cannot leave it`
          : `A broadcast cannot go ${from} → ${to} (allowed: ${allowed.join(", ")})`,
    };
  }
  return { ok: true };
}

export type PublishableBroadcast = {
  title: string;
  body: string;
  audienceCount: number;
  requiresConfirmation: boolean;
  confirmationDueAt: Date | null;
};

// What has to be true before a message may go out. Fail-closed: an empty
// audience is the dangerous case (a broadcast nobody receives looks sent), and
// a confirmation deadline in the past would be overdue the second it is
// published.
export function validateBroadcastPublishable(
  broadcast: PublishableBroadcast,
  now: Date,
): BroadcastTransitionCheck {
  if (broadcast.title.trim().length === 0) {
    return { ok: false, reason: "A broadcast needs a title" };
  }
  if (broadcast.body.trim().length === 0) {
    return { ok: false, reason: "A broadcast needs a body" };
  }
  if (broadcast.audienceCount === 0) {
    return { ok: false, reason: "A broadcast needs at least one audience" };
  }
  if (
    broadcast.confirmationDueAt !== null &&
    broadcast.confirmationDueAt.getTime() <= now.getTime()
  ) {
    return {
      ok: false,
      reason: "The confirmation deadline must be in the future",
    };
  }
  if (!broadcast.requiresConfirmation && broadcast.confirmationDueAt !== null) {
    return {
      ok: false,
      reason:
        "A confirmation deadline is only meaningful when a confirmation is required",
    };
  }
  return { ok: true };
}
