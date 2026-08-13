import type { BodyRegion } from "@/generated/prisma/enums";
import { resolveNeckFacingSign } from "./angles";
import { LANDMARK_INDEX, type SkeletonLandmark } from "./skeleton";

// Pure math — no DOM, no React. Same compliance posture as skeleton.ts
// (visualization-only, ephemeral, never persisted, never feeds scoring):
// this module only ever repositions points for a single rendered frame.
//
// ---------------------------------------------------------------------
// Derivation summary (read this before touching the rotation math below)
// ---------------------------------------------------------------------
// Every region computeBodyAngles reads is an included angle at a vertex V
// between rays toward a `parent` point (proximal, stays fixed for this
// rotation) and a `child` point (distal, gets rotated, along with
// everything further downstream). Rotating `child` around V by an angle φ
// (via the rotation matrix below) changes the SIGNED angle from the
// parent ray to the child ray by exactly +φ — that's what a rotation
// matrix means. Since the reported flexion is a function of that signed
// angle's *magnitude* (and, for TRUNK/ELBOW/KNEE, of 180-minus that
// magnitude — see angles.ts's flexionFrom180), we need:
//
//   1. s0 = the CURRENT signed angle (parent ray → child ray), via
//      atan2(cross, dot) — its sign tells us which rotational direction
//      currently *increases* the magnitude.
//   2. Δincluded = the desired change in the magnitude-only included
//      angle, derived from the caller's Δflexion:
//        - flexion = 180 - included (TRUNK/ELBOW/KNEE): Δincluded = -Δflexion
//        - flexion = included directly (SHOULDER, no 180-flip):
//          Δincluded = +Δflexion
//   3. φ = sign(s0) * Δincluded.
//
// (Full algebra: s1 = sign(s0)*(|s0|+Δincluded), φ = s1 - s0 = sign(s0)*Δincluded,
// since s0 = sign(s0)*|s0|.) This is the exact same sign-then-rotate pattern
// skeleton.ts's clampChildToFlexionRange already uses, reused here rather
// than re-derived differently.
//
// NECK is a special case: its reported value is signedNeckFlexion's own
// signed convention (forward flexion positive, backward extension
// negative — CLAUDE.md), not a plain magnitude. Working through the same
// derivation against signedNeckFlexion's own formula (facingSign, cross
// product) collapses to a remarkably clean result:
//
//   φ = facingSign * Δflexion,   facingSign = resolveNeckFacingSign(...)
//
// — verified both algebraically and against a worked numeric example
// (see forward-kinematics.test.ts). facingSign resolution (and its
// degenerate throw) is shared with angles.ts's signedNeckFlexion via
// resolveNeckFacingSign, not re-derived here — see that function's own
// comment for why it's a trunk-relative cross product rather than a raw
// nose.x-vs-shoulderMid.x comparison (the latter is NOT invariant under
// this very module's own applyTrunkRotation, which was exactly the bug:
// a large enough TRUNK edit could flip facingSign and make the NECK
// slider appear to jump/stick even though NECK's own delta never changed).
//
// Two known limitations of the sign(s0) approach, both inherited from
// TRUNK/SHOULDER/ELBOW/KNEE's magnitude-only angle convention (unlike
// NECK, none of these have a facing-direction signal to disambiguate
// direction) — soft-visualization caveats, not bugs to chase:
//   - Singularity at s0 = 0° or ±180° (parent/vertex/child exactly
//     parallel or anti-parallel — e.g. a perfectly upright trunk, flexion
//     exactly 0°): which rotation direction "increases" the angle is
//     genuinely ambiguous there, and Math.sign()'s answer becomes
//     sensitive to floating-point sign-of-zero in the cross product. Real
//     captured landmarks essentially never land on this exactly.
//   - flexion = 180-included (TRUNK/ELBOW/KNEE) can't go below 0 — it's
//     the same structurally-unsigned convention CLAUDE.md documents for
//     TRUNK's ScoringRule seed (no rows below 0°). Requesting a target
//     more than `currentDegrees` below this floor doesn't error; the
//     rotation swings past the zero-crossing and the recomputed flexion
//     reflects back positive (e.g. asking to go 20° below a 9° lean lands
//     at +11°, not -11°) — geometrically correct given the convention,
//     just not the signed result a caller might expect. Keep adjustments
//     within each region's actual representable range.

