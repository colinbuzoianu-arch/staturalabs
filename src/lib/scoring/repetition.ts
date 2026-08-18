import type { RiskBand } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export type RepsRangeRule = {
  riskBand: RiskBand;
  riskScore: number;
  minReps: number | null;
  maxReps: number | null;
};

// Pure range-matching core — exported for direct unit testing, no DB
// involved. Same [minReps, maxReps) inclusive-min/exclusive-max
// convention as matchManualHandlingRule's kg ranges and matchScoringRule's
// angle ranges, and the same "real per-row range check, not a threshold
// cascade" discipline (SLD_NEXT_STEPS_B8b-B8f.md B8d).
export function matchRepetitionRule<T extends RepsRangeRule>(
  rules: readonly T[],
  repetitionCount: number,
): T | null {
  const matches = rules.filter((rule) => {
    const min = rule.minReps ?? Number.NEGATIVE_INFINITY;
    const max = rule.maxReps ?? Number.POSITIVE_INFINITY;
    return repetitionCount >= min && repetitionCount < max;
  });

  if (matches.length > 1) {
    throw new Error(
      `Ambiguous RepetitionRule match: ${repetitionCount} reps matched ${matches.length} rules (expected at most 1)`,
    );
  }

  return matches[0] ?? null;
}

// Impure fetch — every RepetitionRule row for a methodology version (the
// table is small, same reasoning as lookupManualHandlingRules not
// filtering further up front).
export async function lookupRepetitionRules(
  methodologyVersion: string,
): Promise<RepsRangeRule[]> {
  return prisma.repetitionRule.findMany({
    where: { methodologyVersion },
    select: { riskBand: true, riskScore: true, minReps: true, maxReps: true },
  });
}

export type RepetitionResult = {
  repetitionCount: number;
  riskBand: RiskBand;
  riskScore: number;
} | null;

// Assembles the repetition sub-score for a task from its most recently
// recorded REPETITION_COUNT ManualInput — parallel and independent of
// posture/hold-time/manual-handling (§6/§11: "parallel sub-scores, not a
// blended composite"), never rolled into a task's ergonomic band. null
// when the task has no REPETITION_COUNT entry yet, or when its value
// falls outside every seeded range (a data problem to surface as an
// honest gap, not a default band).
export async function computeRepetitionResult(params: {
  taskId: string;
  methodologyVersion: string;
}): Promise<RepetitionResult> {
  const latest = await prisma.manualInput.findFirst({
    where: { taskId: params.taskId, inputType: "REPETITION_COUNT" },
    orderBy: { createdAt: "desc" },
  });
  if (!latest || latest.value === null) return null;

  const rules = await lookupRepetitionRules(params.methodologyVersion);
  const rule = matchRepetitionRule(rules, latest.value);
  if (!rule) return null;

  return {
    repetitionCount: latest.value,
    riskBand: rule.riskBand,
    riskScore: rule.riskScore,
  };
}
