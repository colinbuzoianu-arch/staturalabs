import {
  COMPUTED_BODY_REGIONS,
  type ComputedBodyRegion,
} from "@/lib/pose/angles";

export { COMPUTED_BODY_REGIONS };
export type { ComputedBodyRegion };

// The raw angles an assessor enters for a MANUAL_ENTRY PostureSample —
// one per computed BodyRegion, degrees in flexion-from-neutral convention
// (0° = neutral, increasing = more flexed — the existing convention, see
// CLAUDE.md "Scoring methodology"; do not introduce a second one). All 8
// are required: manual entry is meant to produce a complete assessment in
// one sitting (SLD_IMPLEMENTATION_PLAN_austria-first.md §5), the same way
// a single camera capture attempts every computed region at once.
export type ManualAngles = Record<ComputedBodyRegion, number>;

// Pure validator, unit-tested directly — no DB, no Prisma — mirroring the
// matchScoringRule/lookupScoringRule split (src/lib/scoring/match.ts):
// this is the part that's safe to reuse anywhere (a route handler, a
// Server Action, a future script) without dragging in server-only
// dependencies. Returns the validated ManualAngles object, or a
// human-readable error string naming exactly what's wrong — never throws,
// so callers decide how to surface the failure (a 400, a form error).
export function validateManualAngles(value: unknown): ManualAngles | string {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return "angles must be an object";
  }
  const input = value as Record<string, unknown>;
  const angles = {} as ManualAngles;

  for (const region of COMPUTED_BODY_REGIONS) {
    const degrees = input[region];
    if (typeof degrees !== "number" || !Number.isFinite(degrees)) {
      return `angles.${region} must be a finite number of degrees`;
    }
    angles[region] = degrees;
  }

  return angles;
}
