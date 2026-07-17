import "server-only";

import { BodyRegion, type CameraAngle } from "@/generated/prisma/enums";
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

// Builds one RegionResult per BodyRegion from a set of landmarks — the
// single source of truth for "what does this capture mean," shared by the
// live capture endpoint (POST /api/posture-samples) and the admin task
// results view (which recomputes from persisted `keypoints` rather than
// storing a second, potentially-stale copy of this same judgment).
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
  landmarks: PoseLandmarks;
  cameraAngle: CameraAngle;
  methodologyVersion: string;
}): Promise<Record<BodyRegion, RegionResult>> {
  const angles = computeBodyAngles(params.landmarks, params.cameraAngle);
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

  return regionResults;
}
