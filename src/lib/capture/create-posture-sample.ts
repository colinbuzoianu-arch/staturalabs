import "server-only";

import {
  BodyRegion,
  type CameraAngle,
  type RiskBand,
} from "@/generated/prisma/enums";
import type { PoseLandmark } from "@/lib/pose/angles";
import { prisma } from "@/lib/prisma";
import { matchScoringRule } from "@/lib/scoring/match";
import {
  buildRegionResults,
  isManuallyScorableRegion,
} from "./build-region-results";
import { computeHoldTimeResult } from "./hold-time-result";
import {
  MANUAL_ENTRY_BODY_REGIONS,
  validateManualAngles,
} from "./manual-angles";
import type { PostureSampleResponse, RegionResult } from "./types";

// PostureSample.cameraAngle is a NOT NULL column with no "not applicable"
// value (SLD_IMPLEMENTATION_PLAN_austria-first.md §5 scopes B2's schema
// changes to source/keypoints/manualAngles, not cameraAngle). This is
// stored purely to satisfy that constraint on a MANUAL_ENTRY row — it is
// never read for scoring (the manual path never calls computeBodyAngles)
// and every surface that displays a sample hides cameraAngle when
// source is MANUAL_ENTRY rather than show a misleading "camera view."
const MANUAL_ENTRY_CAMERA_ANGLE_PLACEHOLDER: CameraAngle = "SAGITTAL";

export type CreatePostureSampleParams =
  | {
      source: "CAMERA_MEDIAPIPE";
      taskId: string;
      cameraAngle: CameraAngle;
      landmarks: PoseLandmark[];
      methodologyVersion: string;
      /** How long this specific captured posture was held, in seconds — optional, feeds the hold-time sub-score (SLD_IMPLEMENTATION_PLAN_austria-first.md §6). Never confuse with ManualInput.DURATION_SECONDS (task-cycle duration). */
      holdDurationSeconds?: number | null;
    }
  | {
      source: "MANUAL_ENTRY";
      taskId: string;
      /** Unvalidated — this function re-validates via validateManualAngles regardless of what the caller already checked, same defense-in-depth as the landmarks structural checks duplicated between the capture route and the validate/reopen Server Actions. */
      angles: unknown;
      methodologyVersion: string;
      holdDurationSeconds?: number | null;
    }
  | {
      source: "IMPORTED_MODEL";
    };

// The single creation gate for PostureSample — same role
// createAssessmentSession() plays for AssessmentSession. Every code path
// that persists a posture sample (the camera capture route and the new
// manual-entry route) goes through here, so IMPORTED_MODEL can't be
// silently created from some other call site later: this throws on it,
// once, and every caller inherits that gate for free.
export async function createPostureSample(
  params: CreatePostureSampleParams,
): Promise<PostureSampleResponse> {
  if (params.source === "IMPORTED_MODEL") {
    throw new Error(
      "PostureSampleSource.IMPORTED_MODEL is not yet implemented",
    );
  }

  if (params.source === "MANUAL_ENTRY") {
    return createManualPostureSample(params);
  }

  return createCameraPostureSample(params);
}

async function createCameraPostureSample(params: {
  taskId: string;
  cameraAngle: CameraAngle;
  landmarks: PoseLandmark[];
  methodologyVersion: string;
  holdDurationSeconds?: number | null;
}): Promise<PostureSampleResponse> {
  // A brand-new sample has no validatedKeypoints yet and is about to be
  // created PENDING_REVIEW — always scores from the raw `landmarks` just
  // submitted, never a stale validated snapshot (there isn't one).
  const { regions: regionResults } = await buildRegionResults({
    source: "CAMERA_MEDIAPIPE",
    keypoints: params.landmarks,
    validatedKeypoints: null,
    validationStatus: "PENDING_REVIEW",
    cameraAngle: params.cameraAngle,
    methodologyVersion: params.methodologyVersion,
  });

  const scoredRows = Object.entries(regionResults).flatMap(
    ([region, result]) =>
      result.status === "scored"
        ? [
            {
              bodyRegion: region as BodyRegion,
              score: result.riskScore,
              scoringRuleVersion: result.methodologyVersion,
            },
          ]
        : [],
  );

  const sample = await prisma.$transaction(async (tx) => {
    // validationStatus starts PENDING_REVIEW on every new sample — a human
    // hasn't reviewed/validated it yet (ERGO_COMPLIANCE_BY_DESIGN.md §3.4).
    const created = await tx.postureSample.create({
      data: {
        taskId: params.taskId,
        capturedAt: new Date(),
        cameraAngle: params.cameraAngle,
        source: "CAMERA_MEDIAPIPE",
        keypoints: params.landmarks,
        holdDurationSeconds: params.holdDurationSeconds ?? null,
        validationStatus: "PENDING_REVIEW",
      },
    });

    if (scoredRows.length > 0) {
      await tx.bodyRegionScore.createMany({
        data: scoredRows.map((row) => ({
          postureSampleId: created.id,
          bodyRegion: row.bodyRegion,
          score: row.score,
          scoringRuleVersion: row.scoringRuleVersion,
        })),
      });
    }

    return created;
  });

  const holdTime = await computeHoldTimeResult({
    regions: regionResults,
    holdDurationSeconds: params.holdDurationSeconds ?? null,
    methodologyVersion: params.methodologyVersion,
  });

  return {
    postureSampleId: sample.id,
    methodologyVersion: params.methodologyVersion,
    regions: regionResults,
    holdTime,
  };
}

