// Shared structural validation for the optional `holdDurationSeconds`
// field both posture-sample creation routes accept
// (SLD_IMPLEMENTATION_PLAN_austria-first.md §6) — kept in one place so the
// two routes can't drift on what counts as valid. Returns `null` for a
// genuinely absent value (not every capture records a hold duration —
// that's a legitimate, common case, not an error), a number for a valid
// one, or an error string.
export function validateHoldDurationSeconds(
  value: unknown,
): number | null | string {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return "holdDurationSeconds must be a non-negative finite number of seconds, if provided";
  }
  return value;
}
