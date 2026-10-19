import {
  BodyRegion,
  BodyZone,
  ExposureShare,
  ZoneLoadLevel,
} from "@/generated/prisma/enums";
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
// H2 (SLD_IMPLEMENTATION_PLAN_hazards-and-environment.md §4) adds "zone" —
// a coarse per-body-zone rating (gering/mittel/hoch × share), now the
// DEFAULT input. "category" (B11) and "degrees" (expert) stay reachable
// behind the "Detailbeurteilung" toggle. A zone sample's manualAngles JSON
// carries `{ entryMode: "zone", zones: {...} }` instead of per-region
// degrees — same single `PostureSample.manualAngles Json?` column, a
// different JSON shape discriminated by entryMode.
export type EntryMode = "category" | "degrees" | "zone";

export function resolveEntryMode(
  manualAngles: { entryMode?: unknown } | null | undefined,
): EntryMode {
  const mode = manualAngles?.entryMode;
  if (mode === "category" || mode === "zone") return mode;
  return "degrees";
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
export type RegionManualAngles = Partial<
  Record<ManualEntryBodyRegion, number>
> & {
  entryMode: "category" | "degrees";
};

// One zone's rating: the three-way load level and how much of the task it
// applies for. Share replaces hold time in zone mode (§4.2).
export type ZoneRating = { level: ZoneLoadLevel; share: ExposureShare };

export type ZoneManualAngles = {
  entryMode: "zone";
  zones: Partial<Record<BodyZone, ZoneRating>>;
};

export type ManualAngles = RegionManualAngles | ZoneManualAngles;

const ALL_BODY_ZONES = Object.values(BodyZone);
const ALL_ZONE_LEVELS = Object.values(ZoneLoadLevel);
const ALL_EXPOSURE_SHARES = Object.values(ExposureShare);

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

  // Zone mode (H2) has a different JSON shape — a `zones` map, no per-region
  // degrees — so it validates on its own path before the region logic.
  if (input.entryMode === "zone") {
    return validateZoneManualAngles(input);
  }

  let entryMode: "category" | "degrees" = "degrees";
  if ("entryMode" in input && input.entryMode !== undefined) {
    if (input.entryMode !== "category" && input.entryMode !== "degrees") {
      return 'entryMode must be "category", "degrees", or "zone"';
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

// Zone-mode validator (H2). At least one zone must be rated; each rating
// needs a valid level and share. Same "never throws, returns a message"
// contract as the region path.
function validateZoneManualAngles(
  input: Record<string, unknown>,
): ZoneManualAngles | string {
  const rawZones = input.zones;
  if (
    typeof rawZones !== "object" ||
    rawZones === null ||
    Array.isArray(rawZones)
  ) {
    return "zones must be an object";
  }
  const zonesInput = rawZones as Record<string, unknown>;
  const zones: Partial<Record<BodyZone, ZoneRating>> = {};

  for (const zone of ALL_BODY_ZONES) {
    const rating = zonesInput[zone];
    if (rating === undefined) continue;
    if (typeof rating !== "object" || rating === null) {
      return `zones.${zone} must be an object with level and share`;
    }
    const { level, share } = rating as Record<string, unknown>;
    if (!ALL_ZONE_LEVELS.includes(level as ZoneLoadLevel)) {
      return `zones.${zone}.level must be one of ${ALL_ZONE_LEVELS.join(", ")}`;
    }
    if (!ALL_EXPOSURE_SHARES.includes(share as ExposureShare)) {
      return `zones.${zone}.share must be one of ${ALL_EXPOSURE_SHARES.join(", ")}`;
    }
    zones[zone] = {
      level: level as ZoneLoadLevel,
      share: share as ExposureShare,
    };
  }

  if (Object.keys(zones).length === 0) {
    return "at least one zone must be rated";
  }

  return { entryMode: "zone", zones };
}
