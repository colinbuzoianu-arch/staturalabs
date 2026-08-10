import "server-only";

import {
  BodyRegion,
  type CameraAngle,
  type ValidationStatus,
} from "@/generated/prisma/enums";
import {
  type ComputedBodyRegion,
  computeBodyAngles,
  type PoseLandmarks,
} from "@/lib/pose/angles";
import { lookupScoringRule } from "@/lib/scoring/lookup";
import type { RegionResult } from "./types";

// The 8 BodyRegion values computeBodyAngles produces a reading for. Every
// other BodyRegion is reported "not-yet-supported" rather than omitted.
const COMPUTED_REGIONS: readonly ComputedBodyRegion[] = [
  BodyRegion.TRUNK,
  BodyRegion.NECK,
  BodyRegion.SHOULDER_LEFT,
  BodyRegion.SHOULDER_RIGHT,
  BodyRegion.ELBOW_LEFT,
  BodyRegion.ELBOW_RIGHT,
  BodyRegion.KNEE_LEFT,
  BodyRegion.KNEE_RIGHT,
];

function isComputedRegion(region: BodyRegion): region is ComputedBodyRegion {
  return (COMPUTED_REGIONS as readonly BodyRegion[]).includes(region);
}

export type BuildRegionResultsOutput = {
  regions: Record<BodyRegion, RegionResult>;
  /** Echoes params.validationStatus, so a UI rendering `regions` always knows in one place whether it's looking at a preliminary (PENDING_REVIEW) or final (VALIDATED) result, without separately tracking which landmarks fed the computation. */
  validationStatus: ValidationStatus;
};

// Builds one RegionResult per BodyRegion — the single source of truth for
// "what does this capture mean," shared by the live capture endpoint
// (POST /api/posture-samples), the validation action
// ((app)/tasks/[taskId]/actions.ts), and every read-only view that
// recomputes from a persisted PostureSample rather than storing a second,
// potentially-stale copy of this same judgment.
//
// Prefers `validatedKeypoints` over `keypoints` whenever the sample is
// actually VALIDATED and has them — a validated sample's human-reviewed
// posture is the current, authoritative one; the original capture stays
// available (via `keypoints`, never overwritten — see PostureSample's own
// schema comment) for audit, not for display once a validated correction
// exists. A PENDING_REVIEW sample (or one with no validatedKeypoints yet)
// always scores from the original `keypoints`, the "preliminary" view.
//
// Because this recomputes rather than reads a frozen snapshot, calling it
// against an old PostureSample uses whatever ScoringRule rows and
// computeBodyAngles logic exist *right now* — if either has changed since
// capture (e.g. NECK's backward-extension rows, added after the fact), the
// result can legitimately differ from what was returned/persisted at
// capture time. Fine for a testing tool; would need reconsidering for an
// audit-trail/compliance view that must reproduce a specific past moment.
//
// Throws only if computeBodyAngles itself throws (e.g. NECK's
// indeterminate-facing-direction case) — callers decide how to surface
// that (a 422 in the API route; an inline error per sample in the admin
// view).
export async function buildRegionResults(params: {
  keypoints: PoseLandmarks;
  /** The sample's validated landmarks, if it has any — independent of whether `validationStatus` is currently VALIDATED (see the module comment on prospective scoring during the validation action itself). */
  validatedKeypoints?: PoseLandmarks | null;
  validationStatus: ValidationStatus;
  cameraAngle: CameraAngle;
  methodologyVersion: string;
}): Promise<BuildRegionResultsOutput> {
  const landmarks =
    params.validationStatus === "VALIDATED" && params.validatedKeypoints
      ? params.validatedKeypoints
      : params.keypoints;

  const angles = computeBodyAngles(landmarks, params.cameraAngle);
  const regionResults = {} as Record<BodyRegion, RegionResult>;

  for (const region of Object.values(BodyRegion)) {
    if (!isComputedRegion(region)) {
      regionResults[region] = { status: "not-yet-supported" };
      continue;
    }

    const reading = angles[region];
    if (!reading.ok) {
      regionResults[region] =
        reading.reason === "WRONG_CAMERA_ANGLE"
          ? {
              status: "wrong-camera-angle",
              requiredCameraAngle: [...reading.requiredCameraAngle],
              actualCameraAngle: reading.actualCameraAngle,
            }
          : {
              status: "insufficient-visibility",
              failedLandmarks: [...reading.failedLandmarks],
            };
      continue;
    }

    const rule = await lookupScoringRule({
      bodyRegion: region,
      angleDegrees: reading.degrees,
      methodologyVersion: params.methodologyVersion,
    });

    regionResults[region] = rule
      ? {
          status: "scored",
          degrees: reading.degrees,
          riskBand: rule.riskBand,
          riskScore: rule.riskScore,
          methodologyVersion: rule.methodologyVersion,
        }
      : // Surfaced, not swallowed: a region that passed the camera-angle
        // gate but matched no ScoringRule row is a real data problem (a
        // gap in the seeded thresholds), reported to the caller rather
        // than silently dropped.
        { status: "no-matching-rule", degrees: reading.degrees };
  }

  return { regions: regionResults, validationStatus: params.validationStatus };
}
