import { type BodyRegion, CameraAngle } from "@/generated/prisma/enums";
import {
  type ComputedBodyRegion,
  computeBodyAngles,
  flexionFrom180,
  includedAngle,
  LANDMARK_INDEX,
  type PoseLandmark,
  type PoseLandmarks,
} from "./angles";
import {
  ANATOMICAL_LIMITS,
  JOINT_REGIONS,
  VIRTUAL_CHEST_LANDMARK_INDEX,
} from "./skeleton";

// Pure math — no DOM, no React, client-importable. The inverse of
// forward-kinematics.ts: that module takes an angle and produces new
// landmark positions; this module takes a new landmark position (from a
// drag gesture) and produces the angle it implies. Same compliance posture
// as every other pose/* module (visualization/editing-only, never
// persisted by this module itself, never a second scoring pipeline).
//
// Coordinate space: `newPosition` is in the same normalized image-space
// (x, y in ~[0,1], MediaPipe convention) computeBodyAngles itself reads —
// not three.js scene-unit space. A 3D drag UI (e.g. skeleton-3d.tsx) is
// responsible for converting its own drag output back to this space before
// calling in here; this module has no way to know whether a caller wants
// that inverse transform applied, and guessing would silently pick a
// convention instead of leaving it to whoever actually owns that mapping.

type Point2D = { x: number; y: number };

function midpoint(a: Point2D, b: Point2D): Point2D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// JOINT_REGIONS is typed Record<number, BodyRegion> (every numeric key
// "promises" a BodyRegion) even though only 8 of the 34 possible indices
// actually have an entry — same defensive hasOwn lookup skeleton-3d.tsx's
// regionForJoint uses, reimplemented here since this module must stay free
// of that component's DOM/three.js-adjacent code (no noUncheckedIndexedAccess
// in this project's tsconfig, so the type alone can't be trusted for
// indices outside JOINT_REGIONS' real key set).
function regionForJoint(index: number): BodyRegion | undefined {
  return Object.hasOwn(JOINT_REGIONS, index) ? JOINT_REGIONS[index] : undefined;
}

// Every CameraAngle value, tried in order wherever this module needs to
// compute a region's angle "for manual review" rather than "for automated
// scoring" — see computeAllAngles below for the full rationale. A region's
// computed degrees never depend on which CameraAngle was passed (that only
// gates whether computeBodyAngles reports the reading at all, never the
// geometry itself), so trying every value and keeping the first passing
// reading is exactly equivalent to "no camera-angle gate," without a
// second, drift-prone copy of computeBodyAngles' own 8-region formula.
const ALL_CAMERA_ANGLES: readonly CameraAngle[] = Object.values(CameraAngle);

// Given a complete set of (possibly user-adjusted) landmarks, computes
// every currently-computable region's angle — the same 8 regions
// computeBodyAngles produces a reading for — without computeBodyAngles' own
// camera-angle gate. A human reviewing the rendered skeleton (or actively
// dragging a joint on it) is already making the "is this a usable view"
// judgment visually; re-applying that gate here would only hide a real,
// visible angle from the editor. The *visibility* gate is NOT bypassed: a
// landmark that genuinely wasn't observed still can't produce a real angle
// no matter who's reviewing it, so a region missing from the returned map
// means a required landmark had insufficient visibility, not that it was
// filtered by camera angle.
export function computeAllAngles(
  landmarks: PoseLandmarks,
): Map<BodyRegion, number> {
  const result = new Map<BodyRegion, number>();
  for (const cameraAngle of ALL_CAMERA_ANGLES) {
    const angles = computeBodyAngles(landmarks, cameraAngle);
    for (const region of Object.keys(angles) as ComputedBodyRegion[]) {
      if (result.has(region)) continue;
      const reading = angles[region];
      if (reading.ok) result.set(region, reading.degrees);
    }
  }
  return result;
}

export type DragAngleResult = {
  bodyRegion: BodyRegion;
  angleDegrees: number;
  clamped: boolean;
};

function clampToLimits(
  bodyRegion: BodyRegion,
  angleDegrees: number,
): { angleDegrees: number; clamped: boolean } {
  const limits = ANATOMICAL_LIMITS[bodyRegion];
  if (!limits) return { angleDegrees, clamped: false };
  const clampedDegrees = Math.min(
    limits.max,
    Math.max(limits.min, angleDegrees),
  );
  return {
    angleDegrees: clampedDegrees,
    clamped: clampedDegrees !== angleDegrees,
  };
}

