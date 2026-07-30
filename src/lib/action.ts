import {
  ActionStatus,
  type VerificationOutcome,
} from "@/generated/prisma/enums";
import type { ActionModel } from "@/generated/prisma/models";
import { prisma } from "@/lib/prisma";

// Deliberately no `import "server-only"` here — needs to be directly
// unit-testable via a mocked `@/lib/prisma`, same reasoning as
// assessment-session.ts.

// Legal Action status transitions. VERIFIED and CANCELLED are terminal —
// no transition table lists a status they lead to. Reverting from
// IN_PROGRESS back to OPEN, or IMPLEMENTED back to IN_PROGRESS, is
// allowed: real EHS work gets paused or turns out to need more work after
// all, and forcing a CANCELLED+recreate for that would corrupt the
// append-only ActionStatusEvent history instead of just recording the
// reversal as one more event.
export const ACTION_STATUS_TRANSITIONS: Readonly<
  Record<ActionStatus, readonly ActionStatus[]>
> = {
  [ActionStatus.OPEN]: [ActionStatus.IN_PROGRESS, ActionStatus.CANCELLED],
  [ActionStatus.IN_PROGRESS]: [
    ActionStatus.OPEN,
    ActionStatus.IMPLEMENTED,
    ActionStatus.CANCELLED,
  ],
  [ActionStatus.IMPLEMENTED]: [
    ActionStatus.IN_PROGRESS,
    ActionStatus.VERIFIED,
    ActionStatus.CANCELLED,
  ],
  [ActionStatus.VERIFIED]: [],
  [ActionStatus.CANCELLED]: [],
};

// Pure core — exported for direct unit testing, no DB involved. Checks
// transition legality against ACTION_STATUS_TRANSITIONS, and — the
// specific rule the demo's "verify effectiveness" step depends on — that a
// transition into VERIFIED always carries a verificationOutcome, plus
// either a verificationAssessmentId (the normal path: verified against a
// real re-assessment) or an explicit, non-empty verificationNote
// documenting why there isn't one. Verification can never be silent.
export function validateActionTransition(params: {
  fromStatus: ActionStatus;
  toStatus: ActionStatus;
  verificationOutcome?: VerificationOutcome | null;
  verificationAssessmentId?: string | null;
  verificationNote?: string | null;
}): void {
  const allowed = ACTION_STATUS_TRANSITIONS[params.fromStatus];
  if (!allowed.includes(params.toStatus)) {
    throw new Error(
      `Illegal Action status transition: ${params.fromStatus} -> ${params.toStatus}`,
    );
  }

  if (params.toStatus === ActionStatus.VERIFIED) {
    if (!params.verificationOutcome) {
      throw new Error(
        "Transitioning an Action to VERIFIED requires a verificationOutcome",
      );
    }
    if (!params.verificationAssessmentId && !params.verificationNote?.trim()) {
      throw new Error(
        "Transitioning an Action to VERIFIED requires either a " +
          "verificationAssessmentId or an explicit documented override " +
          "note (verificationNote) — verification cannot be silent",
      );
    }
  }
}

export type TransitionActionInput = {
  actionId: string;
  toStatus: ActionStatus;
  byUserId: string;
  note?: string | null;
  verificationOutcome?: VerificationOutcome | null;
  verificationAssessmentId?: string | null;
};

// The single gate for changing an Action's status. Validates the
// transition (see validateActionTransition), then updates Action and
// writes an append-only ActionStatusEvent row (§3.6) in the same
// transaction — the two must never drift apart.
export async function transitionAction(
  input: TransitionActionInput,
): Promise<ActionModel> {
  const action = await prisma.action.findUnique({
    where: { id: input.actionId },
    select: { status: true },
  });
  if (!action) {
    throw new Error(`Action ${input.actionId} does not exist`);
  }

  validateActionTransition({
    fromStatus: action.status,
    toStatus: input.toStatus,
    verificationOutcome: input.verificationOutcome ?? null,
    verificationAssessmentId: input.verificationAssessmentId ?? null,
    verificationNote: input.note ?? null,
  });

  return prisma.$transaction(async (tx) => {
    const updated = await tx.action.update({
      where: { id: input.actionId },
      data: {
        status: input.toStatus,
        ...(input.toStatus === ActionStatus.IMPLEMENTED
          ? { implementedAt: new Date() }
          : {}),
        ...(input.toStatus === ActionStatus.VERIFIED
          ? {
              verifiedAt: new Date(),
              verifiedByUserId: input.byUserId,
              verificationOutcome: input.verificationOutcome,
              verificationAssessmentId: input.verificationAssessmentId ?? null,
              verificationNote: input.note ?? null,
            }
          : {}),
      },
    });

    await tx.actionStatusEvent.create({
      data: {
        actionId: input.actionId,
        fromStatus: action.status,
        toStatus: input.toStatus,
        byUserId: input.byUserId,
        note: input.note ?? null,
      },
    });

    return updated;
  });
}
