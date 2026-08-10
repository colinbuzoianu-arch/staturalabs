import type { BodyRegion, RiskBand } from "@/generated/prisma/enums";
import type { RegionResult } from "@/lib/capture/types";
import { type AngleRangeRule, matchScoringRule } from "@/lib/scoring/match";
import type { PoseLandmarks } from "./angles";
import { computeAllAngles, computeAngleFromDrag } from "./drag-to-angle";
import {
  type AngleAdjustment,
  applyAngleAdjustments,
} from "./forward-kinematics";
import {
  ANATOMICAL_LIMITS,
  completeMissingLandmarks,
  type SkeletonLandmark,
} from "./skeleton";

// Pure state manager for an interactive posture-editing session — no
// React, no DOM. A caller (a hook, a reducer, whatever UI layer wires this
// up) owns a single PostureEditorState value and replaces it wholesale on
// every user action via the functions below; nothing here mutates its
// input, ever. Same compliance posture as every other pose/* module: this
// is a live, ephemeral editing session, never itself responsible for
// persisting anything.

// Mirrors the GET /api/scoring-rules response shape and
// what-if-simulator.tsx's own (private) ScoringRuleRow — field names match
// ScoringRule's own columns so a fetched row satisfies this with no
// mapping step. Named distinctly from the generated ScoringRuleModel
// (Prisma's full row shape, server-only-adjacent) since this module must
// stay client-importable.
export type ScoringRuleRow = AngleRangeRule & {
  bodyRegion: BodyRegion;
  riskBand: RiskBand;
  riskScore: number;
};

export interface PostureEditorState {
  /** Immutable MediaPipe output, gap-filled once at creation — never reassigned or mutated after createPostureEditor. */
  originalKeypoints: SkeletonLandmark[];
  /** Working copy reflecting every adjustment applied so far. */
  currentKeypoints: SkeletonLandmark[];
  /** Angles from the ORIGINAL capture's own regionResults (camera-angle-gated, exactly what was scored/persisted) — a region absent here failed that gate or had insufficient visibility. */
  originalAngles: Map<BodyRegion, number>;
  /** Angles recomputed live from currentKeypoints via computeAllAngles (camera-angle gate NOT applied — see that function's own comment) — always at least as complete as originalAngles, since it also covers regions the original capture's gate rejected. */
  currentAngles: Map<BodyRegion, number>;
  /** Bands from the original capture's own regionResults — a region absent here was never scored (no angle, or an angle with no matching ScoringRule). */
  originalBands: Map<BodyRegion, RiskBand>;
  /** Bands matched live from currentAngles against `rules` — recomputed after every adjustment. */
  currentBands: Map<BodyRegion, RiskBand>;
  /** Which regions the user has changed from their original angle, this session. */
  adjustedRegions: Set<BodyRegion>;
  /** The active methodology's rule set, fixed for the life of the session. */
  rules: ScoringRuleRow[];
}

function bandsFromAngles(
  angles: ReadonlyMap<BodyRegion, number>,
  rules: readonly ScoringRuleRow[],
): Map<BodyRegion, RiskBand> {
  const bands = new Map<BodyRegion, RiskBand>();
  for (const [region, degrees] of angles) {
    const regionRules = rules.filter((rule) => rule.bodyRegion === region);
    const matched = matchScoringRule(regionRules, degrees);
    if (matched) bands.set(region, matched.riskBand);
  }
  return bands;
}

