import type { HierarchyOfControl } from "@/generated/prisma/enums";

// P6 §6 typical measures (SLD_P6_TYPICAL_MEASURES_APPROVED.md). Pure helpers —
// no DB, no `server-only`, directly unit-tested. The catalogue content is
// founder-approved; this file only orders it and decides the STOP hint.

// Prevention-hierarchy rank: lower = higher priority (STOP/TOP principle,
// §7 ASchG). Drives both the picker ordering and the STOP hint.
export const HIERARCHY_RANK: Record<HierarchyOfControl, number> = {
  ELIMINATION: 0,
  SUBSTITUTION: 1,
  ENGINEERING_CONTROL: 2,
  ADMINISTRATIVE_CONTROL: 3,
  PPE: 4,
};

// The tiers that count as "higher than organisational/PPE" — a measure at one
// of these satisfies the hierarchy for the STOP hint below.
export function isHigherTier(tier: HierarchyOfControl): boolean {
  return HIERARCHY_RANK[tier] <= HIERARCHY_RANK.ENGINEERING_CONTROL;
}

type Orderable = {
  hierarchyOfControl: HierarchyOfControl;
  order: number;
};

// Order measures by prevention tier (ELIMINATION → PPE), then by their
// within-category `order`. Stable, non-mutating.
export function orderTypicalMeasures<T extends Orderable>(
  measures: readonly T[],
): T[] {
  return [...measures].sort((a, b) => {
    const byTier =
      HIERARCHY_RANK[a.hierarchyOfControl] -
      HIERARCHY_RANK[b.hierarchyOfControl];
    return byTier !== 0 ? byTier : a.order - b.order;
  });
}

// §1 Q3 STOP hint: when the assessor picks a PPE or ADMINISTRATIVE_CONTROL
// measure while the finding has NO open/implemented action at a higher tier,
// show a non-blocking reminder that technical/organisational measures take
// precedence over PPE. Never blocks saving. `hasHigherTierAction` is computed
// by the caller from the finding's existing actions.
export function shouldShowStopHint(
  selectedTier: HierarchyOfControl,
  hasHigherTierAction: boolean,
): boolean {
  const isLowTier =
    selectedTier === "PPE" || selectedTier === "ADMINISTRATIVE_CONTROL";
  return isLowTier && !hasHigherTierAction;
}
