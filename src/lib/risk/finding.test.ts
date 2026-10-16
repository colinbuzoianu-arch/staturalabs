import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    riskFinding: { create: vi.fn(), count: vi.fn() },
    hazardCategoryCheck: { updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("./psychosocial-finding", () => ({
  createPsychosocialFinding: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import {
  CategoryStatusConflictError,
  createFinding,
  setHazardCategoryStatus,
} from "./finding";
import { createPsychosocialFinding } from "./psychosocial-finding";

beforeEach(() => {
  vi.mocked(prisma.riskFinding.create).mockReset();
  vi.mocked(prisma.riskFinding.count).mockReset();
  vi.mocked(prisma.hazardCategoryCheck.updateMany).mockReset();
  vi.mocked(prisma.$transaction).mockReset();
  vi.mocked(prisma.$transaction).mockImplementation(((cb: never) =>
    (cb as (tx: typeof prisma) => unknown)(prisma)) as never);
  vi.mocked(createPsychosocialFinding).mockReset();
});

describe("createFinding", () => {
  it("creates a plain finding and flips the category to HAZARD_PRESENT in one transaction", async () => {
    vi.mocked(prisma.riskFinding.create).mockResolvedValue({
      id: "rf1",
    } as never);
    vi.mocked(prisma.hazardCategoryCheck.updateMany).mockResolvedValue(
      {} as never,
    );

    const result = await createFinding({
      riskAssessmentId: "ra1",
      hazardId: "h1",
      category: "NOISE",
      probability: 3,
      severity: 3,
      riskScore: 9,
      riskBand: "MODERATE",
    });

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.riskFinding.create).toHaveBeenCalled();
    expect(prisma.hazardCategoryCheck.updateMany).toHaveBeenCalledWith({
      where: { riskAssessmentId: "ra1", category: "NOISE" },
      data: { status: "HAZARD_PRESENT" },
    });
    expect(createPsychosocialFinding).not.toHaveBeenCalled();
    expect(result).toEqual({ id: "rf1" });
  });

  it("routes a psychosocial finding through createPsychosocialFinding, then flips the category", async () => {
    vi.mocked(createPsychosocialFinding).mockResolvedValue({
      id: "rf2",
    } as never);
    vi.mocked(prisma.hazardCategoryCheck.updateMany).mockResolvedValue(
      {} as never,
    );

    await createFinding({
      riskAssessmentId: "ra1",
      hazardId: "h2",
      category: "PSYCHOSOCIAL",
      probability: 2,
      severity: 3,
      riskScore: 6,
      riskBand: "MODERATE",
      dimension: "WORK_ORGANIZATION",
      method: "GROUP_DISCUSSION",
      groupSize: 6,
    });

    expect(createPsychosocialFinding).toHaveBeenCalledWith(
      expect.objectContaining({
        riskAssessmentId: "ra1",
        hazardId: "h2",
        dimension: "WORK_ORGANIZATION",
        method: "GROUP_DISCUSSION",
        groupSize: 6,
      }),
    );
    expect(prisma.hazardCategoryCheck.updateMany).toHaveBeenCalledWith({
      where: { riskAssessmentId: "ra1", category: "PSYCHOSOCIAL" },
      data: { status: "HAZARD_PRESENT" },
    });
    expect(prisma.riskFinding.create).not.toHaveBeenCalled();
  });

  it("rejects a psychosocial finding missing its required detail", async () => {
    await expect(
      createFinding({
        riskAssessmentId: "ra1",
        hazardId: "h2",
        category: "PSYCHOSOCIAL",
        probability: 2,
        severity: 3,
        riskScore: 6,
        riskBand: "MODERATE",
      }),
    ).rejects.toThrow(/dimension, method, and group size/);
    expect(createPsychosocialFinding).not.toHaveBeenCalled();
  });
});

describe("setHazardCategoryStatus", () => {
  it("rejects an empty rationale before touching the DB", async () => {
    await expect(
      setHazardCategoryStatus({
        riskAssessmentId: "ra1",
        category: "LIGHTING",
        status: "CHECKED_NO_HAZARD",
        rationale: "   ",
        checkedByUserId: "00000000-0000-0000-0000-000000000001",
      }),
    ).rejects.toThrow(/rationale is required/);
    expect(prisma.riskFinding.count).not.toHaveBeenCalled();
    expect(prisma.hazardCategoryCheck.updateMany).not.toHaveBeenCalled();
  });

  it("refuses to mark a category with an existing finding as not-applicable/no-hazard", async () => {
    vi.mocked(prisma.riskFinding.count).mockResolvedValue(1 as never);

    await expect(
      setHazardCategoryStatus({
        riskAssessmentId: "ra1",
        category: "NOISE",
        status: "NOT_APPLICABLE",
        rationale: "not relevant here",
        checkedByUserId: "00000000-0000-0000-0000-000000000001",
      }),
    ).rejects.toBeInstanceOf(CategoryStatusConflictError);
    expect(prisma.hazardCategoryCheck.updateMany).not.toHaveBeenCalled();
  });

  it("records the status, trimmed rationale, and checker when there is no conflict", async () => {
    vi.mocked(prisma.riskFinding.count).mockResolvedValue(0 as never);
    vi.mocked(prisma.hazardCategoryCheck.updateMany).mockResolvedValue(
      {} as never,
    );

    await setHazardCategoryStatus({
      riskAssessmentId: "ra1",
      category: "RADIATION",
      status: "NOT_APPLICABLE",
      rationale: "  no radiation sources on this line  ",
      checkedByUserId: "00000000-0000-0000-0000-000000000009",
    });

    expect(prisma.hazardCategoryCheck.updateMany).toHaveBeenCalledWith({
      where: { riskAssessmentId: "ra1", category: "RADIATION" },
      data: expect.objectContaining({
        status: "NOT_APPLICABLE",
        rationale: "no radiation sources on this line",
        checkedByUserId: "00000000-0000-0000-0000-000000000009",
      }),
    });
  });
});
