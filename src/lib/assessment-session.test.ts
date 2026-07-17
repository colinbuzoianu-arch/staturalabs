import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { assessmentSession: { create: vi.fn() } },
}));

import { AssessmentMode } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { createAssessmentSession } from "./assessment-session";

describe("createAssessmentSession", () => {
  beforeEach(() => {
    vi.mocked(prisma.assessmentSession.create).mockReset();
  });

  it("throws a clear not-yet-implemented error for mode: CONTINUOUS, without touching the DB", async () => {
    await expect(
      createAssessmentSession({
        workstationId: "ws1",
        startedAt: new Date(),
        mode: AssessmentMode.CONTINUOUS,
      }),
    ).rejects.toThrow(/not yet implemented/i);

    expect(prisma.assessmentSession.create).not.toHaveBeenCalled();
  });

  it("creates a SCHEDULED session when mode is passed explicitly", async () => {
    vi.mocked(prisma.assessmentSession.create).mockResolvedValue({
      id: "s1",
      mode: "SCHEDULED",
    } as never);

    const startedAt = new Date("2026-07-16T00:00:00Z");
    await createAssessmentSession({
      workstationId: "ws1",
      startedAt,
      mode: AssessmentMode.SCHEDULED,
    });

    expect(prisma.assessmentSession.create).toHaveBeenCalledWith({
      data: {
        workstationId: "ws1",
        mode: "SCHEDULED",
        pilotContext: null,
        startedAt,
        endedAt: null,
        notes: null,
      },
    });
  });

  it("passes pilotContext through when given, and defaults it to null otherwise", async () => {
    vi.mocked(prisma.assessmentSession.create).mockResolvedValue({
      id: "s1",
    } as never);

    await createAssessmentSession({
      workstationId: "ws1",
      startedAt: new Date("2026-07-16T00:00:00Z"),
      pilotContext:
        "technical pilot at partner site X, no commercial engagement",
    });

    expect(prisma.assessmentSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pilotContext:
            "technical pilot at partner site X, no commercial engagement",
        }),
      }),
    );
  });

  it("defaults to SCHEDULED when mode is omitted — never rides on the DB column default", async () => {
    vi.mocked(prisma.assessmentSession.create).mockResolvedValue({
      id: "s1",
      mode: "SCHEDULED",
    } as never);

    await createAssessmentSession({
      workstationId: "ws1",
      startedAt: new Date("2026-07-16T00:00:00Z"),
    });

    expect(prisma.assessmentSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ mode: "SCHEDULED" }),
      }),
    );
  });
});