type LandmarkName = keyof typeof LANDMARK_INDEX;
type Point2D = { x: number; y: number };

export type AngleAdjustment = {
  bodyRegion: BodyRegion;
  currentDegrees: number;
  targetDegrees: number;
};

// Processing order — parent rotations must cascade to children before a
// child's own rotation is computed, so this is applied regardless of the
// order `adjustments` arrives in (see applyAngleAdjustments' sort below).
// Ties (both SHOULDER_* at 3, etc.) never matter: left/right share no
// landmarks, so their relative order is irrelevant.
const REGION_PRIORITY: Partial<Record<BodyRegion, number>> = {
  TRUNK: 1,
  NECK: 2,
  SHOULDER_LEFT: 3,
  SHOULDER_RIGHT: 3,
  ELBOW_LEFT: 4,
  ELBOW_RIGHT: 4,
  // HIP (Fix 3) must resolve before KNEE: HIP rotates the thigh (hip ->
  // knee), and KNEE's own rotation pivots on THAT knee position — applying
  // KNEE first would rotate the shin around a knee that HIP is about to
  // move out from under it, the same parent-before-child requirement
  // TRUNK/NECK/SHOULDER/ELBOW already follow relative to their own
  // children.
  HIP: 5,
  KNEE_LEFT: 6,
  KNEE_RIGHT: 6,
};

// Every landmark "above the hips" per the TRUNK pivot's own definition —
// both shoulders and everything distal to them (arms, hands), plus every
// head/neck landmark. Deliberately excludes the hips themselves and
// everything at or below them (legs, feet).
const TRUNK_DISTAL: readonly LandmarkName[] = [
  "NOSE",
  "LEFT_EYE_INNER",
  "LEFT_EYE",
  "LEFT_EYE_OUTER",
  "RIGHT_EYE_INNER",
  "RIGHT_EYE",
  "RIGHT_EYE_OUTER",
  "LEFT_EAR",
  "RIGHT_EAR",
  "MOUTH_LEFT",
  "MOUTH_RIGHT",
  "LEFT_SHOULDER",
  "RIGHT_SHOULDER",
  "LEFT_ELBOW",
  "RIGHT_ELBOW",
  "LEFT_WRIST",
  "RIGHT_WRIST",
  "LEFT_PINKY",
  "RIGHT_PINKY",
  "LEFT_INDEX",
  "RIGHT_INDEX",
  "LEFT_THUMB",
  "RIGHT_THUMB",
];

const NECK_DISTAL: readonly LandmarkName[] = [
  "NOSE",
  "LEFT_EYE_INNER",
  "LEFT_EYE",
  "LEFT_EYE_OUTER",
  "RIGHT_EYE_INNER",
  "RIGHT_EYE",
  "RIGHT_EYE_OUTER",
  "LEFT_EAR",
  "RIGHT_EAR",
  "MOUTH_LEFT",
  "MOUTH_RIGHT",
];

