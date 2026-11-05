// P12 / ERGO §3.4: the one helper every person-derived statistic passes through.
// A statistic computed over fewer than `groupSize` persons must never be shown
// — it could re-identify or single out an individual. Returns the value or a
// suppression sentinel the UI renders as "n < 5" rather than a number. Pure,
// unit-tested. Default group size 5 (§3.4).

export const DEFAULT_MIN_GROUP_SIZE = 5;

export type GroupedStat =
  | { suppressed: false; value: number; groupCount: number }
  | { suppressed: true; groupCount: number };

// `value` is the statistic; `groupCount` is how many PERSONS it was computed
// over. Suppressed when groupCount < groupSize. A groupCount of 0 is suppressed
// too (nothing to show, and never a misleading "0 over an empty group").
export function withMinimumGroupSize(
  value: number,
  groupCount: number,
  groupSize: number = DEFAULT_MIN_GROUP_SIZE,
): GroupedStat {
  if (groupCount < groupSize) {
    return { suppressed: true, groupCount };
  }
  return { suppressed: false, value, groupCount };
}
