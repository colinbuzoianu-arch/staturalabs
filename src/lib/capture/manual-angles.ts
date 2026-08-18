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
// a MANUAL_ENTRY PostureSample can record.
export type ManualEntryBodyRegion =
  | ComputedBodyRegion
  | typeof BodyRegion.WRIST_LEFT
  | typeof BodyRegion.WRIST_RIGHT;

export const MANUAL_ENTRY_BODY_REGIONS: readonly ManualEntryBodyRegion[] = [
  ...COMPUTED_BODY_REGIONS,
  BodyRegion.WRIST_LEFT,
  BodyRegion.WRIST_RIGHT,
];

// B11 (SLD_IMPLEMENTATION_PLAN_posture-input.md §3.2): which precision the
// assessor entered this sample at. "category" is the primary path — a
// posture-category pick, persisted as that category's own
// representativeDegrees (see src/lib/scoring/posture-categories.ts) so the
// scoring pipeline itself is completely unaware anything changed.
// "degrees" is the pre-B11 precise-entry path, kept reachable behind the
// capture panel's "Expertenmodus" toggle for an assessor who genuinely
// measured with a goniometer/inclinometer. A historical row written
// before this field existed has no `entryMode` key at all — every reader
// treats that absence as "degrees" (resolveEntryMode below), the shape
// the JSON always had before this milestone, per the plan's explicit
// "existing degree shape remaining valid" instruction.
export type EntryMode = "category" | "degrees";

export function resolveEntryMode(
  manualAngles: { entryMode?: unknown } | null | undefined,
): EntryMode {
  return manualAngles?.entryMode === "category" ? "category" : "degrees";
}

// The raw angles an assessor enters for a MANUAL_ENTRY PostureSample —
// one per ManualEntryBodyRegion, degrees in flexion-from-neutral
// convention (0° = neutral, increasing = more flexed — the existing
// convention, see CLAUDE.md "Scoring methodology"; do not introduce a
// second one — wrist follows the same signed convention NECK already
// establishes: negative reads as extension, positive as flexion).
//
// B11: no longer requires every region — `Partial` reflects that an
// unassessed region is a legitimate, recordable state (the assessor
// couldn't observe it), not something forced to a guess. A region simply
// absent from this object means "not assessed," never "assessed as 0°."
// `entryMode` travels alongside the per-region values as a sibling key in
// the same JSON object — no column change (this is still the existing
// `PostureSample.manualAngles Json?` field), the JSON shape just gained a
// discriminator.
export type ManualAngles = Partial<Record<ManualEntryBodyRegion, number>> & {
  entryMode: EntryMode;
};

// Pure validator, unit-tested directly — no DB, no Prisma — mirroring the
// matchScoringRule/lookupScoringRule split (src/lib/scoring/match.ts):
// this is the part that's safe to reuse anywhere (a route handler, a
// Server Action, a future script) without dragging in server-only
// dependencies. Returns the validated ManualAngles object, or a
// human-readable error string naming exactly what's wrong — never throws,
// so callers decide how to surface the failure (a 400, a form error).
//
// B11: partial entry is valid for both entry modes — at least one region
// must be present, but not every region (§3.3's explicit relaxation of
// B2's original "every computed region required" rule). `entryMode`
// itself is optional on input and defaults to "degrees" when absent, so a
// pre-B11 caller (or historical data reprocessed through this function)
// keeps working unchanged; when present it must be exactly "category" or
// "degrees".
export function validateManualAngles(value: unknown): ManualAngles | string {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return "angles must be an object";
  }
  const input = value as Record<string, unknown>;

  let entryMode: EntryMode = "degrees";
  if ("entryMode" in input && input.entryMode !== undefined) {
    if (input.entryMode !== "category" && input.entryMode !== "degrees") {
      return 'entryMode must be "category" or "degrees"';
    }
    entryMode = input.entryMode;
  }

  const angles: Partial<Record<ManualEntryBodyRegion, number>> = {};
  for (const region of MANUAL_ENTRY_BODY_REGIONS) {
    if (!(region in input) || input[region] === undefined) continue;
    const degrees = input[region];
    if (typeof degrees !== "number" || !Number.isFinite(degrees)) {
      return `angles.${region} must be a finite number of degrees`;
    }
    angles[region] = degrees;
  }

  if (Object.keys(angles).length === 0) {
    return "at least one region must be entered";
  }

  return { ...angles, entryMode };
}