// HIP (Fix 3) rotates each leg independently around its OWN real hip
// landmark, unlike TRUNK_DISTAL/NECK_DISTAL above which both rotate around
// one shared virtual midpoint — deliberately different, not an
// inconsistency: the trunk (both shoulders plus everything above them) is
// genuinely one rigid body, so a single shared pivot is correct: but the
// two legs are NOT rigidly connected to each other, only each to its own
// hip. Rotating LEFT_KNEE around a shared hipMid instead of the real
// LEFT_HIP would silently stretch/compress the thigh's own bone length
// (rotating a point around anything other than its true anatomical pivot
// changes its distance from that pivot's counterpart) — applyHipRotation
// below applies the SAME delta to both sides independently instead, which
// still reads as one shared bilateral "hip flexion" value (matching how
// BodyRegion.HIP has no LEFT/RIGHT variant) while preserving both real
// thigh lengths exactly.
const LEFT_HIP_DISTAL: readonly LandmarkName[] = [
  "LEFT_KNEE",
  "LEFT_ANKLE",
  "LEFT_HEEL",
  "LEFT_FOOT_INDEX",
];
const RIGHT_HIP_DISTAL: readonly LandmarkName[] = [
  "RIGHT_KNEE",
  "RIGHT_ANKLE",
  "RIGHT_HEEL",
  "RIGHT_FOOT_INDEX",
];

type SimpleJointRegion =
  | "SHOULDER_LEFT"
  | "SHOULDER_RIGHT"
  | "ELBOW_LEFT"
  | "ELBOW_RIGHT"
  | "KNEE_LEFT"
  | "KNEE_RIGHT";

// vertex = pivot. parent = the fixed-reference ray (proximal, matches
// computeBodyAngles's own `a` argument exactly). referenceChild = the
// distal ray used to measure the CURRENT angle (matches computeBodyAngles's
// own `c` argument) — always the first joint of `distal`, named explicitly
// rather than inferred from array order. usesFlip mirrors whether that
// region's computeBodyAngles formula applies flexionFrom180 (TRUNK/ELBOW/
// KNEE) or reports the raw included angle directly (SHOULDER — "already 0°
// at neutral (arm at side), no 180-minus", per angles.ts's own comment).
const SIMPLE_JOINT_CONFIG: Record<
  SimpleJointRegion,
  {
    vertex: LandmarkName;
    parent: LandmarkName;
    referenceChild: LandmarkName;
    distal: readonly LandmarkName[];
    usesFlip: boolean;
  }
> = {
  SHOULDER_LEFT: {
    vertex: "LEFT_SHOULDER",
    parent: "LEFT_HIP",
    referenceChild: "LEFT_ELBOW",
    distal: [
      "LEFT_ELBOW",
      "LEFT_WRIST",
      "LEFT_PINKY",
      "LEFT_INDEX",
      "LEFT_THUMB",
    ],
    usesFlip: false,
  },
  SHOULDER_RIGHT: {
    vertex: "RIGHT_SHOULDER",
    parent: "RIGHT_HIP",
    referenceChild: "RIGHT_ELBOW",
    distal: [
      "RIGHT_ELBOW",
      "RIGHT_WRIST",
      "RIGHT_PINKY",
      "RIGHT_INDEX",
      "RIGHT_THUMB",
    ],
    usesFlip: false,
  },
  ELBOW_LEFT: {
    vertex: "LEFT_ELBOW",
    parent: "LEFT_SHOULDER",
    referenceChild: "LEFT_WRIST",
    distal: ["LEFT_WRIST", "LEFT_PINKY", "LEFT_INDEX", "LEFT_THUMB"],
    usesFlip: true,
  },
  ELBOW_RIGHT: {
    vertex: "RIGHT_ELBOW",
    parent: "RIGHT_SHOULDER",
    referenceChild: "RIGHT_WRIST",
    distal: ["RIGHT_WRIST", "RIGHT_PINKY", "RIGHT_INDEX", "RIGHT_THUMB"],
    usesFlip: true,
  },
  KNEE_LEFT: {
    vertex: "LEFT_KNEE",
    parent: "LEFT_HIP",
    referenceChild: "LEFT_ANKLE",
    distal: ["LEFT_ANKLE", "LEFT_HEEL", "LEFT_FOOT_INDEX"],
    usesFlip: true,
  },
  KNEE_RIGHT: {
    vertex: "RIGHT_KNEE",
    parent: "RIGHT_HIP",
    referenceChild: "RIGHT_ANKLE",
    distal: ["RIGHT_ANKLE", "RIGHT_HEEL", "RIGHT_FOOT_INDEX"],
    usesFlip: true,
  },
};

