import { BodyRegion, CameraAngle } from "@/generated/prisma/enums";

// MediaPipe Pose Landmarker output: 33 landmarks, normalized image
// coordinates (x, y in [0,1], origin top-left, y increasing downward) plus
// a relative depth estimate (z) and a visibility/presence confidence.
// https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker
//
// Per CLAUDE.md/ERGO_COMPLIANCE_BY_DESIGN.md §5 ("2D single-camera vs.
// calibrated stereo" — still an open item), this module deliberately uses
// only x/y. MediaPipe's z is a relative, uncalibrated depth estimate;
// leaning on it here would silently decide that open question as a side
// effect instead of on its own merits. z is accepted on the type for
// fidelity to the real MediaPipe result shape but is never read.
export type PoseLandmark = {
  x: number;
  y: number;
  z: number;
  visibility?: number;
};

// Indexed per MediaPipe's 33-point Pose Landmarker topology.
export type PoseLandmarks = readonly PoseLandmark[];

// Exported for callers/tests building synthetic or partial landmark arrays.
export const LANDMARK_INDEX = {
  NOSE: 0,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
} as const;

type Point2D = { x: number; y: number };

function vector(from: Point2D, to: Point2D): Point2D {
  return { x: to.x - from.x, y: to.y - from.y };
}

function midpoint(a: Point2D, b: Point2D): Point2D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function angleBetween(a: Point2D, b: Point2D): number {
  const dot = a.x * b.x + a.y * b.y;
  const magnitude = Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y);
  // Float rounding can push cos marginally outside [-1, 1], which would
  // make Math.acos return NaN.
  const cos = Math.min(1, Math.max(-1, dot / magnitude));
  return (Math.acos(cos) * 180) / Math.PI;
}

// The angle at `vertex`, between rays toward `a` and toward `c` —
// angle(a, vertex, c) in the formulas below.
function includedAngle(a: Point2D, vertex: Point2D, c: Point2D): number {
  return angleBetween(vector(vertex, a), vector(vertex, c));
}

function flexionFrom180(includedDegrees: number): number {
  return 180 - includedDegrees;
}

// Signed neck flexion: the plain three-point angle only gives a magnitude
// (0-180°), which can't distinguish forward flexion (chin toward chest)
// from backward extension (looking up/back) — both bend the ear away from
// the shoulder-hip line by the same amount, just in opposite rotational
// directions. Disambiguating requires knowing which way the subject faces
// in the image.
//
// Facing direction is auto-detected per sample from nose.x relative to the
// shoulder-midpoint x (the nose sits on whichever side of the neck line
// the subject is facing). The rotational direction of the ear relative to
// the shoulder->hip (trunk) line is then read off a 2D cross product, and
// combined with facing direction to decide the sign: bending toward the
// facing direction is flexion (+), bending away from it is extension (-).
//
// Degenerate case: if nose.x exactly equals the shoulder-midpoint x,
// facing direction can't be determined from this heuristic (the pose is
// effectively facing the camera, not in profile) — this throws rather than
// guessing a direction, consistent with treating an unresolvable case as a
// data problem rather than silently picking a sign.
function signedNeckFlexion(
  magnitude: number,
  points: {
    nose: Point2D;
    leftShoulder: Point2D;
    rightShoulder: Point2D;
    leftEar: Point2D;
    rightEar: Point2D;
    leftHip: Point2D;
    rightHip: Point2D;
  },
): number {
  const shoulderMid = midpoint(points.leftShoulder, points.rightShoulder);
  const facingSign = Math.sign(points.nose.x - shoulderMid.x);
  if (facingSign === 0) {
    throw new Error(
      "Cannot determine neck flexion sign: nose.x equals shoulder-midpoint x (subject not in profile)",
    );
  }

  const hipMid = midpoint(points.leftHip, points.rightHip);
  const earMid = midpoint(points.leftEar, points.rightEar);
  const trunkVector = vector(shoulderMid, hipMid);
  const neckVector = vector(shoulderMid, earMid);
  const cross = trunkVector.x * neckVector.y - trunkVector.y * neckVector.x;

  const flexionSign = Math.sign(-cross * facingSign);
  return magnitude * flexionSign;
}

export type ComputedBodyRegion =
  | typeof BodyRegion.TRUNK
  | typeof BodyRegion.NECK
  | typeof BodyRegion.SHOULDER_LEFT
  | typeof BodyRegion.SHOULDER_RIGHT
  | typeof BodyRegion.ELBOW_LEFT
  | typeof BodyRegion.ELBOW_RIGHT
  | typeof BodyRegion.KNEE_LEFT
  | typeof BodyRegion.KNEE_RIGHT;

