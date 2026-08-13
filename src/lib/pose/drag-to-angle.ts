import { BodyRegion } from "@/generated/prisma/enums";
import {
  type ComputedBodyRegion,
  computeRawBodyAngle,
  flexionFrom180,
  hipFlexion,
  includedAngle,
  LANDMARK_INDEX,
  type PoseLandmark,
  type PoseLandmarks,
  resolveNeckFacingSign,
} from "./angles";
import {
  ANATOMICAL_LIMITS,
  regionForDraggableLandmark,
  VIRTUAL_CHEST_LANDMARK_INDEX,
  VIRTUAL_KNEE_LANDMARK_INDEX,
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

// The same 8 regions computeBodyAngles produces a reading for — the only
// ones computeRawBodyAngle has a formula for at all.
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

// Given a complete set of (possibly user-adjusted) landmarks, computes
// every one of the 8 ComputedBodyRegion angles directly via
// computeRawBodyAngle, plus HIP (via hipFlexion — see that function's own
// comment for why it's kept separate from the other 8) — bypassing BOTH of
// computeBodyAngles' gates (camera-angle AND visibility), not just the
// camera-angle one an earlier version of this function's own comment
// described.
//
// Camera-angle: a human reviewing the rendered skeleton (or actively
// dragging a joint on it) is already making the "is this a usable view"
// judgment visually; re-applying that gate here would only hide a real,
// visible angle from the editor.
//
// Visibility: an EARLIER version of this function kept this gate,
// reasoning that "a landmark that genuinely wasn't observed still can't
// produce a real angle no matter who's reviewing it." That reasoning
// predates completeMissingLandmarks' own completeness guarantee
// (skeleton.ts) — every landmark this function ever sees now has a real,
// on-screen, human-judgeable position (original, extrapolated, or a
// documented last-resort fallback), never a true absence. Keeping the
// visibility gate here on TOP of that meant a region whose reference
// landmark (e.g. a low-visibility hip) the reviewer can plainly SEE on
// screen could never actually be dragged or typed into — every attempt
// silently failed as a spurious no-op in posture-editor.ts's
// applyResolvedAngle (its `?? targetDegrees` fallback for "no current
// value" compared the new target against itself), which is what made
// TRUNK/SHOULDER/KNEE effectively permanently stuck on any capture with a
// low-visibility hip — confirmed directly, not just reasoned about (see
// this function's own test file). The scoring pipeline's own gate
// (computeBodyAngles, called from POST /api/posture-samples and
// validatePostureSample) is completely unaffected — this function has
// never been part of that path.
//
// NECK can still throw here (computeRawBodyAngle's own facing-direction
// degeneracy, signedNeckFlexion) — a genuine data anomaly, not a gate,
// and already true before this change whenever NECK's visibility gate
// happened to pass.
export function computeAllAngles(
  landmarks: PoseLandmarks,
): Map<BodyRegion, number> {
  const result = new Map<BodyRegion, number>();
  for (const region of COMPUTED_REGIONS) {
    result.set(region, computeRawBodyAngle(region, landmarks));
  }
  // HIP (Fix 3, SLD_SKELETON_FIXES.md): not one of computeRawBodyAngle's 8
  // ComputedBodyRegion values — deliberately kept out of that type, since
  // it has no seeded ScoringRule yet and no place in the persisted
  // capture-scoring pipeline (see hipFlexion's own comment in angles.ts).
  // Computed here directly instead, the same bilateral left/right average
  // computeRawBodyAngle's own TRUNK/NECK cases use.
  const at = (index: number): PoseLandmark => landmarks[index];
  result.set(
    BodyRegion.HIP,
    (hipFlexion(at(LANDMARK_INDEX.LEFT_HIP), at(LANDMARK_INDEX.LEFT_KNEE)) +
      hipFlexion(at(LANDMARK_INDEX.RIGHT_HIP), at(LANDMARK_INDEX.RIGHT_KNEE))) /
      2,
  );
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
// draggable landmark (JOINT_REGIONS, or a PROXY_JOINT_REGIONS proxy —
// Fix 4, SLD_SKELETON_FIXES.md), computes the resulting angle for the
// BodyRegion it controls — the value a caller feeds back into
// applyAngleAdjustments as `targetDegrees`. Throws if `draggedLandmarkIndex`
// isn't a landmark regionForDraggableLandmark actually maps to a region, or
// (NECK only) if the drag lands the nose exactly on the shoulder-midpoint
// x, the same facing-direction degeneracy angles.ts's signedNeckFlexion and
// forward-kinematics.ts's applyNeckRotation both already refuse to guess a
// sign for.
//
// A proxy drag needs no extra branch below: the SHOULDER/ELBOW/KNEE `else`
// branch already patches ONLY `draggedLandmarkIndex` into a copy of
// `landmarks` and recomputes the region's whole formula from that copy —
// so dragging LEFT_WRIST (which resolves to "ELBOW_LEFT" via
// PROXY_JOINT_REGIONS) patches the WRIST position while LEFT_ELBOW and
// LEFT_SHOULDER are read fresh from the real, un-patched array, which is
// exactly "vertex and parent stay fixed, only the dragged point moves" —
// the same vertex-preserving behavior a direct ELBOW drag already has,
// just with a different landmark playing the child role.
export function computeAngleFromDrag(
  landmarks: PoseLandmarks,
  draggedLandmarkIndex: number,
  newPosition: { x: number; y: number; z?: number },
): DragAngleResult {
  const bodyRegion = regionForDraggableLandmark(draggedLandmarkIndex);
  if (!bodyRegion) {
    throw new Error(
      `Landmark index ${draggedLandmarkIndex} does not control any BodyRegion (see JOINT_REGIONS/PROXY_JOINT_REGIONS)`,
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
    // resolveNeckFacingSign (angles.ts) rather than a raw
    // newPosition.x-vs-shoulderMid.x comparison — that raw form is the
    // same one that used to make applyNeckRotation's rotation direction
    // (forward-kinematics.ts) unstable across a TRUNK edit; using the
    // identical trunk-relative resolution here keeps a direct nose drag
    // consistent with every other NECK-sign call site.
    const facingSign = resolveNeckFacingSign(newPosition, shoulderMid, hipMid);
    const magnitude = flexionFrom180(
      includedAngle(hipMid, shoulderMid, newPosition),
    );
    rawDegrees = magnitude * facingSign;
  } else if (draggedLandmarkIndex === VIRTUAL_KNEE_LANDMARK_INDEX) {
    // HIP (Fix 3): the same bilateral-midpoint simplification as TRUNK's
    // chest-drag branch above, but mirrored — here the dragged point
    // stands in for kneeMid (the moving, distal end of the segment), while
    // hipMid is the fixed vertex a real hipFlexion(hip, knee) call would
    // also use unmoved. hipFlexion itself can't be reused directly (it
    // takes two real Point2D arguments, not "vertex fixed, everything else
    // patched in"), but it's still the exact same includedAngle-against-
    // true-vertical geometry, just inlined against `newPosition` instead
    // of a real knee landmark — see that function's own comment (angles.ts)
    // for why vertical, not another landmark, is the reference here.
    const hipMid = midpoint(
      at(LANDMARK_INDEX.LEFT_HIP),
      at(LANDMARK_INDEX.RIGHT_HIP),
    );
    const verticalReference = { x: hipMid.x, y: hipMid.y + 1 };
    rawDegrees = includedAngle(verticalReference, hipMid, newPosition);
  } else {
    // SHOULDER/ELBOW/KNEE: the dragged landmark is either the exact
    // vertex computeBodyAngles' own per-side formula uses (matches
    // forward-kinematics.ts's SIMPLE_JOINT_CONFIG.vertex — a direct
    // SHOULDER/ELBOW/KNEE drag) or a PROXY_JOINT_REGIONS proxy for it
    // (Fix 4 — a WRIST/ANKLE drag, playing that same formula's CHILD
    // role instead, with the real vertex read unpatched below). Either
    // way, rather than re-deriving the formula, this patches ONE landmark
    // into a copy of the array and calls computeRawBodyAngle directly for
    // just this one region — true identity with computeBodyAngles' own
    // geometry (same function, both call it), not just "the same math."
    // Deliberately NOT computeAllAngles(patched).get(bodyRegion): that
    // would compute all 8 regions to read just one, and NECK's own
    // facing-direction degeneracy could then throw while we only actually
    // needed (say) ELBOW_LEFT — an unrelated region's edge case failing a
    // drag that has nothing to do with it.
    const patched = landmarks.map((landmark, index) =>
      index === draggedLandmarkIndex
        ? { ...landmark, x: newPosition.x, y: newPosition.y }
        : landmark,
    );
    // bodyRegion is provably one of the 6 SHOULDER/ELBOW/KNEE values here
    // (TRUNK, NECK, and HIP were already handled in the branches above),
    // all of which are valid ComputedBodyRegion values — computeRawBodyAngle's
    // parameter type just can't see that from this function's own control
    // flow.
    rawDegrees = computeRawBodyAngle(bodyRegion as ComputedBodyRegion, patched);
  }

  const { angleDegrees, clamped } = clampToLimits(bodyRegion, rawDegrees);
  return { bodyRegion, angleDegrees, clamped };
}