// Initializes an editing session from a PostureSample's own data.
// `keypoints` is the raw capture (completed once, here, into
// originalKeypoints — every downstream function works from that completed
// set, never re-completing it). `regionResults` is the ALREADY-COMPUTED,
// camera-angle-gated result the capture actually produced (from
// buildRegionResults) — the audit-trail-faithful source for
// originalAngles/originalBands, deliberately NOT recomputed via
// computeAllAngles, so "original" always means exactly what was scored at
// capture time, gate included. currentAngles/currentBands, by contrast,
// start from the SAME keypoints but go through the ungated
// computeAllAngles/matchScoringRule path from the very first render — a
// region the capture's own gate rejected is still immediately editable,
// per computeAllAngles' own "manual review, not automated scoring"
// rationale, not just after the first drag.
export function createPostureEditor(
  keypoints: PoseLandmarks,
  regionResults: Record<BodyRegion, RegionResult>,
  rules: ScoringRuleRow[],
): PostureEditorState {
  const originalKeypoints = completeMissingLandmarks(keypoints);

  const originalAngles = new Map<BodyRegion, number>();
  const originalBands = new Map<BodyRegion, RiskBand>();
  for (const [region, result] of Object.entries(regionResults) as [
    BodyRegion,
    RegionResult,
  ][]) {
    if (result.status === "scored") {
      originalAngles.set(region, result.degrees);
      originalBands.set(region, result.riskBand);
    } else if (result.status === "no-matching-rule") {
      // A real angle was computed, it just matched no seeded ScoringRule
      // row — still worth showing as the starting angle, distinct from a
      // region that couldn't be measured at all.
      originalAngles.set(region, result.degrees);
    }
  }

  const currentAngles = computeAllAngles(originalKeypoints);
  const currentBands = bandsFromAngles(currentAngles, rules);

  return {
    originalKeypoints,
    currentKeypoints: originalKeypoints,
    originalAngles,
    currentAngles,
    originalBands,
    currentBands,
    adjustedRegions: new Set(),
    rules,
  };
}

// Shared core for both input methods (drag and direct angle entry): applies
// one already-resolved (bodyRegion, targetDegrees) pair as a single FK
// adjustment onto currentKeypoints (applyAngleAdjustments — this is what
// moves every landmark distal to the region's own pivot, e.g. the wrist
// when ELBOW_LEFT changes; the pivot's own stored position is untouched,
// matching forward-kinematics.ts's existing rotate-the-child-around-a-
// fixed-vertex model), then recomputes every region's angle/band from the
// result.
//
// currentDegrees is deliberately read from the skeleton's PRESENT pose
// (state.currentAngles), not the original capture — applyAngleAdjustments
// needs the delta relative to where currentKeypoints actually is right
// now, not relative to session start. Falls back to targetDegrees itself
// (a true zero-delta) only in the defensive case where this region somehow
// has no current entry yet — shouldn't happen in practice since
// createPostureEditor always seeds every computable region.
//
// A call that resolves to exactly the region's current angle (the user
// picked up a joint and put it back exactly where it was, or typed the
// same number already showing) is a genuine no-op: returns `state` itself,
// unchanged, rather than a new object that would spuriously add the region
// to adjustedRegions for a posture that never actually changed.
function applyResolvedAngle(
  state: PostureEditorState,
  bodyRegion: BodyRegion,
  targetDegrees: number,
): PostureEditorState {
  const currentDegreesForRegion =
    state.currentAngles.get(bodyRegion) ?? targetDegrees;
  if (targetDegrees === currentDegreesForRegion) return state;

  const adjustment: AngleAdjustment = {
    bodyRegion,
    currentDegrees: currentDegreesForRegion,
    targetDegrees,
  };
  const nextKeypoints = applyAngleAdjustments(state.currentKeypoints, [
    adjustment,
  ]);
  const nextAngles = computeAllAngles(nextKeypoints);
  const nextBands = bandsFromAngles(nextAngles, state.rules);

  const nextAdjustedRegions = new Set(state.adjustedRegions);
  nextAdjustedRegions.add(bodyRegion);

  return {
    ...state,
    currentKeypoints: nextKeypoints,
    currentAngles: nextAngles,
    currentBands: nextBands,
    adjustedRegions: nextAdjustedRegions,
  };
}

// Input method 1: dragging a joint. Given a new position for one dragged
// landmark, derives the angle it implies (computeAngleFromDrag, already
// clamped to ANATOMICAL_LIMITS) and applies it via applyResolvedAngle.
export function applyJointDrag(
  state: PostureEditorState,
  landmarkIndex: number,
  newPosition: { x: number; y: number; z?: number },
): PostureEditorState {
  const { bodyRegion, angleDegrees } = computeAngleFromDrag(
    state.currentKeypoints,
    landmarkIndex,
    newPosition,
  );
  return applyResolvedAngle(state, bodyRegion, angleDegrees);
}

