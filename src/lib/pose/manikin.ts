import type { BodyRegion } from "@/generated/prisma/enums";
import type { PoseLandmark, PoseLandmarks } from "./angles";
import { LANDMARK_INDEX } from "./skeleton";

// Pure math — no DOM, no React, no three.js scene objects (this module
// doesn't even import "three"; its output is plain {x,y,z} data in the
// same coordinate convention angles.ts's PoseLandmark uses, not scene-unit
// Vector3s — see the coordinate-convention comment below for why). No
// notion of a PostureSample, visibility, or confidence: this module never
// reads one, never writes one, and has nothing resembling
// SkeletonLandmark's `confidence`/`original` fields. See
// SLD_POSTURE_EDITOR_FIDELITY_PLAN.md P2.
//
// COMPLIANCE NOTE — this STRENGTHENS ERGO_COMPLIANCE_BY_DESIGN.md §3.2, it
// doesn't merely comply with it. Every position this module returns comes
// from FIXED, generic anthropometric ratios (below) and the caller's own 8
// joint angles alone — it never reads a captured landmark's own position,
// so the rendered figure isn't just "visualization only" the way the rest
// of src/lib/pose/** already is (skeleton.ts's own compliance note) — it
// is literally not subject-specific. Two different people, captured at the
// identical posture (the same 8 angles), render pixel-identical manikins.
//
// RATIO SOURCE: Drillis & Contini (1966) segment-length/breadth-as-
// fraction-of-stature ratios — public-domain biomechanics textbook values,
// the same anthropometric family DIN 33402-2 / ISO 7250 (50th percentile)
// draw from. This is a SEPARATE table from skeleton.ts's own
// SEGMENT_RATIO_OF_STATURE, deliberately not imported from there even
// though the values overlap: that table exists to gap-fill a REAL
// capture's own missing landmarks (a different purpose — see skeleton.ts's
// module comment and the fidelity plan's invariant §2.3, "do not unify the
// two renderers") and must stay decoupled from this module's concerns, and
// vice versa.
const RATIO_OF_STATURE = {
  TORSO: 0.288, // hip midpoint to shoulder midpoint
  HEAD_ABOVE_SHOULDER: 0.182, // shoulder midpoint to head/neck endpoint (nose)
  UPPER_ARM: 0.186,
  FOREARM: 0.146,
  UPPER_LEG: 0.245,
  LOWER_LEG: 0.233,
  SHOULDER_WIDTH: 0.259, // biacromial breadth
  HIP_WIDTH: 0.191, // bi-iliac (hip) breadth
} as const;

// A stature in the SAME pre-scale units landmarksTo3DPositions expects
// (skeleton.ts): that function's own doc comment notes a real captured,
// well-framed standing figure has a normalized vertical extent of roughly
// 0.85 before its ×THREE_D_SCALE(2) scaling, landing at ~1.7 scene units
// tall. Using that same 0.85 here — not 1.7, and not MediaPipe's [0,1]
// frame-normalized range, which has no meaning for a synthetic figure that
// was never photographed — means a manikin fed through that same
// projection renders at the same familiar ~1.7-scene-unit size real
// captures do, purely as a rendering-scale choice, not an anthropometric
// claim about "the" average stature.
const STATURE = 0.85;

// ---------------------------------------------------------------------
// Coordinate convention — chosen to match angles.ts's PoseLandmark exactly
// (x, y in MediaPipe's image-space sense: y increasing DOWNWARD), so this
// module's output can be fed unmodified into the same functions a real
// capture's landmarks already go through: computeAngleFromDrag/
// computeRawBodyAngle (drag-to-angle.ts/angles.ts, which read only x and y
// — CLAUDE.md/angles.ts's own note: "z never feeds scoring geometry") and
// skeleton.ts's own landmarksTo3DPositions for the final 3D projection.
//
//   x — the sagittal (front-to-back) axis. Every flexion this module
//       places (TRUNK, NECK, SHOULDER, ELBOW, KNEE) bends within the X-Y
//       plane, exactly like a captured SAGITTAL-camera profile view —
//       increasing x is this manikin's own "forward" (an arbitrary but
//       internally consistent choice; CLAUDE.md itself notes SHOULDER's
//       formula can't tell forward-raise from lateral-raise apart, so
//       there is no scoring fact this needs to match).
//   y — vertical, DOWN-positive (image convention) — smaller y is higher.
//   z — lateral (left-right body width: shoulder/hip breadth). Never
//       touched by any flexion below, exactly because none of the 8
//       tracked regions are lateral-bend angles — it's carried through
//       unchanged from each landmark's own side offset.
// ---------------------------------------------------------------------

// direction(angle): a unit step in the X-Y (sagittal) plane. 0° points
// toward smaller y ("up" — e.g. the torso's own hip-to-shoulder direction
// when upright); 180° points toward larger y ("down" — e.g. a leg hanging
// from the hip); positive angles rotate toward +x.
function direction(angleFromUpDeg: number): { dx: number; dy: number } {
  const rad = (angleFromUpDeg * Math.PI) / 180;
  return { dx: Math.sin(rad), dy: -Math.cos(rad) };
}

