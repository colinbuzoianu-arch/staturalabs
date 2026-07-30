import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    action: { findUnique: vi.fn(), update: vi.fn() },
    actionStatusEvent: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import {
  ACTION_STATUS_TRANSITIONS,
  transitionAction,
  validateActionTransition,
} from "./action";

describe("validateActionTransition (pure)", () => {
  it("allows every transition listed in ACTION_STATUS_TRANSITIONS", () => {
    for (const [from, tos] of Object.entries(ACTION_STATUS_TRANSITIONS)) {
      for (const to of tos) {
        expect(() =>
          validateActionTransition({
            fromStatus: from as never,
            toStatus: to,
            verificationOutcome: to === "VERIFIED" ? "EFFECTIVE" : null,
            verificationAssessmentId: to === "VERIFIED" ? "ra1" : null,
          }),
        ).not.toThrow();
      }
    }
  });

  it("rejects a transition not listed as legal (e.g. OPEN -> VERIFIED)", () => {
    expect(() =>
      validateActionTransition({ fromStatus: "OPEN", toStatus: "VERIFIED" }),
    ).toThrow(/Illegal Action status transition/);
  });

  it("rejects any transition out of a terminal state (VERIFIED)", () => {
    expect(() =>
      validateActionTransition({
        fromStatus: "VERIFIED",
        toStatus: "IN_PROGRESS",
      }),
    ).toThrow(/Illegal Action status transition/);
  });

  it("rejects any transition out of a terminal state (CANCELLED)", () => {
    expect(() =>
      validateActionTransition({ fromStatus: "CANCELLED", toStatus: "OPEN" }),
    ).toThrow(/Illegal Action status transition/);
  });

  it("rejects -> VERIFIED without a verificationOutcome", () => {
    expect(() =>
      validateActionTransition({
        fromStatus: "IMPLEMENTED",
        toStatus: "VERIFIED",
        verificationAssessmentId: "ra1",
      }),
    ).toThrow(/requires a verificationOutcome/);
  });

  it("rejects -> VERIFIED with an outcome but neither a re-assessment nor an override note", () => {
    expect(() =>
      validateActionTransition({
        fromStatus: "IMPLEMENTED",
        toStatus: "VERIFIED",
        verificationOutcome: "EFFECTIVE",
      }),
    ).toThrow(/verification cannot be silent/);
  });

  it("rejects -> VERIFIED when the override note is present but blank", () => {
    expect(() =>
      validateActionTransition({
        fromStatus: "IMPLEMENTED",
        toStatus: "VERIFIED",
        verificationOutcome: "EFFECTIVE",
        verificationNote: "   ",
      }),
    ).toThrow(/verification cannot be silent/);
  });

  it("allows -> VERIFIED with an outcome and a verificationAssessmentId, no note needed", () => {
    expect(() =>
      validateActionTransition({
        fromStatus: "IMPLEMENTED",
        toStatus: "VERIFIED",
        verificationOutcome: "EFFECTIVE",
        verificationAssessmentId: "ra1",
      }),
    ).not.toThrow();
  });

  it("allows -> VERIFIED with an outcome and a documented override note, no re-assessment needed", () => {
    expect(() =>
      validateActionTransition({
        fromStatus: "IMPLEMENTED",
        toStatus: "VERIFIED",
        verificationOutcome: "NOT_EFFECTIVE",
        verificationNote:
          "Verified by direct site visit; re-assessment session not yet captured.",
      }),
    ).not.toThrow();
  });
});

describe("transitionAction", () => {
  beforeEach(() => {
    vi.mocked(prisma.action.findUnique).mockReset();
    vi.mocked(prisma.action.update).mockReset();
    vi.mocked(prisma.actionStatusEvent.create).mockReset();
    vi.mocked(prisma.$transaction).mockReset();
    vi.mocked(prisma.$transaction).mockImplementation(((cb: never) =>
      (cb as (tx: typeof prisma) => unknown)(prisma)) as never);
  });

  it("throws if the action does not exist, without opening a transaction", async () => {
    vi.mocked(prisma.action.findUnique).mockResolvedValue(null);

    await expect(
      transitionAction({
        actionId: "ghost",
        toStatus: "IN_PROGRESS",
        byUserId: "00000000-0000-0000-0000-000000000001",
      }),
    ).rejects.toThrow(/does not exist/);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects an illegal transition before opening a transaction", async () => {
    vi.mocked(prisma.action.findUnique).mockResolvedValue({
      status: "OPEN",
    } as never);

    await expect(
      transitionAction({
        actionId: "a1",
        toStatus: "VERIFIED",
        byUserId: "00000000-0000-0000-0000-000000000001",
      }),
    ).rejects.toThrow(/Illegal Action status transition/);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("updates the Action and writes an ActionStatusEvent in the same transaction", async () => {
    vi.mocked(prisma.action.findUnique).mockResolvedValue({
      status: "OPEN",
    } as never);
    vi.mocked(prisma.action.update).mockResolvedValue({
      id: "a1",
      status: "IN_PROGRESS",
    } as never);
    vi.mocked(prisma.actionStatusEvent.create).mockResolvedValue({
      id: "e1",
    } as never);

    await transitionAction({
      actionId: "a1",
      toStatus: "IN_PROGRESS",
      byUserId: "00000000-0000-0000-0000-000000000001",
      note: "starting work",
    });

    expect(prisma.action.update).toHaveBeenCalledWith({
      where: { id: "a1" },
      data: { status: "IN_PROGRESS" },
    });
    expect(prisma.actionStatusEvent.create).toHaveBeenCalledWith({
      data: {
        actionId: "a1",
        fromStatus: "OPEN",
        toStatus: "IN_PROGRESS",
        byUserId: "00000000-0000-0000-0000-000000000001",
        note: "starting work",
      },
    });
  });

  it("stamps implementedAt when transitioning to IMPLEMENTED", async () => {
    vi.mocked(prisma.action.findUnique).mockResolvedValue({
      status: "IN_PROGRESS",
    } as never);
    vi.mocked(prisma.action.update).mockResolvedValue({} as never);
    vi.mocked(prisma.actionStatusEvent.create).mockResolvedValue({} as never);

    await transitionAction({
      actionId: "a1",
      toStatus: "IMPLEMENTED",
      byUserId: "00000000-0000-0000-0000-000000000001",
    });

    const call = vi.mocked(prisma.action.update).mock.calls[0]?.[0];
    expect(call?.data).toMatchObject({ status: "IMPLEMENTED" });
    expect(call?.data.implementedAt).toBeInstanceOf(Date);
  });

  it("stamps verification fields when transitioning to VERIFIED", async () => {
    vi.mocked(prisma.action.findUnique).mockResolvedValue({
      status: "IMPLEMENTED",
    } as never);
    vi.mocked(prisma.action.update).mockResolvedValue({} as never);
    vi.mocked(prisma.actionStatusEvent.create).mockResolvedValue({} as never);

    await transitionAction({
      actionId: "a1",
      toStatus: "VERIFIED",
      byUserId: "00000000-0000-0000-0000-000000000001",
      verificationOutcome: "EFFECTIVE",
      verificationAssessmentId: "ra1",
    });

    const call = vi.mocked(prisma.action.update).mock.calls[0]?.[0];
    expect(call?.data).toMatchObject({
      status: "VERIFIED",
      verifiedByUserId: "00000000-0000-0000-0000-000000000001",
      verificationOutcome: "EFFECTIVE",
      verificationAssessmentId: "ra1",
    });
    expect(call?.data.verifiedAt).toBeInstanceOf(Date);
  });
});