// Input method 2: typing an exact angle directly (e.g. from a goniometer
// reading) on a region's own row, rather than dragging its joint. Shares
// the identical applyResolvedAngle core with applyJointDrag — the two
// input methods can never drift out of sync with each other, since neither
// has any FK-cascade or bookkeeping logic of its own. Clamped to
// ANATOMICAL_LIMITS the same way a drag is, for the same reason (a soft
// editing bound, not a scoring threshold).
export function applyAngleInput(
  state: PostureEditorState,
  bodyRegion: BodyRegion,
  targetDegrees: number,
): PostureEditorState {
  const limits = ANATOMICAL_LIMITS[bodyRegion];
  const clampedDegrees = limits
    ? Math.min(limits.max, Math.max(limits.min, targetDegrees))
    : targetDegrees;
  return applyResolvedAngle(state, bodyRegion, clampedDegrees);
}

// Rebuilds currentKeypoints/currentAngles/currentBands from
// originalKeypoints by replaying only the adjustments in `keepRegions`
// (each targeting whatever angle that region is CURRENTLY showing, i.e.
// the user's last-set value for any region they haven't reset) in one
// batched applyAngleAdjustments call. Rebuilding from the clean original
// base — rather than trying to algebraically undo a single rotation on top
// of a possibly-compound current pose — sidesteps any question of whether
// sequential rotations around different, dependent pivots would compose
// the way a naive "just rotate this one back" step assumes; instead it
// asks applyAngleAdjustments to do exactly what it already does for a
// batch of adjustments (sort by REGION_PRIORITY, cascade from a shared
// base), the same as if the user had made only the surviving adjustments
// to begin with.
function rebuildFromKeptRegions(
  state: PostureEditorState,
  keepRegions: ReadonlySet<BodyRegion>,
): PostureEditorState {
  const originalRegionAngles = computeAllAngles(state.originalKeypoints);

  const adjustments: AngleAdjustment[] = [];
  for (const region of keepRegions) {
    const targetDegrees = state.currentAngles.get(region);
    const baselineDegrees = originalRegionAngles.get(region);
    if (targetDegrees === undefined || baselineDegrees === undefined) continue;
    adjustments.push({
      bodyRegion: region,
      currentDegrees: baselineDegrees,
      targetDegrees,
    });
  }

  const nextKeypoints =
    adjustments.length > 0
      ? applyAngleAdjustments(state.originalKeypoints, adjustments)
      : state.originalKeypoints;
  const nextAngles =
    adjustments.length > 0
      ? computeAllAngles(nextKeypoints)
      : originalRegionAngles;
  const nextBands = bandsFromAngles(nextAngles, state.rules);

  return {
    ...state,
    currentKeypoints: nextKeypoints,
    currentAngles: nextAngles,
    currentBands: nextBands,
    adjustedRegions: new Set(keepRegions),
  };
}

// Resets one region to its original angle, leaving every other region's
// adjustment (if any) exactly as the user left it. A no-op (returns
// `state` itself) if the region was never adjusted.
export function resetRegion(
  state: PostureEditorState,
  bodyRegion: BodyRegion,
): PostureEditorState {
  if (!state.adjustedRegions.has(bodyRegion)) return state;

  const keepRegions = new Set(state.adjustedRegions);
  keepRegions.delete(bodyRegion);
  return rebuildFromKeptRegions(state, keepRegions);
}

// Resets every region to its original angle — currentKeypoints/
// currentAngles/currentBands end up exactly what createPostureEditor would
// have produced, and adjustedRegions is empty. A no-op (returns `state`
// itself) if nothing was adjusted.
export function resetAll(state: PostureEditorState): PostureEditorState {
  if (state.adjustedRegions.size === 0) return state;
  return rebuildFromKeptRegions(state, new Set());
}

export type RegionDelta = {
  originalAngle: number | null;
  currentAngle: number | null;
  originalBand: RiskBand | null;
  currentBand: RiskBand | null;
  isAdjusted: boolean;
};

// Summary for one region, for a UI to render "what changed here" — never
// throws, every field is null when this session has no data for that
// region (e.g. a region with no formula at all, or one insufficient
// visibility has kept out of both the original and current computation).
export function getRegionDelta(
  state: PostureEditorState,
  region: BodyRegion,
): RegionDelta {
  return {
    originalAngle: state.originalAngles.get(region) ?? null,
    currentAngle: state.currentAngles.get(region) ?? null,
    originalBand: state.originalBands.get(region) ?? null,
    currentBand: state.currentBands.get(region) ?? null,
    isAdjusted: state.adjustedRegions.has(region),
  };
}
