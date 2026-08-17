import type { RiskBand } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export type KgRangeRule = {
  riskBand: RiskBand;
  riskScore: number;
  minKg: number | null;
  maxKg: number | null;
};

// Pure range-matching core — exported for direct unit testing, no DB
// involved. Same [minKg, maxKg) inclusive-min/exclusive-max convention as
// matchScoringRule's angle ranges, and the same "real per-row range
// check, not a threshold cascade" discipline (SLD_IMPLEMENTATION_PLAN_
// austria-first.md §7 B8), even though today's seeded rows happen to be
// monotonic — a future revision could add a non-monotonic band the same
// way ELBOW/NECK already are for posture.
export function matchManualHandlingRule<T extends KgRangeRule>(
  rules: readonly T[],
  loadWeightKg: number,
): T | null {
  const matches = rules.filter((rule) => {
    const min = rule.minKg ?? Number.NEGATIVE_INFINITY;
    const max = rule.maxKg ?? Number.POSITIVE_INFINITY;
    return loadWeightKg >= min && loadWeightKg < max;
  });

  if (matches.length > 1) {
    throw new Error(
      `Ambiguous ManualHandlingRule match: ${loadWeightKg} kg matched ${matches.length} rules (expected at most 1)`,
    );
  }

  return matches[0] ?? null;
}

// Impure fetch — every ManualHandlingRule row for a methodology version
// (the table is small, same reasoning as lookupHoldTimeRules not
// filtering further up front).
export async function lookupManualHandlingRules(
  methodologyVersion: string,
): Promise<KgRangeRule[]> {
  return prisma.manualHandlingRule.findMany({
    where: { methodologyVersion },
    select: { riskBand: true, riskScore: true, minKg: true, maxKg: true },
  });
}

export type ManualHandlingResult = {
  loadWeightKg: number;
  riskBand: RiskBand;
  riskScore: number;
} | null;

// Assembles the manual-handling sub-score for a task from its most
// recently recorded LOAD_WEIGHT_KG ManualInput — parallel and independent
// of posture/hold-time (§6/§11: "parallel sub-scores, not a blended
// composite"), never rolled into a task's ergonomic band. null when the
// task has no LOAD_WEIGHT_KG entry yet, or when its value falls outside
// every seeded range (a data problem to surface as an honest gap, not a
// default band).
export async function computeManualHandlingResult(params: {
  taskId: string;
  methodologyVersion: string;
}): Promise<ManualHandlingResult> {
  const latest = await prisma.manualInput.findFirst({
    where: { taskId: params.taskId, inputType: "LOAD_WEIGHT_KG" },
    orderBy: { createdAt: "desc" },
  });
  if (!latest || latest.value === null) return null;

  const rules = await lookupManualHandlingRules(params.methodologyVersion);
  const rule = matchManualHandlingRule(rules, latest.value);
  if (!rule) return null;

  return {
    loadWeightKg: latest.value,
    riskBand: rule.riskBand,
    riskScore: rule.riskScore,
  };
}
