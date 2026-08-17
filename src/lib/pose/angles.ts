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

export type Point2D = { x: number; y: number };

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
// angle(a, vertex, c) in the formulas below. Exported so drag-to-angle.ts
// can compute a region's angle from a hypothetical (post-drag) landmark
// position using this exact function, not a re-derived copy — see that
// module's own comment for why identity here matters.
export function includedAngle(a: Point2D, vertex: Point2D, c: Point2D): number {
  return angleBetween(vector(vertex, a), vector(vertex, c));
}

// Exported alongside includedAngle for the same reason — drag-to-angle.ts's
// TRUNK/NECK formulas need this exact conversion, not a re-derived copy.
export function flexionFrom180(includedDegrees: number): number {
  return 180 - includedDegrees;
}

// Signed neck flexion: the plain three-point angle only gives a magnitude
// (0-180°), which can't distinguish forward flexion (chin toward chest)
// from backward extension (looking up/back) — both bend the ear away from
// the shoulder-hip line by the same amount, just in opposite rotational
// directions. Disambiguating requires knowing which way the subject faces
// in the image.
//
// Facing direction is auto-detected per sample via resolveNeckFacingSign
// (below) — a cross product between the trunk axis and the nose's offset
// from shoulderMid, NOT a raw nose.x-vs-shoulderMid.x comparison (see that
// function's own comment for why the raw-x version is unstable). The
// rotational direction of the ear relative to the shoulder->hip (trunk)
// line is then read off a 2D cross product, and combined with facing
// direction to decide the sign: bending toward the facing direction is
// flexion (+), bending away from it is extension (-).
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
  const hipMid = midpoint(points.leftHip, points.rightHip);
  const facingSign = resolveNeckFacingSign(points.nose, shoulderMid, hipMid);

  const earMid = midpoint(points.leftEar, points.rightEar);
  const trunkVector = vector(shoulderMid, hipMid);
  const neckVector = vector(shoulderMid, earMid);
  const cross = trunkVector.x * neckVector.y - trunkVector.y * neckVector.x;

  const flexionSign = Math.sign(-cross * facingSign);
  return magnitude * flexionSign;
}

// Which side of the trunk axis the head is offset toward — the signal
// signedNeckFlexion (and every other NECK-sign call site: drag-to-angle.ts's
// NOSE-drag branch, forward-kinematics.ts's applyNeckRotation) needs to
// disambiguate forward flexion from backward extension.
//
// Deliberately NOT a raw `nose.x vs shoulderMid.x` world-space comparison,
// which is what this used to be. nose and shoulderMid both belong to the
// same rigid "upper body" group that a TRUNK edit/rotation carries along
// together (forward-kinematics.ts's applyTrunkRotation rotates the head
// with the shoulders around the hip pivot) — so that raw x-difference is
// itself a vector that rotates along with the trunk, and can cross zero
// (flipping the reported facing direction, and with it the reported NECK
// sign) for a large enough trunk flexion even though the subject hasn't
// actually turned to face a different way. Confirmed reachable in practice:
// bending TRUNK forward in the posture editor drove exactly this flip,
// reported as the NECK slider "jumping to the opposite band and refusing
// to respond" once the internally-tracked angle desynced from the
// (ANATOMICAL_LIMITS-clamped) displayed slider position.
//
// Signing via a cross product between the trunk axis (shoulderMid->hipMid)
// and the nose's offset from shoulderMid instead: both vectors are members
// of the same rigid group and rotate together under any common rotation of
// the upper body, so their cross product's sign — hence this function's
// result — stays constant no matter how far the trunk itself is bent
// (cross(Rv1, Rv2) = cross(v1, v2) for any shared rotation R, a standard
// rotation invariant). For an upright trunk (shoulderMid directly above
// hipMid, every existing fixture/test case) this collapses to exactly the
// old raw-x comparison, so it changes nothing for a neutral or lightly-bent
// trunk — see angles.test.ts.
//
// Degenerate case: nose exactly on the trunk axis (cross === 0) — the
// generalized form of "subject facing the camera, not in profile," same
// treatment as before (throws rather than guessing a direction).
export function resolveNeckFacingSign(
  nose: Point2D,
  shoulderMid: Point2D,
  hipMid: Point2D,
): number {
  const trunkVector = vector(shoulderMid, hipMid);
  const noseVector = vector(shoulderMid, nose);
  const cross = trunkVector.x * noseVector.y - trunkVector.y * noseVector.x;
  const facingSign = -Math.sign(cross);
  if (facingSign === 0) {
    throw new Error(
      "Cannot determine neck flexion sign: nose lies on the trunk axis (subject not in profile)",
    );
  }
  return facingSign;
}