// Places a point `length` away from `origin`, in the direction `angle`
// names — z is carried over from `origin` unchanged (see the coordinate
// convention above: nothing in this module ever moves a point laterally).
function step(
  origin: PoseLandmark,
  angleFromUpDeg: number,
  length: number,
): PoseLandmark {
  const { dx, dy } = direction(angleFromUpDeg);
  return { x: origin.x + dx * length, y: origin.y + dy * length, z: origin.z };
}

function lateral(origin: PoseLandmark, offset: number): PoseLandmark {
  return { x: origin.x, y: origin.y, z: origin.z + offset };
}

type ManikinAngleRegion =
  | "TRUNK"
  | "NECK"
  | "HIP"
  | "SHOULDER_LEFT"
  | "SHOULDER_RIGHT"
  | "ELBOW_LEFT"
  | "ELBOW_RIGHT"
  | "KNEE_LEFT"
  | "KNEE_RIGHT";

// Missing regions default to neutral (0°) rather than throwing — a
// rendering fallback, not a claim that every caller must always supply
// all 8 (computeAllAngles always does today, but this module has no way to
// enforce that and shouldn't need to).
function angleOrNeutral(
  angles: ReadonlyMap<BodyRegion, number>,
  region: ManikinAngleRegion,
): number {
  return angles.get(region) ?? 0;
}

