// Two-tier exposure threshold status (SLD_IMPLEMENTATION_PLAN_austria-
// first.md §4.4) — replaces the three duplicated inline
// `m.limitValue !== null && m.value > m.limitValue` checks that used to
// live in the risk-assessment detail page, the workstation risk view, and
// the risk-assessment PDF report, all doing the same binary over/under
// check with no knowledge of the (newer) action-value tier.
//
// "over-action-value" and "over-limit-value" are deliberately distinct:
// crossing the Auslösewert obliges the employer to plan measures,
// crossing the Expositionsgrenzwert must never happen at all — the two
// carry different legal weight and should never be flattened into one
// "over limit" flag again.
export type ExposureThresholdStatus =
  | "within-limits"
  | "over-action-value"
  | "over-limit-value";

export function exposureThresholdStatus(measurement: {
  value: number;
  actionValue: number | null;
  limitValue: number | null;
}): ExposureThresholdStatus {
  if (
    measurement.limitValue !== null &&
    measurement.value > measurement.limitValue
  ) {
    return "over-limit-value";
  }
  if (
    measurement.actionValue !== null &&
    measurement.value > measurement.actionValue
  ) {
    return "over-action-value";
  }
  return "within-limits";
}
