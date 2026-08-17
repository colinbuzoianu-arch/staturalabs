import "server-only";

import {
  BodyRegion,
  type CameraAngle,
  type PostureSampleSource,
  type RiskBand,
  type ValidationStatus,
} from "@/generated/prisma/enums";
import {
  COMPUTED_BODY_REGIONS,
  type ComputedBodyRegion,
  computeBodyAngles,
  type PoseLandmarks,
} from "@/lib/pose/angles";
import { prisma } from "@/lib/prisma";
import { lookupScoringRule } from "@/lib/scoring/lookup";
import type { ManualAngles } from "./manual-angles";
import type { RegionResult } from "./types";

// Exported so createPostureSample's manual-entry write path (which needs
// the exact same "which BodyRegion values are computed" check while
// building rows to persist) doesn't re-derive its own copy of this test.
export function isComputedRegion(
  region: BodyRegion,
): region is ComputedBodyRegion {
  return (COMPUTED_BODY_REGIONS as readonly BodyRegion[]).includes(region);
}

export type BuildRegionResultsOutput = {
  regions: Record<BodyRegion, RegionResult>;
  validationStatus: ValidationStatus;
};

type BuildRegionResultsParams =
  | {
      source: "CAMERA_MEDIAPIPE";
      keypoints: PoseLandmarks;
      /** The sample's validated landmarks, if it has any — independent of whether `validationStatus` is currently VALIDATED (see the module comment on prospective scoring during the validation action itself). */
      validatedKeypoints?: PoseLandmarks | null;
      validationStatus: ValidationStatus;
      cameraAngle: CameraAngle;
      methodologyVersion: string;
    }
  | {
      source: "MANUAL_ENTRY";
      postureSampleId: string;
      manualAngles: ManualAngles;
      methodologyVersion: string;
    }
  | {
      // Reserved, no implementation — same discipline as
      // createPostureSample() throwing on this value (see that file). No
      // PostureSample row can actually have this source today, but every
      // caller passes `sample.source` straight through (typed as the full
      // 3-value enum), so this branch has to exist for the function to be
      // callable at all — and it fails loudly rather than silently
      // mis-rendering a sample type nothing can produce yet.
      source: "IMPORTED_MODEL";
    };

// Builds one RegionResult per BodyRegion — the single source of truth for
// "what does this capture mean," shared by the live capture endpoint
// (createPostureSample, src/lib/capture/create-posture-sample.ts, for the
// CAMERA_MEDIAPIPE case), the validation action
// ((app)/tasks/[taskId]/actions.ts), and every read-only view.
//
// CAMERA_MEDIAPIPE recomputes fresh from keypoints every time it's called
// (never a stored snapshot) — using whatever ScoringRule rows and
// computeBodyAngles logic exist *right now*, which can legitimately
// differ from what was returned/persisted at capture time if either has
// changed since.
//
// MANUAL_ENTRY does the opposite, deliberately: there are no keypoints to
// recompute from, so this reads the BodyRegionScore rows already
// persisted for this sample (createPostureSample resolves the
// ScoringRule match once, at write time) rather than inventing a
// keypoints-shaped fallback. A region with no matching row is reported
// "no-matching-rule" using the raw entered angle from `manualAngles` —
// not silently omitted, and not recomputed either.
export async function buildRegionResults(
  params: BuildRegionResultsParams,
): Promise<BuildRegionResultsOutput> {
  if (params.source === "IMPORTED_MODEL") {
    throw new Error(
      "PostureSampleSource.IMPORTED_MODEL is not yet implemented",
    );
  }

  if (params.source === "MANUAL_ENTRY") {
    return buildManualRegionResults(params);
  }

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

async function buildManualRegionResults(params: {
  postureSampleId: string;
  manualAngles: ManualAngles;
  methodologyVersion: string;
}): Promise<BuildRegionResultsOutput> {
  const scores = await prisma.bodyRegionScore.findMany({
    where: { postureSampleId: params.postureSampleId },
  });
  const scoreByRegion = new Map(scores.map((s) => [s.bodyRegion, s]));

  const regionResults = {} as Record<BodyRegion, RegionResult>;
  for (const region of Object.values(BodyRegion)) {
    if (!isComputedRegion(region)) {
      regionResults[region] = { status: "not-yet-supported" };
      continue;
    }

    const degrees = params.manualAngles[region];
    const scoreRow = scoreByRegion.get(region);
    regionResults[region] = scoreRow
      ? {
          status: "scored",
          degrees,
          // Always non-null on a manual-entry row: createPostureSample
          // only ever inserts a BodyRegionScore row for a region that
          // matched a ScoringRule, and always persists that same match's
          // riskBand alongside the score (see that function and the
          // schema comment on BodyRegionScore.riskBand for why it can't
          // be safely re-derived from `score` alone).
          riskBand: scoreRow.riskBand as RiskBand,
          riskScore: scoreRow.score,
          methodologyVersion:
            scoreRow.scoringRuleVersion ?? params.methodologyVersion,
        }
      : { status: "no-matching-rule", degrees };
  }

  // A MANUAL_ENTRY sample has no keypoints to review/adjust, so it stays
  // PENDING_REVIEW permanently — see PostureSample's schema comment and
  // the source guard in validatePostureSample/reopenPostureSampleForEdit.
  return { regions: regionResults, validationStatus: "PENDING_REVIEW" };
}

// Convenience wrapper over buildRegionResults for the read views (the
// task page, the admin task results page, the site map, the workstation
// risk view, the task report) — every one of them fetches a raw
// PostureSample row and just wants its regions, and every one of them
// needs the exact same branch on `sample.source` to get there. Centralizing
// that branch here means those 5 call sites each changed by one line
// (swap their old buildRegionResults(...) call for this) rather than each
// carrying its own copy of the same if/else, which is exactly the kind of
// thing that quietly drifts.
export async function buildRegionResultsForSample(
  sample: {
    id: string;
    source: PostureSampleSource;
    keypoints: unknown;
    validatedKeypoints: unknown;
    validationStatus: ValidationStatus;
    cameraAngle: CameraAngle;
    manualAngles: unknown;
  },
  methodologyVersion: string,
): Promise<BuildRegionResultsOutput> {
  if (sample.source === "IMPORTED_MODEL") {
    return buildRegionResults({ source: "IMPORTED_MODEL" });
  }

  if (sample.source === "MANUAL_ENTRY") {
    return buildRegionResults({
      source: "MANUAL_ENTRY",
      postureSampleId: sample.id,
      manualAngles: sample.manualAngles as ManualAngles,
      methodologyVersion,
    });
  }

  return buildRegionResults({
    source: "CAMERA_MEDIAPIPE",
    keypoints: sample.keypoints as PoseLandmarks,
    validatedKeypoints: sample.validatedKeypoints as PoseLandmarks | null,
    validationStatus: sample.validationStatus,
    cameraAngle: sample.cameraAngle,
    methodologyVersion,
  });
}
