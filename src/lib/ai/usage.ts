import "server-only";

import { recordAuditEvent } from "@/lib/audit/audit-event";
import { prisma } from "@/lib/prisma";

// P15 S8: AI usage metering + monthly cap. recordAiUsage is called by every AI
// feature after a model call; the cap (optional, per tenant) pauses AI when
// reached — manual entry always keeps working. Person-free.

function currentPeriod(now = new Date()): { year: number; month: number } {
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

export async function recordAiUsage(input: {
  companyId: string;
  feature: string;
  inputTokens: number;
  outputTokens: number;
}): Promise<void> {
  const { year, month } = currentPeriod();
  await prisma.aiUsageCounter.upsert({
    where: {
      companyId_periodYear_periodMonth_feature: {
        companyId: input.companyId,
        periodYear: year,
        periodMonth: month,
        feature: input.feature,
      },
    },
    create: {
      companyId: input.companyId,
      periodYear: year,
      periodMonth: month,
      feature: input.feature,
      calls: 1,
      inputTokens: BigInt(Math.max(0, Math.trunc(input.inputTokens))),
      outputTokens: BigInt(Math.max(0, Math.trunc(input.outputTokens))),
    },
    update: {
      calls: { increment: 1 },
      inputTokens: {
        increment: BigInt(Math.max(0, Math.trunc(input.inputTokens))),
      },
      outputTokens: {
        increment: BigInt(Math.max(0, Math.trunc(input.outputTokens))),
      },
    },
  });
}

export type AiUsageTotals = {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  byFeature: {
    feature: string;
    calls: number;
    inputTokens: number;
    outputTokens: number;
  }[];
};

export async function getCompanyAiUsage(
  companyId: string,
  period = currentPeriod(),
): Promise<AiUsageTotals> {
  const rows = await prisma.aiUsageCounter.findMany({
    where: { companyId, periodYear: period.year, periodMonth: period.month },
    orderBy: { feature: "asc" },
  });
  const byFeature = rows.map((r) => ({
    feature: r.feature,
    calls: r.calls,
    inputTokens: Number(r.inputTokens),
    outputTokens: Number(r.outputTokens),
  }));
  return {
    calls: byFeature.reduce((s, r) => s + r.calls, 0),
    inputTokens: byFeature.reduce((s, r) => s + r.inputTokens, 0),
    outputTokens: byFeature.reduce((s, r) => s + r.outputTokens, 0),
    byFeature,
  };
}

export type AiUsageCapValues = {
  monthlyCallCap: number | null;
  monthlyTokenCap: number | null;
};

export async function getAiCap(
  companyId: string,
): Promise<AiUsageCapValues | null> {
  const row = await prisma.aiUsageCap.findUnique({
    where: { companyId },
    select: { monthlyCallCap: true, monthlyTokenCap: true },
  });
  if (!row) return null;
  return {
    monthlyCallCap: row.monthlyCallCap,
    monthlyTokenCap:
      row.monthlyTokenCap != null ? Number(row.monthlyTokenCap) : null,
  };
}

export async function setAiCap(input: {
  companyId: string;
  monthlyCallCap: number | null;
  monthlyTokenCap: number | null;
  actorUserId: string;
}): Promise<void> {
  await prisma.aiUsageCap.upsert({
    where: { companyId: input.companyId },
    create: {
      companyId: input.companyId,
      monthlyCallCap: input.monthlyCallCap,
      monthlyTokenCap:
        input.monthlyTokenCap != null ? BigInt(input.monthlyTokenCap) : null,
      updatedByUserId: input.actorUserId,
    },
    update: {
      monthlyCallCap: input.monthlyCallCap,
      monthlyTokenCap:
        input.monthlyTokenCap != null ? BigInt(input.monthlyTokenCap) : null,
      updatedByUserId: input.actorUserId,
    },
  });
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "ai_usage_cap.set",
    entityType: "AiUsageCap",
    entityId: input.companyId,
    companyId: input.companyId,
    diff: {
      monthlyCallCap: input.monthlyCallCap,
      monthlyTokenCap: input.monthlyTokenCap,
    },
  });
}

// True when the company is under its cap (or has none). Over either limit pauses
// AI — the caller then behaves as "AI unavailable" and manual entry still works.
export async function isWithinAiCap(companyId: string): Promise<boolean> {
  const cap = await getAiCap(companyId);
  if (!cap || (cap.monthlyCallCap == null && cap.monthlyTokenCap == null))
    return true;
  const usage = await getCompanyAiUsage(companyId);
  if (cap.monthlyCallCap != null && usage.calls >= cap.monthlyCallCap)
    return false;
  const totalTokens = usage.inputTokens + usage.outputTokens;
  if (cap.monthlyTokenCap != null && totalTokens >= cap.monthlyTokenCap)
    return false;
  return true;
}
