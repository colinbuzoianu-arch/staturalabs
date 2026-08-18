import { BodyRegion } from "@/generated/prisma/enums";
import {
  COMPUTED_BODY_REGIONS,
  type ComputedBodyRegion,
} from "@/lib/pose/angles";

export { COMPUTED_BODY_REGIONS };
export type { ComputedBodyRegion };

// WRIST_LEFT/WRIST_RIGHT (B8e, SLD_NEXT_STEPS_B8b-B8f.md) is the one
// region set manual entry can score that camera capture never can —
// computeBodyAngles (src/lib/pose/angles.ts) has no wrist formula at all
// (MediaPipe's single wrist landmark can't give true wrist deviation —
// see CLAUDE.md's known limitations, that needs Hand Landmarker), so
// COMPUTED_BODY_REGIONS deliberately stays camera-only and unchanged by
// this. This is the manual-entry-specific superset instead — the regions
// a MANUAL_ENTRY PostureSample requires, wrist included.
export type ManualEntryBodyRegion =
  | ComputedBodyRegion
  | typeof BodyRegion.WRIST_LEFT
  | typeof BodyRegion.WRIST_RIGHT;

export const MANUAL_ENTRY_BODY_REGIONS: readonly ManualEntryBodyRegion[] = [
  ...COMPUTED_BODY_REGIONS,
  BodyRegion.WRIST_LEFT,
  BodyRegion.WRIST_RIGHT,
];

// The raw angles an assessor enters for a MANUAL_ENTRY PostureSample —
// one per ManualEntryBodyRegion, degrees in flexion-from-neutral
// convention (0° = neutral, increasing = more flexed — the existing
// convention, see CLAUDE.md "Scoring methodology"; do not introduce a
// second one — wrist follows the same signed convention NECK already
// establishes: negative reads as extension, positive as flexion). All 10
// are required: manual entry is meant to produce a complete assessment in
// one sitting (SLD_IMPLEMENTATION_PLAN_austria-first.md §5), the same way
// a single camera capture attempts every computed region at once.
export type ManualAngles = Record<ManualEntryBodyRegion, number>;

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

  for (const region of MANUAL_ENTRY_BODY_REGIONS) {
    const degrees = input[region];
    if (typeof degrees !== "number" || !Number.isFinite(degrees)) {
      return `angles.${region} must be a finite number of degrees`;
    }
    angles[region] = degrees;
  }

  return angles;
}
