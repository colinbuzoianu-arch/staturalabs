import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    riskAssessment: { create: vi.fn() },
    hazardCategoryCheck: { createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("./matrix-version", () => ({
  getActiveRiskMatrixVersion: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { ALL_HAZARD_CATEGORIES } from "./category-check";
import { getActiveRiskMatrixVersion } from "./matrix-version";
import {
  createRiskAssessment,
  validateExactlyOneSubject,
} from "./risk-assessment";

describe("validateExactlyOneSubject (pure)", () => {
  it("passes with only a workstationId", () => {
    expect(() => validateExactlyOneSubject("ws1", null)).not.toThrow();
  });

  it("passes with only a processId", () => {
    expect(() => validateExactlyOneSubject(null, "p1")).not.toThrow();
  });

  it("throws when both are provided", () => {
    expect(() => validateExactlyOneSubject("ws1", "p1")).toThrow(
      /both were provided/,
    );
  });

  it("throws when neither is provided", () => {
    expect(() => validateExactlyOneSubject(null, null)).toThrow(
      /neither was provided/,
    );
  });
});

describe("createRiskAssessment", () => {
  beforeEach(() => {
    vi.mocked(prisma.riskAssessment.create).mockReset();
    vi.mocked(prisma.hazardCategoryCheck.createMany).mockReset();
    vi.mocked(prisma.$transaction).mockReset();
    vi.mocked(prisma.$transaction).mockImplementation(((cb: never) =>
      (cb as (tx: typeof prisma) => unknown)(prisma)) as never);
    vi.mocked(getActiveRiskMatrixVersion).mockReset();
  });

  it("rejects both workstationId and processId being set, without resolving a matrix version or touching the DB", async () => {
    await expect(
      createRiskAssessment({
        siteId: "site1",
        workstationId: "ws1",
        processId: "p1",
        assessorUserId: "00000000-0000-0000-0000-000000000001",
        assessedAt: new Date(),
      }),
    ).rejects.toThrow(/both were provided/);

    expect(getActiveRiskMatrixVersion).not.toHaveBeenCalled();
    expect(prisma.riskAssessment.create).not.toHaveBeenCalled();
    expect(prisma.hazardCategoryCheck.createMany).not.toHaveBeenCalled();
  });

  it("resolves the matrix version from the active row rather than accepting one as input", async () => {
    vi.mocked(getActiveRiskMatrixVersion).mockResolvedValue("v1-generic-5x5");
    vi.mocked(prisma.riskAssessment.create).mockResolvedValue({
      id: "ra1",
    } as never);
    vi.mocked(prisma.hazardCategoryCheck.createMany).mockResolvedValue(
      {} as never,
    );

    const assessedAt = new Date("2026-07-30T00:00:00Z");
    await createRiskAssessment({
      siteId: "site1",
      workstationId: "ws1",
      assessorUserId: "00000000-0000-0000-0000-000000000001",
      assessedAt,
    });

    expect(getActiveRiskMatrixVersion).toHaveBeenCalled();
    expect(prisma.riskAssessment.create).toHaveBeenCalledWith({
      data: {
        siteId: "site1",
        workstationId: "ws1",
        processId: null,
        matrixVersion: "v1-generic-5x5",
        assessorUserId: "00000000-0000-0000-0000-000000000001",
        assessedAt,
        pilotContext: null,
        notes: null,
      },
    });
  });

  it("seeds one OPEN HazardCategoryCheck row per category in the same transaction", async () => {
    vi.mocked(getActiveRiskMatrixVersion).mockResolvedValue("v1-generic-5x5");
    vi.mocked(prisma.riskAssessment.create).mockResolvedValue({
      id: "ra1",
    } as never);
    vi.mocked(prisma.hazardCategoryCheck.createMany).mockResolvedValue(
      {} as never,
    );

    await createRiskAssessment({
      siteId: "site1",
      workstationId: "ws1",
      assessorUserId: "00000000-0000-0000-0000-000000000001",
      assessedAt: new Date("2026-07-30T00:00:00Z"),
    });

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.hazardCategoryCheck.createMany).toHaveBeenCalledWith({
      data: ALL_HAZARD_CATEGORIES.map((category) => ({
        riskAssessmentId: "ra1",
        category,
        status: "OPEN",
      })),
    });
  });

  it("propagates the fail-closed error from getActiveRiskMatrixVersion when there is no active matrix", async () => {
    vi.mocked(getActiveRiskMatrixVersion).mockRejectedValue(
      new Error("No active RiskMatrixVersion found"),
    );

    await expect(
      createRiskAssessment({
        siteId: "site1",
        processId: "p1",
        assessorUserId: "00000000-0000-0000-0000-000000000001",
        assessedAt: new Date(),
      }),
    ).rejects.toThrow(/No active RiskMatrixVersion/);

    expect(prisma.riskAssessment.create).not.toHaveBeenCalled();
    expect(prisma.hazardCategoryCheck.createMany).not.toHaveBeenCalled();
  });
});
