import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    riskFinding: { create: vi.fn() },
    psychosocialFindingDetail: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import {
  createPsychosocialFinding,
  validatePsychosocialGroupSize,
} from "./psychosocial-finding";

describe("validatePsychosocialGroupSize (pure)", () => {
  it("rejects a non-positive or non-integer group size regardless of method", () => {
    expect(() => validatePsychosocialGroupSize("GROUP_DISCUSSION", 0)).toThrow(
      /positive whole number/,
    );
    expect(() => validatePsychosocialGroupSize("OBSERVATION", -3)).toThrow(
      /positive whole number/,
    );
    expect(() => validatePsychosocialGroupSize("INTERVIEW", 2.5)).toThrow(
      /positive whole number/,
    );
  });

  it("rejects QUESTIONNAIRE below the 15-person floor", () => {
    expect(() => validatePsychosocialGroupSize("QUESTIONNAIRE", 14)).toThrow(
      /at least 15/,
    );
  });

  it("allows QUESTIONNAIRE at or above the 15-person floor", () => {
    expect(() =>
      validatePsychosocialGroupSize("QUESTIONNAIRE", 15),
    ).not.toThrow();
    expect(() =>
      validatePsychosocialGroupSize("QUESTIONNAIRE", 40),
    ).not.toThrow();
  });

  it("allows GROUP_DISCUSSION/OBSERVATION/INTERVIEW below 15 — the documented small-group fallback", () => {
    expect(() =>
      validatePsychosocialGroupSize("GROUP_DISCUSSION", 4),
    ).not.toThrow();
    expect(() => validatePsychosocialGroupSize("OBSERVATION", 1)).not.toThrow();
    expect(() => validatePsychosocialGroupSize("INTERVIEW", 8)).not.toThrow();
  });
});

describe("createPsychosocialFinding", () => {
  beforeEach(() => {
    vi.mocked(prisma.riskFinding.create).mockReset();
    vi.mocked(prisma.psychosocialFindingDetail.create).mockReset();
    vi.mocked(prisma.$transaction).mockReset();
    vi.mocked(prisma.$transaction).mockImplementation(((cb: never) =>
      (cb as (tx: typeof prisma) => unknown)(prisma)) as never);
  });

  it("rejects an invalid group size before opening a transaction", async () => {
    await expect(
      createPsychosocialFinding({
        riskAssessmentId: "ra1",
        hazardId: "h1",
        probability: 3,
        severity: 3,
        riskScore: 9,
        riskBand: "MODERATE",
        dimension: "WORK_ORGANIZATION",
        method: "QUESTIONNAIRE",
        groupSize: 10,
      }),
    ).rejects.toThrow(/at least 15/);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.riskFinding.create).not.toHaveBeenCalled();
  });

  it("creates the RiskFinding and its PsychosocialFindingDetail in one transaction", async () => {
    vi.mocked(prisma.riskFinding.create).mockResolvedValue({
      id: "rf1",
    } as never);
    vi.mocked(prisma.psychosocialFindingDetail.create).mockResolvedValue(
      {} as never,
    );

    const result = await createPsychosocialFinding({
      riskAssessmentId: "ra1",
      hazardId: "h1",
      probability: 2,
      severity: 3,
      riskScore: 6,
      riskBand: "MODERATE",
      existingControls: "Regular team check-ins",
      notes: "Discussed during shift handover",
      dimension: "SOCIAL_CLIMATE",
      method: "GROUP_DISCUSSION",
      groupSize: 6,
    });

    expect(prisma.riskFinding.create).toHaveBeenCalledWith({
      data: {
        riskAssessmentId: "ra1",
        hazardId: "h1",
        probability: 2,
        severity: 3,
        riskScore: 6,
        riskBand: "MODERATE",
        existingControls: "Regular team check-ins",
        notes: "Discussed during shift handover",
      },
    });
    expect(prisma.psychosocialFindingDetail.create).toHaveBeenCalledWith({
      data: {
        riskFindingId: "rf1",
        dimension: "SOCIAL_CLIMATE",
        method: "GROUP_DISCUSSION",
        groupSize: 6,
        externalProcedureName: null,
      },
    });
    expect(result).toEqual({ id: "rf1" });
  });

  it("passes externalProcedureName through when a named questionnaire instrument was used", async () => {
    vi.mocked(prisma.riskFinding.create).mockResolvedValue({
      id: "rf2",
    } as never);
    vi.mocked(prisma.psychosocialFindingDetail.create).mockResolvedValue(
      {} as never,
    );

    await createPsychosocialFinding({
      riskAssessmentId: "ra1",
      hazardId: "h1",
      probability: 3,
      severity: 4,
      riskScore: 12,
      riskBand: "ELEVATED",
      dimension: "TASK_AND_ACTIVITY",
      method: "QUESTIONNAIRE",
      groupSize: 22,
      externalProcedureName: "COPSOQ",
    });

    expect(prisma.psychosocialFindingDetail.create).toHaveBeenCalledWith({
      data: {
        riskFindingId: "rf2",
        dimension: "TASK_AND_ACTIVITY",
        method: "QUESTIONNAIRE",
        groupSize: 22,
        externalProcedureName: "COPSOQ",
      },
    });
  });
});