// A synthetic point directly "below" `origin` in image space (y increases
// downward — MediaPipe convention) — the vertical reference direction HIP
// flexion measures against (see hipFlexion below). The offset's magnitude
// (1) is arbitrary: includedAngle only ever reads direction, never
// distance, from the points it's given.
function verticalReferencePoint(origin: Point2D): Point2D {
  return { x: origin.x, y: origin.y + 1 };
}

// HIP flexion for one side: the angle between straight-down-from-the-hip
// (verticalReferencePoint) and the hip->knee vector. 0° when the knee
// hangs directly below the hip (standing), increasing as the thigh lifts
// forward — deliberately measured against a fixed vertical reference
// rather than against another body landmark, unlike every other formula in
// this file (TRUNK's own shoulder-hip-knee triangle, for instance). That's
// the point: a shoulder-hip-knee-style measurement would still be coupled
// to trunk lean (bend forward at the trunk and the "hip angle" that
// formula reports changes even though the thigh itself never moved),
// which is exactly why HIP was originally treated as redundant with TRUNK
// and left undraggable (see SLD_SKELETON_FIXES.md's Fix 3 "why it was
// missing"). Anchoring to true vertical instead makes this a genuinely
// independent measurement — ergonomically, "how far has the thigh lifted
// off vertical," the number that matters for seated work/pedal operation
// regardless of how upright the trunk happens to be.
//
// Not part of ComputedBodyRegion/computeRawBodyAngle/computeBodyAngles
// below, deliberately: HIP has no seeded ScoringRule yet (no formula in
// the persisted capture-scoring pipeline — see RegionResult's own
// "not-yet-supported" status), so it stays out of that 8-region contract
// entirely rather than forcing a ninth always-present-but-never-scored
// entry through every one of that type's consumers (buildRegionResults,
// the capture API, the PDF report). drag-to-angle.ts's computeAllAngles —
// the live, ungated posture-editor computation, which already has its own
// wider BodyRegion-keyed return type — calls this directly instead,
// bilateral-averaging the two sides the same way computeRawBodyAngle's own
// TRUNK/NECK cases do.
export function hipFlexion(hip: Point2D, knee: Point2D): number {
  return includedAngle(verticalReferencePoint(hip), hip, knee);
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

// Runtime companion to the type above — the same 8 BodyRegion values
// computeBodyAngles produces a reading for, as an actual array rather than
// a union that only exists at compile time. The single source of truth
// for "which regions does the scoring engine support," reused by
// build-region-results.ts (replacing what used to be its own private
// copy of this list) and by manual-angles.ts (which computed regions a
// manual-entry form must collect).
export const COMPUTED_BODY_REGIONS: readonly ComputedBodyRegion[] = [
  BodyRegion.TRUNK,
  BodyRegion.NECK,
  BodyRegion.SHOULDER_LEFT,
  BodyRegion.SHOULDER_RIGHT,
  BodyRegion.ELBOW_LEFT,
  BodyRegion.ELBOW_RIGHT,
  BodyRegion.KNEE_LEFT,
  BodyRegion.KNEE_RIGHT,
];

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
// Pure per-region geometry — NO gates at all (no camera-angle check, no
// visibility check). Exported so drag-to-angle.ts's manual-review pathway
// (which deliberately bypasses computeBodyAngles' camera-angle gate
// already — see that module's own compliance note — and, as of this
// function existing, its visibility gate too) can compute a region's
// current angle directly, without needing computeBodyAngles' own gates to
// have already passed for it. computeBodyAngles below calls this too, once
// ITS gates decide the result should be reported — so there is exactly one
// implementation of each formula, never two copies that could drift; this
// function's own behavior is byte-for-byte what computeBodyAngles already
// computed inline before this extraction (see angles.test.ts, unchanged).
//
// Can throw for NECK's genuine facing-direction degeneracy
// (signedNeckFlexion's own throw) — a real data anomaly, not something
// either gate is meant to catch, and already true of computeBodyAngles
// before this extraction (it just couldn't happen for a region the
// visibility gate had already rejected, since compute() was never called;
// a caller invoking this function directly for NECK specifically should
// still expect that same throw).
export function computeRawBodyAngle(
  region: ComputedBodyRegion,
  landmarks: PoseLandmarks,
): number {
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

  switch (region) {
    // TRUNK: 180 - average(angle(shoulder, hip, knee)) — vertex at the hip.
    case BodyRegion.TRUNK:
      return flexionFrom180(
        (includedAngle(leftShoulder, leftHip, leftKnee) +
          includedAngle(rightShoulder, rightHip, rightKnee)) /
          2,
      );

    // NECK: 180 - average(angle(ear, shoulder, hip)) — vertex at the
    // shoulder — then signed per signedNeckFlexion above.
    case BodyRegion.NECK: {
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
    }

    // SHOULDER_LEFT/RIGHT: angle(hip, shoulder, elbow) — vertex at the
    // shoulder — already 0° at neutral (arm at side), no 180-minus.
    case BodyRegion.SHOULDER_LEFT:
      return includedAngle(leftHip, leftShoulder, leftElbow);
    case BodyRegion.SHOULDER_RIGHT:
      return includedAngle(rightHip, rightShoulder, rightElbow);

    // ELBOW_LEFT/RIGHT: 180 - angle(shoulder, elbow, wrist) — vertex at
    // the elbow.
    case BodyRegion.ELBOW_LEFT:
      return flexionFrom180(includedAngle(leftShoulder, leftElbow, leftWrist));
    case BodyRegion.ELBOW_RIGHT:
      return flexionFrom180(
        includedAngle(rightShoulder, rightElbow, rightWrist),
      );

    // KNEE_LEFT/RIGHT: 180 - angle(hip, knee, ankle) — vertex at the knee.
    case BodyRegion.KNEE_LEFT:
      return flexionFrom180(includedAngle(leftHip, leftKnee, leftAnkle));
    case BodyRegion.KNEE_RIGHT:
      return flexionFrom180(includedAngle(rightHip, rightKnee, rightAnkle));
  }
}

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

  const leftShoulder = at(LANDMARK_INDEX.LEFT_SHOULDER);
  const rightShoulder = at(LANDMARK_INDEX.RIGHT_SHOULDER);
  const leftElbow = at(LANDMARK_INDEX.LEFT_ELBOW);
  const rightElbow = at(LANDMARK_INDEX.RIGHT_ELBOW);
  const leftHip = at(LANDMARK_INDEX.LEFT_HIP);
  const rightHip = at(LANDMARK_INDEX.RIGHT_HIP);
  const leftKnee = at(LANDMARK_INDEX.LEFT_KNEE);
  const rightKnee = at(LANDMARK_INDEX.RIGHT_KNEE);
  const leftAnkle = at(LANDMARK_INDEX.LEFT_ANKLE);
  const rightAnkle = at(LANDMARK_INDEX.RIGHT_ANKLE);
  const nose = at(LANDMARK_INDEX.NOSE);
  const leftEar = at(LANDMARK_INDEX.LEFT_EAR);
  const rightEar = at(LANDMARK_INDEX.RIGHT_EAR);
  const leftWrist = at(LANDMARK_INDEX.LEFT_WRIST);
  const rightWrist = at(LANDMARK_INDEX.RIGHT_WRIST);

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
  const reading = (region: ComputedBodyRegion): BodyAngleReading => {
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

    // computeRawBodyAngle is only ever invoked here once both gates above
    // have already passed for `region` — same lazy-evaluation contract the
    // inline compute() closures this replaced always had (NECK's throw
    // path is still only reachable for a region visibility didn't already
    // reject).
    return { ok: true, degrees: computeRawBodyAngle(region, landmarks) };
  };

  return {
    [BodyRegion.TRUNK]: reading(BodyRegion.TRUNK),
    [BodyRegion.NECK]: reading(BodyRegion.NECK),
    // Not camera-angle-gated — see the REQUIRED_CAMERA_ANGLE comment for
    // why SHOULDER_LEFT/RIGHT have no entry there.
    [BodyRegion.SHOULDER_LEFT]: reading(BodyRegion.SHOULDER_LEFT),
    [BodyRegion.SHOULDER_RIGHT]: reading(BodyRegion.SHOULDER_RIGHT),
    [BodyRegion.ELBOW_LEFT]: reading(BodyRegion.ELBOW_LEFT),
    [BodyRegion.ELBOW_RIGHT]: reading(BodyRegion.ELBOW_RIGHT),
    [BodyRegion.KNEE_LEFT]: reading(BodyRegion.KNEE_LEFT),
    [BodyRegion.KNEE_RIGHT]: reading(BodyRegion.KNEE_RIGHT),
  };
}
