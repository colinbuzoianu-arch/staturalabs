import type {
  BodyRegion,
  CameraAngle,
  RiskBand,
} from "@/generated/prisma/enums";
import type { FailedLandmark, PoseLandmark } from "@/lib/pose/angles";

// Request/response contract for POST /api/posture-samples. Shared between
// the route handler and any client that calls it (the capture page today;
// a future results dashboard is expected to read the same underlying data,
// not a reshaped version of it — see CLAUDE.md).
export type PostureSampleRequest = {
  landmarks: PoseLandmark[];
  cameraAngle: CameraAngle;
  taskId: string;
};

// One outcome per BodyRegion, always present — never an omitted key.
// "not-yet-supported" covers every BodyRegion computeBodyAngles doesn't
// compute yet (HIP, UPPER_ARM_*, FOREARM_*, ANKLE_*, WRIST_*).
// "insufficient-visibility" covers a required landmark computeBodyAngles
// did have a formula for, but wasn't confidently observed in this sample —
// see MIN_LANDMARK_VISIBILITY in src/lib/pose/angles.ts.
export type RegionResult =
  | {
      status: "scored";
      degrees: number;
      riskBand: RiskBand;
      riskScore: number;
      methodologyVersion: string;
    }
  | {
      status: "wrong-camera-angle";
      requiredCameraAngle: CameraAngle[];
      actualCameraAngle: CameraAngle;
    }
  | { status: "insufficient-visibility"; failedLandmarks: FailedLandmark[] }
  | { status: "no-matching-rule"; degrees: number }
  | { status: "not-yet-supported" };

// The hold-time sub-score (SLD_IMPLEMENTATION_PLAN_austria-first.md §6) —
// a parallel result alongside `regions`, never blended into it. null when
// no `holdDurationSeconds` was recorded for this sample, or when nothing
// scored at all (no posture severity to anchor a hold-time ceiling
// against). `holdTimeBand` is null when the hold duration stayed within
// the safe ceiling for `worstPostureBand`'s severity — see
// src/lib/scoring/hold-time.ts. `overallBand` is the "rolled up worst-of"
// value (§6): `holdTimeBand` when the ceiling was exceeded, otherwise
// `worstPostureBand` unchanged.
export type HoldTimeResult = {
  holdDurationSeconds: number;
  worstPostureBand: RiskBand;
  holdTimeBand: RiskBand | null;
  overallBand: RiskBand;
} | null;

export type PostureSampleResponse = {
  postureSampleId: string;
  methodologyVersion: string;
  regions: Record<BodyRegion, RegionResult>;
  holdTime: HoldTimeResult;
};