function midpoint(a: Point2D, b: Point2D): Point2D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// Signed angle (degrees) from the parent ray to the child ray, at vertex —
// same atan2(cross, dot) convention as skeleton.ts's clampChildToFlexionRange.
function signedAngleDegrees(
  parent: Point2D,
  vertex: Point2D,
  child: Point2D,
): number {
  const vp = { x: parent.x - vertex.x, y: parent.y - vertex.y };
  const vc = { x: child.x - vertex.x, y: child.y - vertex.y };
  return (
    (Math.atan2(vp.x * vc.y - vp.y * vc.x, vp.x * vc.x + vp.y * vc.y) * 180) /
    Math.PI
  );
}

// See the derivation summary at the top of this file. usesFlip selects
// between flexion = 180-included (TRUNK/ELBOW/KNEE) and flexion = included
// directly (SHOULDER).
function rotationForFlexionDelta(
  parent: Point2D,
  vertex: Point2D,
  child: Point2D,
  deltaFlexionDegrees: number,
  usesFlip: boolean,
): number {
  const s0 = signedAngleDegrees(parent, vertex, child);
  const deltaIncluded = usesFlip ? -deltaFlexionDegrees : deltaFlexionDegrees;
  const sign = s0 === 0 ? 1 : Math.sign(s0);
  return sign * deltaIncluded;
}