// Deliberately does NOT go through buildRegionResults' MANUAL_ENTRY
// branch: that branch is a READ operation (reconstructs regions from
// BodyRegionScore rows that already exist). This is the WRITE operation —
// deciding what to persist in the first place — so it resolves each
// region's ScoringRule match itself, once, via the same pure
// matchScoringRule() the read side and the client's live-band-preview
// both use, then reuses that in-memory result both to build the rows to
// persist and as this function's own return value (no redundant re-fetch
// immediately after insert).
async function createManualPostureSample(params: {
  taskId: string;
  angles: unknown;
  methodologyVersion: string;
  holdDurationSeconds?: number | null;
}): Promise<PostureSampleResponse> {
  const validated = validateManualAngles(params.angles);
  if (typeof validated === "string") {
    throw new Error(validated);
  }
  const angles = validated;

  const rules = await prisma.scoringRule.findMany({
    where: {
      bodyRegion: { in: [...MANUAL_ENTRY_BODY_REGIONS] },
      methodologyVersion: params.methodologyVersion,
    },
  });
  const rulesByRegion = new Map<BodyRegion, typeof rules>();
  for (const rule of rules) {
    const list = rulesByRegion.get(rule.bodyRegion) ?? [];
    list.push(rule);
    rulesByRegion.set(rule.bodyRegion, list);
  }

  const regionResults = {} as Record<BodyRegion, RegionResult>;
  const scoredRows: Array<{
    bodyRegion: BodyRegion;
    score: number;
    riskBand: RiskBand;
    scoringRuleVersion: string;
  }> = [];

  for (const region of MANUAL_ENTRY_BODY_REGIONS) {
    const degrees = angles[region];
    const match = matchScoringRule(rulesByRegion.get(region) ?? [], degrees);
    if (match) {
      regionResults[region] = {
        status: "scored",
        degrees,
        riskBand: match.riskBand,
        riskScore: match.riskScore,
        methodologyVersion: match.methodologyVersion,
      };
      scoredRows.push({
        bodyRegion: region,
        score: match.riskScore,
        riskBand: match.riskBand,
        scoringRuleVersion: match.methodologyVersion,
      });
    } else {
      // Surfaced, not swallowed — same reasoning as the camera path: an
      // entered angle that matches no ScoringRule row is a real data gap
      // (unrealistic input, or a genuine hole in the seeded thresholds),
      // reported back rather than silently dropped. The raw degrees stay
      // recoverable later via `manualAngles` on the persisted sample even
      // though no BodyRegionScore row is created for this region.
      regionResults[region] = { status: "no-matching-rule", degrees };
    }
  }
  // Every BodyRegion not in MANUAL_ENTRY_BODY_REGIONS never gets a
  // formula — same "not-yet-supported" reporting as buildRegionResults'
  // manual branch.
  for (const region of Object.values(BodyRegion)) {
    if (!isManuallyScorableRegion(region)) {
      regionResults[region] = { status: "not-yet-supported" };
    }
  }

  const sample = await prisma.$transaction(async (tx) => {
    const created = await tx.postureSample.create({
      data: {
        taskId: params.taskId,
        capturedAt: new Date(),
        cameraAngle: MANUAL_ENTRY_CAMERA_ANGLE_PLACEHOLDER,
        source: "MANUAL_ENTRY",
        manualAngles: angles,
        holdDurationSeconds: params.holdDurationSeconds ?? null,
        validationStatus: "PENDING_REVIEW",
      },
    });

    if (scoredRows.length > 0) {
      await tx.bodyRegionScore.createMany({
        data: scoredRows.map((row) => ({
          postureSampleId: created.id,
          bodyRegion: row.bodyRegion,
          score: row.score,
          riskBand: row.riskBand,
          scoringRuleVersion: row.scoringRuleVersion,
        })),
      });
    }

    return created;
  });

  const holdTime = await computeHoldTimeResult({
    regions: regionResults,
    holdDurationSeconds: params.holdDurationSeconds ?? null,
    methodologyVersion: params.methodologyVersion,
  });

  return {
    postureSampleId: sample.id,
    methodologyVersion: params.methodologyVersion,
    regions: regionResults,
    holdTime,
  };
}