// A landmark that failed the visibility gate, reported by name so the
// caller (and the operator, ultimately) knows exactly which joint wasn't
// actually observed.
export type FailedLandmark = { name: string; visibility: number };

// A successfully computed angle, or an explicit record of why one wasn't
// computed — never a silently-omitted region and never a thrown generic
// error for an expected/foreseeable condition like a camera angle mismatch
// or a low-confidence landmark (as opposed to signedNeckFlexion's
// indeterminate-facing-direction throw above, which is a genuine data
// anomaly, not a routine operational one).
export type BodyAngleReading =
  | { ok: true; degrees: number }
  | {
      ok: false;
      reason: "WRONG_CAMERA_ANGLE";
      requiredCameraAngle: readonly CameraAngle[];
      actualCameraAngle: CameraAngle;
    }
  | {
      ok: false;
      reason: "INSUFFICIENT_VISIBILITY";
      failedLandmarks: readonly FailedLandmark[];
    };

export type BodyAngles = Record<ComputedBodyRegion, BodyAngleReading>;

// Which CameraAngle(s) a region's formula is valid for. TRUNK, NECK, both
// KNEE regions, and both ELBOW regions are all sagittal-plane flexion
// measurements (the vertical-line-with-a-bend geometry every one of their
// formulas assumes only holds up when viewed from the side) and are gated
// to SAGITTAL accordingly.
//
// SHOULDER_LEFT/RIGHT has NO entry here, and that's a permanent,
// deliberate gap, not an unfinished TODO — do not "fix" it by picking an
// angle later without reading this. Its formula (angle(hip, shoulder,
// elbow)) measures arm-elevation *magnitude* without direction, matching
// how RULA/REBA-style tools generally score upper-arm posture. But no
// single CameraAngle makes that measurement reliable: a SAGITTAL camera
// foreshortens lateral abduction (raising the arm out to the side reads as
// near-zero elevation), while a FRONTAL camera foreshortens forward
// flexion (raising the arm forward reads the same way). This is a real
// single-2D-camera limitation, not a gap in the gating logic — it's a
// concrete instance of ERGO_COMPLIANCE_BY_DESIGN.md §5's still-open
// "2D single-camera vs. calibrated stereo" decision, and resolving it
// requires resolving that, not adding a CameraAngle check here.
const REQUIRED_CAMERA_ANGLE: Partial<
  Record<ComputedBodyRegion, readonly CameraAngle[]>
> = {
  [BodyRegion.TRUNK]: [CameraAngle.SAGITTAL],
  [BodyRegion.NECK]: [CameraAngle.SAGITTAL],
  [BodyRegion.KNEE_LEFT]: [CameraAngle.SAGITTAL],
  [BodyRegion.KNEE_RIGHT]: [CameraAngle.SAGITTAL],
  [BodyRegion.ELBOW_LEFT]: [CameraAngle.SAGITTAL],
  [BodyRegion.ELBOW_RIGHT]: [CameraAngle.SAGITTAL],
};

// Below this MediaPipe visibility/presence confidence (0-1), a landmark is
// treated as not actually observed — e.g. out of frame or occluded — and
// not just slightly noisy. A real case this catches: a landmark whose
// normalized y sits outside [0, 1] (physically outside the captured frame)
// reliably comes back with visibility near 0, but MediaPipe still returns
// *some* extrapolated x/y for it rather than omitting it — silently
// computing on that guess is how a capture where the hips aren't even in
// frame produced confident-looking NECK degrees.
//
// 0.5 is a starting point, not empirically tuned — revisit once the
// accuracy validation study (ERGO_COMPLIANCE_BY_DESIGN.md §5) has real
// data on where visibility scores actually separate observed from
// extrapolated landmarks.
export const MIN_LANDMARK_VISIBILITY = 0.5;