// The inverse of applyAngleAdjustments: given a NEW position for one
// draggable landmark (JOINT_REGIONS), computes the resulting angle for the
// BodyRegion it controls — the value a caller feeds back into
// applyAngleAdjustments as `targetDegrees`. Throws if `draggedLandmarkIndex`
// isn't a landmark JOINT_REGIONS actually maps to a region, or (NECK only)
// if the drag lands the nose exactly on the shoulder-midpoint x, the same
// facing-direction degeneracy angles.ts's signedNeckFlexion and
// forward-kinematics.ts's applyNeckRotation both already refuse to guess a
// sign for.
export function computeAngleFromDrag(
  landmarks: PoseLandmarks,
  draggedLandmarkIndex: number,
  newPosition: { x: number; y: number; z?: number },
): DragAngleResult {
  const bodyRegion = regionForJoint(draggedLandmarkIndex);
  if (!bodyRegion) {
    throw new Error(
      `Landmark index ${draggedLandmarkIndex} does not control any BodyRegion (see JOINT_REGIONS)`,
    );
  }

  const at = (index: number): PoseLandmark => landmarks[index];
  let rawDegrees: number;

  if (draggedLandmarkIndex === VIRTUAL_CHEST_LANDMARK_INDEX) {
    // TRUNK: the same bilateral-midpoint simplification
    // forward-kinematics.ts's applyTrunkRotation already uses and
    // documents. computeBodyAngles' own TRUNK formula averages two
    // per-side (shoulder, hip, knee) angles, which a single dragged
    // "chest" point can't uniquely invert — moving one point can't tell us
    // how BOTH shoulders individually moved. hipMid/kneeMid stand in for
    // the per-side hip/knee the same way applyTrunkRotation's own pivot
    // does; the dragged point stands in for shoulderMid. Still the exact
    // includedAngle/flexionFrom180 primitives computeBodyAngles calls
    // internally — not a re-derived formula, just different input points.
    const hipMid = midpoint(
      at(LANDMARK_INDEX.LEFT_HIP),
      at(LANDMARK_INDEX.RIGHT_HIP),
    );
    const kneeMid = midpoint(
      at(LANDMARK_INDEX.LEFT_KNEE),
      at(LANDMARK_INDEX.RIGHT_KNEE),
    );
    rawDegrees = flexionFrom180(includedAngle(kneeMid, hipMid, newPosition));
  } else if (draggedLandmarkIndex === LANDMARK_INDEX.NOSE) {
    // NECK: computeBodyAngles' real formula averages two per-side (ear,
    // shoulder, hip) angles and signs the result via signedNeckFlexion,
    // which reads the EAR positions for its magnitude — but JOINT_REGIONS
    // deliberately uses NOSE, not the ears, as NECK's drag handle (the
    // "head proxy," see that table's own comment), and
    // forward-kinematics.ts's applyNeckRotation rotates the whole head
    // cluster (ears included) together around shoulderMid. Leaving the
    // ears fixed while only the nose moves would barely change the
    // reported angle at all — the magnitude comes from the ears, which
    // wouldn't have moved. This instead mirrors applyNeckRotation's own
    // derivation exactly (facingSign * flexion, vertex at shoulderMid,
    // reference ray toward hipMid) — the same shoulderMid/hipMid/nose
    // triple that rotation already treats as authoritative for NECK.
    const shoulderMid = midpoint(
      at(LANDMARK_INDEX.LEFT_SHOULDER),
      at(LANDMARK_INDEX.RIGHT_SHOULDER),
    );
    const hipMid = midpoint(
      at(LANDMARK_INDEX.LEFT_HIP),
      at(LANDMARK_INDEX.RIGHT_HIP),
    );
    const facingSign = Math.sign(newPosition.x - shoulderMid.x);
    if (facingSign === 0) {
      throw new Error(
        "Cannot determine neck flexion sign: dragged nose.x equals shoulder-midpoint x (subject not in profile)",
      );
    }
    const magnitude = flexionFrom180(
      includedAngle(hipMid, shoulderMid, newPosition),
    );
    rawDegrees = magnitude * facingSign;
  } else {
    // SHOULDER/ELBOW/KNEE: the dragged landmark is always the exact
    // vertex computeBodyAngles' own per-side formula uses (matches
    // forward-kinematics.ts's SIMPLE_JOINT_CONFIG.vertex), so rather than
    // re-deriving the formula, this patches ONE landmark into a copy of
    // the array and calls the real, unmodified computeBodyAngles (via
    // computeAllAngles, for the same ungated-for-manual-review reasoning
    // that function documents) — true identity, not just "the same math."
    const patched = landmarks.map((landmark, index) =>
      index === draggedLandmarkIndex
        ? { ...landmark, x: newPosition.x, y: newPosition.y }
        : landmark,
    );
    const degrees = computeAllAngles(patched).get(bodyRegion);
    if (degrees === undefined) {
      throw new Error(
        `Could not compute ${bodyRegion} angle after the drag — a required landmark has insufficient visibility`,
      );
    }
    rawDegrees = degrees;
  }

  const { angleDegrees, clamped } = clampToLimits(bodyRegion, rawDegrees);
  return { bodyRegion, angleDegrees, clamped };
}