// Given the 8 scored joint angles plus HIP (Fix 3, SLD_SKELETON_FIXES.md —
// flexion-from-neutral degrees, the exact convention CLAUDE.md mandates
// for computeBodyAngles/hipFlexion — read directly, no unit conversion),
// returns a full 33-point manikin pose — one
// PoseLandmark per MediaPipe landmark index (skeleton.ts's LANDMARK_INDEX)
// — built entirely from fixed anthropometric proportions (RATIO_OF_STATURE
// above), never from any captured landmark's own position. Angles in,
// positions out — this function reads nothing else and has no other
// output.
//
// Landmarks with no angle of their own (eyes, ears, mouth, fingers, heel,
// foot-index) are placed crudely at their nearest functional neighbor
// (the head anchor, or the wrist/ankle) — a zero-length decorative point,
// the same "crude last resort, not a claim about real geometry" pattern
// completeMissingLandmarks' own FACE_CLUSTER/FOOT_CLUSTER fallback passes
// already establish in skeleton.ts. P3 replaces all of these with solid,
// rigid, non-interactive head/hand/foot geometry anyway.
export function buildManikinPose(
  angles: ReadonlyMap<BodyRegion, number>,
): PoseLandmarks {
  const trunk = angleOrNeutral(angles, "TRUNK");
  const neck = angleOrNeutral(angles, "NECK");
  // Bilateral, like `trunk`/`neck` above — BodyRegion.HIP has no LEFT/
  // RIGHT variant, so both legs read this same single value (matching
  // applyHipRotation's own "same delta, both sides independently" model —
  // forward-kinematics.ts).
  const hipFlexionAngle = angleOrNeutral(angles, "HIP");

  const positions = new Array<PoseLandmark>(33);
  const set = (name: keyof typeof LANDMARK_INDEX, point: PoseLandmark) => {
    positions[LANDMARK_INDEX[name]] = point;
  };

  const hipMid: PoseLandmark = { x: 0, y: 0, z: 0 };
  // TRUNK's own formula (angles.ts: flexion = 180 - angle(shoulder, hip,
  // knee)) reads 0° exactly when the shoulder-hip-knee chain is straight —
  // i.e. when the upper legs (vertical below at hipFlexionAngle=0, see the
  // per-side loop's own Fix 3 comment) and the torso are collinear. Using
  // `trunk` directly as the torso's "degrees from straight up" is what
  // makes that hold here too, for the default/neutral-HIP case — a
  // nonzero HIP value breaks that collinearity on purpose (see
  // upperLegAngle's own comment on the resulting, real TRUNK coupling).
  const torsoAngle = trunk;
  const shoulderMid = step(
    hipMid,
    torsoAngle,
    RATIO_OF_STATURE.TORSO * STATURE,
  );
  const headAngle = torsoAngle + neck;
  const nose = step(
    shoulderMid,
    headAngle,
    RATIO_OF_STATURE.HEAD_ABOVE_SHOULDER * STATURE,
  );
  // Known, accepted interaction, not a bug in this module: dragging the
  // manikin's own NECK handle resolves through computeAngleFromDrag's NOSE
  // branch (drag-to-angle.ts), which reads its facing sign from the
  // dragged nose's ABSOLUTE x position relative to shoulderMid — a
  // heuristic that assumes a roughly-upright trunk. Because `headAngle`
  // above is chained relative to `torsoAngle`, an extreme TRUNK value
  // combined with a NECK value near its opposite sign (e.g. TRUNK close to
  // its 90° max together with NECK near its -20° min) can push that
  // absolute heuristic to misread the sign. The heuristic itself lives in
  // drag-to-angle.ts and is out of this module's scope to redesign — see
  // manikin.test.ts's own NECK round-trip test for why it deliberately
  // uses realistic, not maximally-extreme, combined values.

  set("NOSE", nose);
  for (const name of [
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
  ] as const) {
    set(name, nose);
  }

  const halfHipWidth = (RATIO_OF_STATURE.HIP_WIDTH * STATURE) / 2;
  const leftHip = lateral(hipMid, -halfHipWidth);
  const rightHip = lateral(hipMid, halfHipWidth);
  set("LEFT_HIP", leftHip);
  set("RIGHT_HIP", rightHip);

  const halfShoulderWidth = (RATIO_OF_STATURE.SHOULDER_WIDTH * STATURE) / 2;
  const leftShoulder = lateral(shoulderMid, -halfShoulderWidth);
  const rightShoulder = lateral(shoulderMid, halfShoulderWidth);
  set("LEFT_SHOULDER", leftShoulder);
  set("RIGHT_SHOULDER", rightShoulder);

  for (const side of ["LEFT", "RIGHT"] as const) {
    const shoulder = side === "LEFT" ? leftShoulder : rightShoulder;
    const hip = side === "LEFT" ? leftHip : rightHip;
    const shoulderFlexion = angleOrNeutral(angles, `SHOULDER_${side}`);
    const elbowFlexion = angleOrNeutral(angles, `ELBOW_${side}`);
    const kneeFlexion = angleOrNeutral(angles, `KNEE_${side}`);

    // Upper arm: hangs straight down along the torso's own axis at
    // shoulderFlexion=0 (matching computeBodyAngles' own reference — its
    // SHOULDER formula is angle(hip, shoulder, elbow), which reads 0°
    // exactly when the elbow continues the hip->shoulder line), swinging
    // forward as flexion increases: 90° lands the upper arm horizontal,
    // 180° (ANATOMICAL_LIMITS' own max) lands it fully overhead.
    const upperArmAngle = torsoAngle + 180 - shoulderFlexion;
    const elbow = step(
      shoulder,
      upperArmAngle,
      RATIO_OF_STATURE.UPPER_ARM * STATURE,
    );
    // Forearm: continues straight from the upper arm at elbowFlexion=0 (a
    // straight arm), curling back toward the upper arm's own direction as
    // flexion increases (a bicep-curl look). Unlike TRUNK/SHOULDER/KNEE,
    // there's no captured-data convention this needs to match — it only
    // needs to be monotonic and land exactly "straight" at 0°, which this
    // is regardless of the sign chosen here.
    const forearmAngle = upperArmAngle - elbowFlexion;
    const wrist = step(elbow, forearmAngle, RATIO_OF_STATURE.FOREARM * STATURE);

    set(`${side}_ELBOW`, elbow);
    set(`${side}_WRIST`, wrist);
    for (const name of ["PINKY", "INDEX", "THUMB"] as const) {
      set(`${side}_${name}`, wrist);
    }

    // Upper leg (Fix 3): hangs straight down (180°, hipFlexionAngle's own
    // 0°-at-neutral reference) at rest, swinging forward toward horizontal
    // as HIP flexion increases — the same "180-minus-flexion-from-a-
    // hang-down-reference" relationship upperArmAngle has to
    // shoulderFlexion above. Deliberately NOT chained through torsoAngle
    // the way upperArmAngle is: hipFlexion (angles.ts) is measured against
    // true vertical, independent of trunk lean, by design (see that
    // function's own comment for why) — chaining this through torsoAngle
    // would silently reintroduce exactly the trunk-coupling HIP exists to
    // avoid. TRUNK's own formula still reads this segment (shoulder-hip-
    // knee — see torsoAngle's own comment above), so a nonzero HIP value
    // here changes what TRUNK itself reports too — the same real coupling
    // forward-kinematics.ts's applyHipRotation documents, not a bug.
    const upperLegAngle = 180 - hipFlexionAngle;
    const knee = step(hip, upperLegAngle, RATIO_OF_STATURE.UPPER_LEG * STATURE);
    // Shank: bends backward (away from the +x "forward" direction TRUNK/
    // NECK/SHOULDER/ELBOW all bend toward) as flexion increases from the
    // straight-leg 0° reference — a knee is anatomically one-directional,
    // unlike the others.
    const shankAngle = 180 + kneeFlexion;
    const ankle = step(knee, shankAngle, RATIO_OF_STATURE.LOWER_LEG * STATURE);

    set(`${side}_KNEE`, knee);
    set(`${side}_ANKLE`, ankle);
    set(`${side}_HEEL`, ankle);
    set(`${side}_FOOT_INDEX`, ankle);
  }

  return positions;
}
