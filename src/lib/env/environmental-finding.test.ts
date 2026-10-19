import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    environmentalFinding: { create: vi.fn() },
    environmentalCategoryCheck: { updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { createEnvironmentalFinding } from "./environmental-finding";

beforeEach(() => {
  vi.mocked(prisma.environmentalFinding.create).mockReset();
  vi.mocked(prisma.environmentalCategoryCheck.updateMany).mockReset();
  vi.mocked(prisma.$transaction).mockReset();
  vi.mocked(prisma.$transaction).mockImplementation(((cb: never) =>
    (cb as (tx: typeof prisma) => unknown)(prisma)) as never);
});

describe("createEnvironmentalFinding", () => {
  it("stores significant=true for an ELEVATED finding and flips the category", async () => {
    vi.mocked(prisma.environmentalFinding.create).mockResolvedValue({
      id: "ef1",
    } as never);
    vi.mocked(prisma.environmentalCategoryCheck.updateMany).mockResolvedValue(
      {} as never,
    );

    await createEnvironmentalFinding({
      environmentalAssessmentId: "ea1",
      environmentalAspectId: "asp1",
      category: "WASTE_HAZARDOUS",
      probability: 3,
      severity: 4,
      riskScore: 12,
      riskBand: "ELEVATED",
      operatingCondition: "NORMAL",
      legallyRelevant: false,
    });

    expect(prisma.environmentalFinding.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        environmentalAspectId: "asp1",
        operatingCondition: "NORMAL",
        significant: true,
      }),
    });
    expect(prisma.environmentalCategoryCheck.updateMany).toHaveBeenCalledWith({
      where: {
        environmentalAssessmentId: "ea1",
        category: "WASTE_HAZARDOUS",
      },
      data: { status: "HAZARD_PRESENT" },
    });
  });

  it("stores significant=true for a legally-relevant LOW finding", async () => {
    vi.mocked(prisma.environmentalFinding.create).mockResolvedValue({
      id: "ef2",
    } as never);
    vi.mocked(prisma.environmentalCategoryCheck.updateMany).mockResolvedValue(
      {} as never,
    );

    await createEnvironmentalFinding({
      environmentalAssessmentId: "ea1",
      environmentalAspectId: "asp2",
      category: "WASTEWATER",
      probability: 1,
      severity: 2,
      riskScore: 2,
      riskBand: "LOW",
      operatingCondition: "ABNORMAL",
      legallyRelevant: true,
    });

    expect(prisma.environmentalFinding.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        significant: true,
        legallyRelevant: true,
      }),
    });
  });

  it("stores significant=false for a LOW finding that is not legally relevant", async () => {
    vi.mocked(prisma.environmentalFinding.create).mockResolvedValue({
      id: "ef3",
    } as never);
    vi.mocked(prisma.environmentalCategoryCheck.updateMany).mockResolvedValue(
      {} as never,
    );

    await createEnvironmentalFinding({
      environmentalAssessmentId: "ea1",
      environmentalAspectId: "asp3",
      category: "ENERGY_USE",
      probability: 1,
      severity: 2,
      riskScore: 2,
      riskBand: "LOW",
      operatingCondition: "NORMAL",
      legallyRelevant: false,
    });

    expect(prisma.environmentalFinding.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ significant: false }),
    });
  });
});
