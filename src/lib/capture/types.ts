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

export type PostureSampleResponse = {
  postureSampleId: string;
  methodologyVersion: string;
  regions: Record<BodyRegion, RegionResult>;
};