// The rotation matrix given in the spec — image coordinates (y increases
// downward), applied literally as written.
function rotatePoint(
  point: Point2D,
  pivot: Point2D,
  deltaDegrees: number,
): Point2D {
  const rad = (deltaDegrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = point.x - pivot.x;
  const dy = point.y - pivot.y;
  return {
    x: pivot.x + dx * cos - dy * sin,
    y: pivot.y + dx * sin + dy * cos,
  };
}

// Rotates exactly the named landmarks around `pivot` by `deltaDegrees`,
// returning a new array. Every other landmark is carried over as the same
// object reference (never mutated, never recreated needlessly). A zero
// delta is a true no-op — returns `working` itself, so a 0° adjustment
// never introduces even float-level drift.
function rotateLandmarks(
  working: readonly SkeletonLandmark[],
  names: readonly LandmarkName[],
  pivot: Point2D,
  deltaDegrees: number,
): SkeletonLandmark[] {
  if (deltaDegrees === 0) return working as SkeletonLandmark[];

  const next = [...working];
  for (const name of names) {
    const index = LANDMARK_INDEX[name];
    const landmark = next[index];
    const rotated = rotatePoint(
      { x: landmark.x, y: landmark.y },
      pivot,
      deltaDegrees,
    );
    next[index] = { ...landmark, x: rotated.x, y: rotated.y };
  }
  return next;
}

function applyTrunkRotation(
  working: readonly SkeletonLandmark[],
  deltaFlexionDegrees: number,
): SkeletonLandmark[] {
  const at = (name: LandmarkName) => working[LANDMARK_INDEX[name]];
  // Bilateral midpoints stand in for angles.ts's own per-side-then-average
  // TRUNK formula (vertex=hip, rays to shoulder/knee) — a deliberate
  // simplification for a single rigid-body rotation: one pivot, one angle,
  // rather than reconciling two independently-averaged signed angles.
  const hipMid = midpoint(at("LEFT_HIP"), at("RIGHT_HIP"));
  const kneeMid = midpoint(at("LEFT_KNEE"), at("RIGHT_KNEE"));
  const shoulderMid = midpoint(at("LEFT_SHOULDER"), at("RIGHT_SHOULDER"));

  const phi = rotationForFlexionDelta(
    kneeMid,
    hipMid,
    shoulderMid,
    deltaFlexionDegrees,
    true,
  );
  return rotateLandmarks(working, TRUNK_DISTAL, hipMid, phi);
}

function applyNeckRotation(
  working: readonly SkeletonLandmark[],
  deltaFlexionDegrees: number,
): SkeletonLandmark[] {
  const at = (name: LandmarkName) => working[LANDMARK_INDEX[name]];
  const shoulderMid = midpoint(at("LEFT_SHOULDER"), at("RIGHT_SHOULDER"));
  const hipMid = midpoint(at("LEFT_HIP"), at("RIGHT_HIP"));
  const nose = at("NOSE");

  // resolveNeckFacingSign throws the same degenerate-case error
  // signedNeckFlexion itself does (angles.ts) — a genuine data anomaly
  // (subject facing the camera, not in profile), not a routine condition
  // to guess a direction for. Reading it off shoulderMid/hipMid (rather
  // than a raw nose.x-vs-shoulderMid.x comparison) keeps this rotation's
  // direction stable across a TRUNK edit applied earlier in the same
  // adjustment batch — see this file's derivation-summary comment.
  const facingSign = resolveNeckFacingSign(nose, shoulderMid, hipMid);

  const phi = facingSign * deltaFlexionDegrees;
  return rotateLandmarks(working, NECK_DISTAL, shoulderMid, phi);
}

// HIP (Fix 3): unlike applyTrunkRotation/applyNeckRotation above (one
// shared virtual pivot, one rotation), this rotates each leg around its
// OWN real hip — see LEFT_HIP_DISTAL's own comment for why a shared
// hipMid pivot would be wrong here specifically. Both sides still receive
// the identical deltaFlexionDegrees, so this still reads as one shared
// bilateral HIP value being adjusted, not two independent ones.
//
// No `usesFlip`/180-flip here (matches hipFlexion's own convention,
// angles.ts): flexion = the raw included angle between vertical and the
// hip->knee ray, already 0° at neutral — the same "no 180-minus" case
// SIMPLE_JOINT_CONFIG's own SHOULDER entries are in, just against a
// synthetic vertical point instead of a real parent landmark.
//
// KNOWN COUPLING, not a bug: computeRawBodyAngle's TRUNK formula
// (angles.ts) is 180 - angle(shoulder, hip, knee) — it reads the SAME
// KNEE landmark this function moves. Rotating the knee ray around hip by
// θ changes that included angle by θ regardless of the shoulder ray's own
// direction (a plain property of an included angle between two rays
// sharing a vertex), so any HIP adjustment also shifts TRUNK's own live
// (computeAllAngles) reading — confirmed exactly, not just reasoned
// about, in forward-kinematics.test.ts. This is pre-existing behavior of
// v1's seeded/versioned TRUNK formula (CLAUDE.md's scoring-methodology
// section — not something a UI fix can or should change), just newly
// visible: HIP is the first control able to move the KNEE landmark
// independently of a KNEE_LEFT/RIGHT edit, which only ever rotates the
// shin distal to a FIXED knee vertex. The posture editor's own
// adjustedRegions tracking (posture-editor.ts) only marks the region the
// user actually touched, so TRUNK's row can show this shifted number
// without an "Adjusted" badge explaining why — a known follow-up, not
// solved here.
function applyHipRotation(
  working: readonly SkeletonLandmark[],
  deltaFlexionDegrees: number,
): SkeletonLandmark[] {
  const at = (name: LandmarkName) => working[LANDMARK_INDEX[name]];

  const leftHip = at("LEFT_HIP");
  const leftVertical = { x: leftHip.x, y: leftHip.y + 1 };
  const leftPhi = rotationForFlexionDelta(
    leftVertical,
    leftHip,
    at("LEFT_KNEE"),
    deltaFlexionDegrees,
    false,
  );
  const afterLeft = rotateLandmarks(working, LEFT_HIP_DISTAL, leftHip, leftPhi);

  // Re-reads from `afterLeft`, not `working`: RIGHT_HIP/RIGHT_KNEE are
  // untouched by the left leg's own rotation (LEFT_HIP_DISTAL never
  // includes a RIGHT_* landmark), so this is equivalent to reading from
  // `working` directly — done this way anyway to match rotateLandmarks'
  // own "always operate on the latest working set" convention every other
  // function in this file follows, rather than relying on that disjointness
  // staying true if these lists are ever edited.
  const at2 = (name: LandmarkName) => afterLeft[LANDMARK_INDEX[name]];
  const rightHip = at2("RIGHT_HIP");
  const rightVertical = { x: rightHip.x, y: rightHip.y + 1 };
  const rightPhi = rotationForFlexionDelta(
    rightVertical,
    rightHip,
    at2("RIGHT_KNEE"),
    deltaFlexionDegrees,
    false,
  );
  return rotateLandmarks(afterLeft, RIGHT_HIP_DISTAL, rightHip, rightPhi);
}

function applySimpleJointRotation(
  working: readonly SkeletonLandmark[],
  region: SimpleJointRegion,
  deltaFlexionDegrees: number,
): SkeletonLandmark[] {
  const config = SIMPLE_JOINT_CONFIG[region];
  const at = (name: LandmarkName) => working[LANDMARK_INDEX[name]];
  const vertex = at(config.vertex);
  const parent = at(config.parent);
  const referenceChild = at(config.referenceChild);

  const phi = rotationForFlexionDelta(
    parent,
    vertex,
    referenceChild,
    deltaFlexionDegrees,
    config.usesFlip,
  );
  return rotateLandmarks(working, config.distal, vertex, phi);
}

// Applies a set of BodyRegion angle adjustments to a full landmark set,
// treating the skeleton as a kinematic chain: TRUNK first (pivoting
// everything above the hips), then NECK, then each SHOULDER, then each
// ELBOW, then HIP (pivoting each leg around its own real hip), then each
// KNEE — always in that order regardless of the order `adjustments` is
// passed in, since a child's rotation must be computed against its
// already-parent-rotated position (HIP before KNEE specifically: see
// REGION_PRIORITY's own comment on that pair). Regions this module has no
// FK behavior for (anything outside TRUNK/NECK/SHOULDER_*/ELBOW_*/HIP/
// KNEE_*) are silently skipped, the same "no formula defined for this
// region" treatment computeBodyAngles gives BodyRegion values outside its
// own 8-region ComputedBodyRegion set — not an error, just untouched.
//
// Never mutates `landmarks` or any of its elements — always returns a new
// array, and every individual updated landmark is a new object too.
export function applyAngleAdjustments(
  landmarks: SkeletonLandmark[],
  adjustments: AngleAdjustment[],
): SkeletonLandmark[] {
  const supported = adjustments.filter(
    (adjustment) => REGION_PRIORITY[adjustment.bodyRegion] !== undefined,
  );
  const sorted = [...supported].sort(
    (a, b) =>
      (REGION_PRIORITY[a.bodyRegion] as number) -
      (REGION_PRIORITY[b.bodyRegion] as number),
  );

  let working: SkeletonLandmark[] = landmarks.map((landmark) => ({
    ...landmark,
  }));

  for (const adjustment of sorted) {
    const deltaFlexionDegrees =
      adjustment.targetDegrees - adjustment.currentDegrees;
    if (deltaFlexionDegrees === 0) continue;

    switch (adjustment.bodyRegion) {
      case "TRUNK":
        working = applyTrunkRotation(working, deltaFlexionDegrees);
        break;
      case "NECK":
        working = applyNeckRotation(working, deltaFlexionDegrees);
        break;
      case "HIP":
        working = applyHipRotation(working, deltaFlexionDegrees);
        break;
      case "SHOULDER_LEFT":
      case "SHOULDER_RIGHT":
      case "ELBOW_LEFT":
      case "ELBOW_RIGHT":
      case "KNEE_LEFT":
      case "KNEE_RIGHT":
        working = applySimpleJointRotation(
          working,
          adjustment.bodyRegion,
          deltaFlexionDegrees,
        );
        break;
      default:
        break;
    }
  }

  return working;
}