// Given a full 33-point MediaPipe Pose Landmarker result and the
// CameraAngle the sample was tagged with, returns flexion-from-neutral
// degrees (see CLAUDE.md "Scoring methodology": 0° = upright/neutral) for
// the 8 BodyRegion values that v1-2026-07 has thresholds for. Every other
// BodyRegion (HIP, UPPER_ARM_LEFT/RIGHT, FOREARM_LEFT/RIGHT,
// ANKLE_LEFT/RIGHT, WRIST_LEFT/RIGHT) has no formula and no seeded
// ScoringRule yet, so this deliberately does not compute them rather than
// guess a joint triple with nothing to validate it against.
//
// Pure function: no camera, capture, or persistence concerns. Angles are
// computed directly from the landmarks array and cameraAngle passed in.
export function computeBodyAngles(
  landmarks: PoseLandmarks,
  cameraAngle: CameraAngle,
): BodyAngles {
  // Returns the full PoseLandmark (visibility included), not just Point2D —
  // the geometry helpers above only read x/y so this is still a drop-in
  // Point2D wherever they're called, but the visibility gate below needs
  // the field they'd otherwise erase.
  const at = (index: number): PoseLandmark => landmarks[index];

  const nose = at(LANDMARK_INDEX.NOSE);
  const leftEar = at(LANDMARK_INDEX.LEFT_EAR);
  const rightEar = at(LANDMARK_INDEX.RIGHT_EAR);
  const leftShoulder = at(LANDMARK_INDEX.LEFT_SHOULDER);
  const rightShoulder = at(LANDMARK_INDEX.RIGHT_SHOULDER);
  const leftElbow = at(LANDMARK_INDEX.LEFT_ELBOW);
  const rightElbow = at(LANDMARK_INDEX.RIGHT_ELBOW);
  const leftWrist = at(LANDMARK_INDEX.LEFT_WRIST);
  const rightWrist = at(LANDMARK_INDEX.RIGHT_WRIST);
  const leftHip = at(LANDMARK_INDEX.LEFT_HIP);
  const rightHip = at(LANDMARK_INDEX.RIGHT_HIP);
  const leftKnee = at(LANDMARK_INDEX.LEFT_KNEE);
  const rightKnee = at(LANDMARK_INDEX.RIGHT_KNEE);
  const leftAnkle = at(LANDMARK_INDEX.LEFT_ANKLE);
  const rightAnkle = at(LANDMARK_INDEX.RIGHT_ANKLE);

  // Which named landmarks each region's formula actually reads — matches
  // the geometry below exactly, not the general "8 regions" list. TRUNK and
  // NECK combine both sides into one region (they average left+right), so
  // both sides' landmarks are required; SHOULDER/ELBOW/KNEE are separate
  // per-side regions, so each only requires its own side's landmarks.
  const requiredLandmarksFor: Record<
    ComputedBodyRegion,
    readonly { name: string; landmark: PoseLandmark }[]
  > = {
    [BodyRegion.TRUNK]: [
      { name: "leftShoulder", landmark: leftShoulder },
      { name: "rightShoulder", landmark: rightShoulder },
      { name: "leftHip", landmark: leftHip },
      { name: "rightHip", landmark: rightHip },
      { name: "leftKnee", landmark: leftKnee },
      { name: "rightKnee", landmark: rightKnee },
    ],
    [BodyRegion.NECK]: [
      { name: "nose", landmark: nose },
      { name: "leftEar", landmark: leftEar },
      { name: "rightEar", landmark: rightEar },
      { name: "leftShoulder", landmark: leftShoulder },
      { name: "rightShoulder", landmark: rightShoulder },
      { name: "leftHip", landmark: leftHip },
      { name: "rightHip", landmark: rightHip },
    ],
    [BodyRegion.SHOULDER_LEFT]: [
      { name: "leftHip", landmark: leftHip },
      { name: "leftShoulder", landmark: leftShoulder },
      { name: "leftElbow", landmark: leftElbow },
    ],
    [BodyRegion.SHOULDER_RIGHT]: [
      { name: "rightHip", landmark: rightHip },
      { name: "rightShoulder", landmark: rightShoulder },
      { name: "rightElbow", landmark: rightElbow },
    ],
    [BodyRegion.ELBOW_LEFT]: [
      { name: "leftShoulder", landmark: leftShoulder },
      { name: "leftElbow", landmark: leftElbow },
      { name: "leftWrist", landmark: leftWrist },
    ],
    [BodyRegion.ELBOW_RIGHT]: [
      { name: "rightShoulder", landmark: rightShoulder },
      { name: "rightElbow", landmark: rightElbow },
      { name: "rightWrist", landmark: rightWrist },
    ],
    [BodyRegion.KNEE_LEFT]: [
      { name: "leftHip", landmark: leftHip },
      { name: "leftKnee", landmark: leftKnee },
      { name: "leftAnkle", landmark: leftAnkle },
    ],
    [BodyRegion.KNEE_RIGHT]: [
      { name: "rightHip", landmark: rightHip },
      { name: "rightKnee", landmark: rightKnee },
      { name: "rightAnkle", landmark: rightAnkle },
    ],
  };

  // Gates on cameraAngle, then landmark visibility, before doing any
  // geometry for that region — a mismatch/insufficient-visibility is
  // reported as an explicit reading, and `compute` (which for NECK can
  // throw on an indeterminate facing direction) never runs once either gate
  // has already rejected the region. Visibility rejects the *whole* region
  // if *any* required landmark fails — no partial/best-effort reading off
  // the landmarks that did pass.
  const reading = (
    region: ComputedBodyRegion,
    compute: () => number,
  ): BodyAngleReading => {
    const required = REQUIRED_CAMERA_ANGLE[region];
    if (required && !required.includes(cameraAngle)) {
      return {
        ok: false,
        reason: "WRONG_CAMERA_ANGLE",
        requiredCameraAngle: required,
        actualCameraAngle: cameraAngle,
      };
    }

    const failedLandmarks: FailedLandmark[] = requiredLandmarksFor[region]
      .filter(
        ({ landmark }) => (landmark.visibility ?? 0) < MIN_LANDMARK_VISIBILITY,
      )
      .map(({ name, landmark }) => ({
        name,
        visibility: landmark.visibility ?? 0,
      }));
    if (failedLandmarks.length > 0) {
      return { ok: false, reason: "INSUFFICIENT_VISIBILITY", failedLandmarks };
    }

    return { ok: true, degrees: compute() };
  };

  return {
    // TRUNK: 180 - average(angle(shoulder, hip, knee)) — vertex at the hip.
    [BodyRegion.TRUNK]: reading(BodyRegion.TRUNK, () =>
      flexionFrom180(
        (includedAngle(leftShoulder, leftHip, leftKnee) +
          includedAngle(rightShoulder, rightHip, rightKnee)) /
          2,
      ),
    ),

    // NECK: 180 - average(angle(ear, shoulder, hip)) — vertex at the
    // shoulder — then signed per signedNeckFlexion above.
    [BodyRegion.NECK]: reading(BodyRegion.NECK, () => {
      const neckIncludedAvg =
        (includedAngle(leftEar, leftShoulder, leftHip) +
          includedAngle(rightEar, rightShoulder, rightHip)) /
        2;
      return signedNeckFlexion(flexionFrom180(neckIncludedAvg), {
        nose,
        leftShoulder,
        rightShoulder,
        leftEar,
        rightEar,
        leftHip,
        rightHip,
      });
    }),

    // SHOULDER_LEFT/RIGHT: angle(hip, shoulder, elbow) — vertex at the
    // shoulder — already 0° at neutral (arm at side), no 180-minus. Not
    // camera-angle-gated — see the REQUIRED_CAMERA_ANGLE comment for why.
    [BodyRegion.SHOULDER_LEFT]: reading(BodyRegion.SHOULDER_LEFT, () =>
      includedAngle(leftHip, leftShoulder, leftElbow),
    ),
    [BodyRegion.SHOULDER_RIGHT]: reading(BodyRegion.SHOULDER_RIGHT, () =>
      includedAngle(rightHip, rightShoulder, rightElbow),
    ),

    // ELBOW_LEFT/RIGHT: 180 - angle(shoulder, elbow, wrist) — vertex at the
    // elbow. Gated to SAGITTAL, same as TRUNK/NECK/KNEE.
    [BodyRegion.ELBOW_LEFT]: reading(BodyRegion.ELBOW_LEFT, () =>
      flexionFrom180(includedAngle(leftShoulder, leftElbow, leftWrist)),
    ),
    [BodyRegion.ELBOW_RIGHT]: reading(BodyRegion.ELBOW_RIGHT, () =>
      flexionFrom180(includedAngle(rightShoulder, rightElbow, rightWrist)),
    ),

    // KNEE_LEFT/RIGHT: 180 - angle(hip, knee, ankle) — vertex at the knee.
    [BodyRegion.KNEE_LEFT]: reading(BodyRegion.KNEE_LEFT, () =>
      flexionFrom180(includedAngle(leftHip, leftKnee, leftAnkle)),
    ),
    [BodyRegion.KNEE_RIGHT]: reading(BodyRegion.KNEE_RIGHT, () =>
      flexionFrom180(includedAngle(rightHip, rightKnee, rightAnkle)),
    ),
  };
}
