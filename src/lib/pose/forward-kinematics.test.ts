import { describe, expect, it } from "vitest";
import { computeAllAngles } from "./drag-to-angle";
import {
  type AngleAdjustment,
  applyAngleAdjustments,
} from "./forward-kinematics";
import { LANDMARK_INDEX, type SkeletonLandmark } from "./skeleton";

// Same makeSkeleton-style builder as skeleton.test.ts, but producing full
// SkeletonLandmark objects directly (applyAngleAdjustments takes the
// post-completeMissingLandmarks shape, not raw PoseLandmarks) — named-index
// overrides for the joints a test cares about, everything else defaulted
// to a plausible, fully-measured placeholder.
function makeSkeleton(
  overrides: Partial<
    Record<keyof typeof LANDMARK_INDEX, { x: number; y: number }>
  >,
): SkeletonLandmark[] {
  const points: SkeletonLandmark[] = Array.from({ length: 33 }, (_, index) => ({
    index,
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 1,
    confidence: "measured" as const,
    original: { x: 0.5, y: 0.5, z: 0, visibility: 1 },
  }));
  for (const [name, point] of Object.entries(overrides)) {
    if (!point) continue;
    const index = LANDMARK_INDEX[name as keyof typeof LANDMARK_INDEX];
    points[index] = {
      index,
      x: point.x,
      y: point.y,
      z: 0,
      visibility: 1,
      confidence: "measured",
      original: { x: point.x, y: point.y, z: 0, visibility: 1 },
    };
  }
  return points;
}

// Straight, upright torso: hip directly below shoulder, knee directly
// below hip — TRUNK flexion is exactly 0° in this pose (shoulder-hip-knee
// included angle is 180°). Used as the base fixture for every TRUNK test
// that doesn't care about rotation *direction* (identity, which landmarks
// moved, round-tripping, sort order, mutation).
const UPRIGHT_TORSO = {
  LEFT_SHOULDER: { x: 0.5, y: 0.3 },
  RIGHT_SHOULDER: { x: 0.5, y: 0.3 },
  LEFT_HIP: { x: 0.5, y: 0.6 },
  RIGHT_HIP: { x: 0.5, y: 0.6 },
  LEFT_KNEE: { x: 0.5, y: 0.9 },
  RIGHT_KNEE: { x: 0.5, y: 0.9 },
} as const;

// A pronounced forward lean (~40° flexion), deliberately NOT perfectly
// vertical and NOT near the 0° floor. Direction-sensitive tests (which way
// does a positive vs. negative Δθ rotate) need this instead of
// UPRIGHT_TORSO, for two reasons:
//   1. At *exactly* 0° flexion, the shoulder-hip-knee ray pair is
//      perfectly anti-parallel, and the sign of the (near-zero) cross
//      product used to determine rotation direction becomes sensitive to
//      floating-point sign-of-zero — a genuine geometric singularity
//      (both rotation directions are locally equally valid there), not a
//      module bug. Real captured landmarks essentially never land on that
//      exact singularity.
//   2. flexionFrom180 (angles.ts, mirrored by trunkFlexionDegrees below)
//      is structurally unsigned — flexion can never go below 0, the same
//      "no negative flexion representable" fact CLAUDE.md documents for
//      TRUNK's seeded ScoringRule (no rows below 0°). A target below the
//      current lean by more than the lean itself asks for an
//      unrepresentable negative flexion; ~40° of starting lean gives every
//      ±20° test here comfortable headroom above that floor.
const LEAN_TORSO = {
  LEFT_SHOULDER: { x: 0.75, y: 0.3 },
  RIGHT_SHOULDER: { x: 0.75, y: 0.3 },
  LEFT_HIP: { x: 0.5, y: 0.6 },
  RIGHT_HIP: { x: 0.5, y: 0.6 },
  LEFT_KNEE: { x: 0.5, y: 0.9 },
  RIGHT_KNEE: { x: 0.5, y: 0.9 },
} as const;

function midpointForTest(
  a: { x: number; y: number },
  b: { x: number; y: number },
) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function distanceForTest(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function includedAngleDegreesForTest(
  a: { x: number; y: number },
  vertex: { x: number; y: number },
  c: { x: number; y: number },
): number {
  const va = { x: a.x - vertex.x, y: a.y - vertex.y };
  const vc = { x: c.x - vertex.x, y: c.y - vertex.y };
  const magnitude = Math.hypot(va.x, va.y) * Math.hypot(vc.x, vc.y);
  const cos = Math.min(
    1,
    Math.max(-1, (va.x * vc.x + va.y * vc.y) / magnitude),
  );
  return (Math.acos(cos) * 180) / Math.PI;
}

// Independently reproduces angles.ts's TRUNK formula (vertex=hip, rays to
// knee/shoulder, flexion=180-included), using bilateral midpoints — the
// same simplification forward-kinematics.ts itself uses — so results can
// be verified against the actual recomputed angle rather than a
// hand-derived coordinate (error-prone, as the original version of this
// test file demonstrated).
function trunkFlexionDegrees(landmarks: SkeletonLandmark[]): number {
  const hipMid = midpointForTest(
    landmarks[LANDMARK_INDEX.LEFT_HIP],
    landmarks[LANDMARK_INDEX.RIGHT_HIP],
  );
  const kneeMid = midpointForTest(
    landmarks[LANDMARK_INDEX.LEFT_KNEE],
    landmarks[LANDMARK_INDEX.RIGHT_KNEE],
  );
  const shoulderMid = midpointForTest(
    landmarks[LANDMARK_INDEX.LEFT_SHOULDER],
    landmarks[LANDMARK_INDEX.RIGHT_SHOULDER],
  );
  return 180 - includedAngleDegreesForTest(kneeMid, hipMid, shoulderMid);
}

describe("applyAngleAdjustments", () => {
  it("0° delta is an identity — output values equal input values", () => {
    const landmarks = makeSkeleton({
      ...UPRIGHT_TORSO,
      LEFT_ELBOW: { x: 0.4, y: 0.4 },
    });
    const adjustments: AngleAdjustment[] = [
      { bodyRegion: "TRUNK", currentDegrees: 0, targetDegrees: 0 },
    ];
    const result = applyAngleAdjustments(landmarks, adjustments);

    expect(result).not.toBe(landmarks); // always a new array
    for (let i = 0; i < landmarks.length; i++) {
      expect(result[i].x).toBeCloseTo(landmarks[i].x, 10);
      expect(result[i].y).toBeCloseTo(landmarks[i].y, 10);
    }
  });

  it("TRUNK rotation cascades to shoulder positions but not to hip positions", () => {
    const landmarks = makeSkeleton(UPRIGHT_TORSO);
    const result = applyAngleAdjustments(landmarks, [
      { bodyRegion: "TRUNK", currentDegrees: 0, targetDegrees: 30 },
    ]);

    // Hips are the pivot — untouched exactly.
    expect(result[LANDMARK_INDEX.LEFT_HIP].x).toBeCloseTo(0.5, 10);
    expect(result[LANDMARK_INDEX.LEFT_HIP].y).toBeCloseTo(0.6, 10);
    expect(result[LANDMARK_INDEX.RIGHT_HIP].x).toBeCloseTo(0.5, 10);
    expect(result[LANDMARK_INDEX.RIGHT_HIP].y).toBeCloseTo(0.6, 10);

    // Shoulders moved.
    const shoulder = result[LANDMARK_INDEX.LEFT_SHOULDER];
    expect(shoulder.x).not.toBeCloseTo(0.5, 5);
  });

  it("TRUNK rotation produces exactly the target flexion angle (independently recomputed)", () => {
    const landmarks = makeSkeleton(LEAN_TORSO);
    const currentFlexion = trunkFlexionDegrees(landmarks);
    const targetFlexion = currentFlexion + 30;

    const result = applyAngleAdjustments(landmarks, [
      {
        bodyRegion: "TRUNK",
        currentDegrees: currentFlexion,
        targetDegrees: targetFlexion,
      },
    ]);

    expect(trunkFlexionDegrees(result)).toBeCloseTo(targetFlexion, 6);
  });

  it("negative Δθ rotates in the opposite direction from positive Δθ", () => {
    const landmarks = makeSkeleton(LEAN_TORSO);
    const currentFlexion = trunkFlexionDegrees(landmarks);

    const positive = applyAngleAdjustments(landmarks, [
      {
        bodyRegion: "TRUNK",
        currentDegrees: currentFlexion,
        targetDegrees: currentFlexion + 20,
      },
    ]);
    const negative = applyAngleAdjustments(landmarks, [
      {
        bodyRegion: "TRUNK",
        currentDegrees: currentFlexion,
        targetDegrees: currentFlexion - 20,
      },
    ]);

    // Both directions land exactly on their own target...
    expect(trunkFlexionDegrees(positive)).toBeCloseTo(currentFlexion + 20, 6);
    expect(trunkFlexionDegrees(negative)).toBeCloseTo(currentFlexion - 20, 6);

    // ...via genuinely different rotations, not the same displacement twice.
    const posShoulder = positive[LANDMARK_INDEX.LEFT_SHOULDER];
    const negShoulder = negative[LANDMARK_INDEX.LEFT_SHOULDER];
    expect(posShoulder.x).not.toBeCloseTo(negShoulder.x, 3);
  });

  it("round-trips: applying +Δ then -Δ returns to the original position", () => {
    const landmarks = makeSkeleton(UPRIGHT_TORSO);
    const rotated = applyAngleAdjustments(landmarks, [
      { bodyRegion: "TRUNK", currentDegrees: 0, targetDegrees: 40 },
    ]);
    const rotatedBack = applyAngleAdjustments(rotated, [
      { bodyRegion: "TRUNK", currentDegrees: 40, targetDegrees: 0 },
    ]);

    expect(rotatedBack[LANDMARK_INDEX.LEFT_SHOULDER].x).toBeCloseTo(0.5, 6);
    expect(rotatedBack[LANDMARK_INDEX.LEFT_SHOULDER].y).toBeCloseTo(0.3, 6);
  });

  it("SHOULDER rotation moves the elbow/wrist but not the shoulder or hip", () => {
    const landmarks = makeSkeleton({
      ...UPRIGHT_TORSO,
      LEFT_ELBOW: { x: 0.5, y: 0.45 }, // arm hanging straight down (neutral, 0°)
      LEFT_WRIST: { x: 0.5, y: 0.55 },
    });
    const result = applyAngleAdjustments(landmarks, [
      { bodyRegion: "SHOULDER_LEFT", currentDegrees: 0, targetDegrees: 45 },
    ]);

    expect(result[LANDMARK_INDEX.LEFT_SHOULDER].x).toBeCloseTo(0.5, 10);
    expect(result[LANDMARK_INDEX.LEFT_SHOULDER].y).toBeCloseTo(0.3, 10);
    expect(result[LANDMARK_INDEX.LEFT_HIP].x).toBeCloseTo(0.5, 10);
    expect(result[LANDMARK_INDEX.LEFT_HIP].y).toBeCloseTo(0.6, 10);

    const elbow = result[LANDMARK_INDEX.LEFT_ELBOW];
    expect(elbow.x).not.toBeCloseTo(0.5, 5);
  });

  it("ELBOW rotation moves the wrist but not the shoulder", () => {
    const landmarks = makeSkeleton({
      ...UPRIGHT_TORSO,
      LEFT_ELBOW: { x: 0.5, y: 0.45 },
      LEFT_WRIST: { x: 0.5, y: 0.55 }, // straight arm, elbow flexion 0°
    });
    const result = applyAngleAdjustments(landmarks, [
      { bodyRegion: "ELBOW_LEFT", currentDegrees: 0, targetDegrees: 60 },
    ]);

    // Shoulder and elbow (the pivot) are untouched.
    expect(result[LANDMARK_INDEX.LEFT_SHOULDER].x).toBeCloseTo(0.5, 10);
    expect(result[LANDMARK_INDEX.LEFT_SHOULDER].y).toBeCloseTo(0.3, 10);
    expect(result[LANDMARK_INDEX.LEFT_ELBOW].x).toBeCloseTo(0.5, 10);
    expect(result[LANDMARK_INDEX.LEFT_ELBOW].y).toBeCloseTo(0.45, 10);

    const wrist = result[LANDMARK_INDEX.LEFT_WRIST];
    expect(wrist.x).not.toBeCloseTo(0.5, 5);
  });

  it("KNEE rotation is independent of the upper body chain", () => {
    const landmarks = makeSkeleton({
      ...UPRIGHT_TORSO,
      LEFT_ANKLE: { x: 0.5, y: 1.2 },
    });
    const result = applyAngleAdjustments(landmarks, [
      { bodyRegion: "KNEE_LEFT", currentDegrees: 0, targetDegrees: 45 },
    ]);

    expect(result[LANDMARK_INDEX.LEFT_SHOULDER].x).toBeCloseTo(0.5, 10);
    expect(result[LANDMARK_INDEX.LEFT_HIP].x).toBeCloseTo(0.5, 10);
    expect(result[LANDMARK_INDEX.LEFT_KNEE].x).toBeCloseTo(0.5, 10);
    expect(result[LANDMARK_INDEX.LEFT_KNEE].y).toBeCloseTo(0.9, 10);

    const ankle = result[LANDMARK_INDEX.LEFT_ANKLE];
    expect(ankle.x).not.toBeCloseTo(0.5, 5);
  });

  it("applies TRUNK then ELBOW the same regardless of input order (sorts internally)", () => {
    const landmarks = makeSkeleton({
      ...UPRIGHT_TORSO,
      LEFT_ELBOW: { x: 0.5, y: 0.45 },
      LEFT_WRIST: { x: 0.5, y: 0.55 },
    });
    const trunkAdjustment: AngleAdjustment = {
      bodyRegion: "TRUNK",
      currentDegrees: 0,
      targetDegrees: 25,
    };
    const elbowAdjustment: AngleAdjustment = {
      bodyRegion: "ELBOW_LEFT",
      currentDegrees: 0,
      targetDegrees: 40,
    };

    const trunkFirst = applyAngleAdjustments(landmarks, [
      trunkAdjustment,
      elbowAdjustment,
    ]);
    const elbowFirst = applyAngleAdjustments(landmarks, [
      elbowAdjustment,
      trunkAdjustment,
    ]);

    for (const name of [
      "LEFT_SHOULDER",
      "LEFT_HIP",
      "LEFT_ELBOW",
      "LEFT_WRIST",
    ] as const) {
      const index = LANDMARK_INDEX[name];
      expect(trunkFirst[index].x).toBeCloseTo(elbowFirst[index].x, 10);
      expect(trunkFirst[index].y).toBeCloseTo(elbowFirst[index].y, 10);
    }
  });

  it("never mutates the input array or its elements", () => {
    const landmarks = makeSkeleton(UPRIGHT_TORSO);
    const snapshot = landmarks.map((l) => ({ ...l }));

    applyAngleAdjustments(landmarks, [
      { bodyRegion: "TRUNK", currentDegrees: 0, targetDegrees: 50 },
    ]);

    for (let i = 0; i < landmarks.length; i++) {
      expect(landmarks[i]).toEqual(snapshot[i]);
    }
  });

  it("skips adjustments for regions with no defined FK behavior", () => {
    // WRIST_LEFT (blocked on MediaPipe's Hand Landmarker — see
    // ANATOMICAL_LIMITS' own comment, skeleton.ts) — unlike HIP, still
    // genuinely unsupported here after Fix 3.
    const landmarks = makeSkeleton(UPRIGHT_TORSO);
    const result = applyAngleAdjustments(landmarks, [
      { bodyRegion: "WRIST_LEFT", currentDegrees: 0, targetDegrees: 90 },
    ]);
    for (let i = 0; i < landmarks.length; i++) {
      expect(result[i].x).toBeCloseTo(landmarks[i].x, 10);
      expect(result[i].y).toBeCloseTo(landmarks[i].y, 10);
    }
  });

  it("NECK rotation moves head landmarks but not the shoulders", () => {
    // Facing right (nose.x > shoulderMid.x), head neutral (ear directly
    // above shoulder).
    const landmarks = makeSkeleton({
      ...UPRIGHT_TORSO,
      NOSE: { x: 0.6, y: 0.2 },
      LEFT_EAR: { x: 0.5, y: 0.2 },
      RIGHT_EAR: { x: 0.5, y: 0.2 },
    });
    const result = applyAngleAdjustments(landmarks, [
      { bodyRegion: "NECK", currentDegrees: 0, targetDegrees: 20 },
    ]);

    expect(result[LANDMARK_INDEX.LEFT_SHOULDER].x).toBeCloseTo(0.5, 10);
    expect(result[LANDMARK_INDEX.LEFT_SHOULDER].y).toBeCloseTo(0.3, 10);

    const nose = result[LANDMARK_INDEX.NOSE];
    expect(nose.x).not.toBeCloseTo(0.6, 5);
  });

  it("throws for NECK when the subject isn't in profile (nose.x equals shoulder-midpoint x)", () => {
    const landmarks = makeSkeleton({
      ...UPRIGHT_TORSO,
      NOSE: { x: 0.5, y: 0.2 },
    });
    expect(() =>
      applyAngleAdjustments(landmarks, [
        { bodyRegion: "NECK", currentDegrees: 0, targetDegrees: 20 },
      ]),
    ).toThrow(/profile/);
  });

  // Regression: a large TRUNK edit used to silently flip NECK's reported
  // sign/direction, because facingSign was read off raw nose.x vs
  // shoulderMid.x — a comparison that isn't stable under this very
  // function's own TRUNK rotation (nose and shoulderMid are both members
  // of TRUNK_DISTAL and rotate together, so their x-difference rotates
  // right along with the trunk and can cross zero). Reported symptom: bend
  // TRUNK forward in the posture editor and the NECK slider "jumps to the
  // opposite (backward) band and stops responding." Reproduces the real
  // reported scenario end to end (applyAngleAdjustments -> computeAllAngles,
  // the same round trip posture-editor.ts's applyResolvedAngle drives) —
  // NOT a synthetic unit check of resolveNeckFacingSign in isolation.
  it("a large forward TRUNK bend does not flip NECK's reported sign or direction", () => {
    // A shallow starting lean (~4°), not UPRIGHT_TORSO or LEAN_TORSO: this
    // needs enough remaining headroom below ANATOMICAL_LIMITS.TRUNK's 90°
    // ceiling for the applied rotation to actually carry nose.x across
    // shoulderMid.x (confirmed empirically — the old raw-x heuristic's sign
    // only flips here once TRUNK approaches 90°, not at LEAN_TORSO's ~40°
    // starting lean, which leaves too little headroom).
    const SHALLOW_LEAN_TORSO = {
      LEFT_SHOULDER: { x: 0.52, y: 0.3 },
      RIGHT_SHOULDER: { x: 0.52, y: 0.3 },
      LEFT_HIP: { x: 0.5, y: 0.6 },
      RIGHT_HIP: { x: 0.5, y: 0.6 },
      LEFT_KNEE: { x: 0.5, y: 0.9 },
      RIGHT_KNEE: { x: 0.5, y: 0.9 },
    } as const;
    const baseline = makeSkeleton({
      ...SHALLOW_LEAN_TORSO,
      NOSE: { x: 0.6, y: 0.32 }, // nose.x > shoulderMid.x: facing right
      LEFT_EAR: { x: 0.62, y: 0.35 }, // slight forward-flexed neck
      RIGHT_EAR: { x: 0.62, y: 0.35 },
    });
    const beforeAngles = computeAllAngles(baseline);
    const neckBefore = beforeAngles.get("NECK");
    const trunkBefore = beforeAngles.get("TRUNK");
    expect(neckBefore).toBeDefined();
    expect(trunkBefore).toBeDefined();
    expect(neckBefore as number).toBeGreaterThan(0); // forward flexion, positive

    // Bend TRUNK forward to its ANATOMICAL_LIMITS max (90°) — large enough
    // that a rigid rotation of nose+shoulders around the (fixed) hip pivot
    // pushes nose.x well past shoulderMid.x on the other side, which is
    // exactly what used to flip the old raw-x facingSign heuristic.
    const bent = applyAngleAdjustments(baseline, [
      {
        bodyRegion: "TRUNK",
        currentDegrees: trunkBefore as number,
        targetDegrees: 90,
      },
    ]);
    const nose = bent[LANDMARK_INDEX.NOSE];
    const shoulderMid = {
      x:
        (bent[LANDMARK_INDEX.LEFT_SHOULDER].x +
          bent[LANDMARK_INDEX.RIGHT_SHOULDER].x) /
        2,
      y:
        (bent[LANDMARK_INDEX.LEFT_SHOULDER].y +
          bent[LANDMARK_INDEX.RIGHT_SHOULDER].y) /
        2,
    };
    // Confirms this fixture actually exercises the bug condition: the old
    // raw-x heuristic's sign really would have flipped here.
    expect(Math.sign(nose.x - shoulderMid.x)).not.toBe(
      Math.sign(
        baseline[LANDMARK_INDEX.NOSE].x - SHALLOW_LEAN_TORSO.LEFT_SHOULDER.x,
      ),
    );

    const afterAngles = computeAllAngles(bent);
    const neckAfter = afterAngles.get("NECK");
    expect(neckAfter).toBeDefined();
    // NECK's own angle was never touched by this adjustment — its sign and
    // (approximately, modulo the bilateral-midpoint TRUNK simplification)
    // its magnitude must stay exactly where they were, not flip to a
    // large-magnitude negative "backward extension" reading.
    expect(neckAfter as number).toBeGreaterThan(0);
    expect(neckAfter as number).toBeCloseTo(neckBefore as number, 6);

    // And a subsequent NECK adjustment, applied on top of the bent trunk,
    // must still rotate the head in the same relative sense a small-trunk
    // edit would — i.e. increasing the NECK target further increases
    // forward flexion, not decreases/reverses it.
    const bentThenNecked = applyAngleAdjustments(bent, [
      {
        bodyRegion: "NECK",
        currentDegrees: neckAfter as number,
        targetDegrees: (neckAfter as number) + 15,
      },
    ]);
    const neckFinal = computeAllAngles(bentThenNecked).get("NECK");
    expect(neckFinal).toBeDefined();
    expect(neckFinal as number).toBeGreaterThan(neckAfter as number);
  });

  // Verifies the invariant skeleton-3d.tsx's own rigid drag constraints
  // (Part A of this task) depend on: rotateLandmarks (rotatePoint applied
  // identically to every landmark in a region's `distal`/TRUNK_DISTAL/
  // NECK_DISTAL set, around one shared, unmoved pivot) is a pure rotation
  // with no translation component, so it can never stretch or compress a
  // bone — not just for distance-from-pivot (trivially true: rotation
  // preserves distance to its own center), but for EVERY pairwise distance
  // within the rotated set, including ones that don't involve the pivot at
  // all (e.g. elbow-to-wrist under a SHOULDER rotation, where neither
  // endpoint IS the pivot). A regression here — e.g. an accidental
  // translation term, or a per-landmark rotation angle that drifted from
  // the shared `deltaDegrees` — would show up as a bone length changing
  // even though the rotation math still "looks" superficially plausible
  // per-landmark, which is exactly the failure mode this test is for.
  it("preserves every bone length across a combined TRUNK+NECK+SHOULDER+ELBOW+KNEE adjustment", () => {
    const landmarks = makeSkeleton({
      ...LEAN_TORSO,
      NOSE: { x: 0.85, y: 0.15 },
      LEFT_ELBOW: { x: 0.85, y: 0.45 },
      LEFT_WRIST: { x: 0.9, y: 0.6 },
      RIGHT_ELBOW: { x: 0.85, y: 0.45 },
      RIGHT_WRIST: { x: 0.9, y: 0.6 },
      LEFT_ANKLE: { x: 0.5, y: 1.1 },
      RIGHT_ANKLE: { x: 0.5, y: 1.1 },
    });

    const bones: ReadonlyArray<
      readonly [keyof typeof LANDMARK_INDEX, keyof typeof LANDMARK_INDEX]
    > = [
      ["LEFT_SHOULDER", "RIGHT_SHOULDER"],
      ["LEFT_HIP", "RIGHT_HIP"],
      ["LEFT_SHOULDER", "LEFT_HIP"],
      ["RIGHT_SHOULDER", "RIGHT_HIP"],
      ["LEFT_SHOULDER", "LEFT_ELBOW"],
      ["LEFT_ELBOW", "LEFT_WRIST"],
      ["RIGHT_SHOULDER", "RIGHT_ELBOW"],
      ["RIGHT_ELBOW", "RIGHT_WRIST"],
      ["LEFT_HIP", "LEFT_KNEE"],
      ["LEFT_KNEE", "LEFT_ANKLE"],
      ["RIGHT_HIP", "RIGHT_KNEE"],
      ["RIGHT_KNEE", "RIGHT_ANKLE"],
      ["NOSE", "LEFT_SHOULDER"],
    ];
    const lengthOf = (
      set: SkeletonLandmark[],
      [a, b]: readonly [
        keyof typeof LANDMARK_INDEX,
        keyof typeof LANDMARK_INDEX,
      ],
    ) => distanceForTest(set[LANDMARK_INDEX[a]], set[LANDMARK_INDEX[b]]);
    const before = bones.map((bone) => lengthOf(landmarks, bone));

    const adjustments: AngleAdjustment[] = [
      {
        bodyRegion: "TRUNK",
        currentDegrees: trunkFlexionDegrees(landmarks),
        targetDegrees: trunkFlexionDegrees(landmarks) + 15,
      },
      { bodyRegion: "NECK", currentDegrees: 0, targetDegrees: 10 },
      { bodyRegion: "SHOULDER_LEFT", currentDegrees: 0, targetDegrees: 30 },
      { bodyRegion: "ELBOW_LEFT", currentDegrees: 0, targetDegrees: 45 },
      { bodyRegion: "KNEE_RIGHT", currentDegrees: 0, targetDegrees: 60 },
    ];
    const result = applyAngleAdjustments(landmarks, adjustments);
    const after = bones.map((bone) => lengthOf(result, bone));

    bones.forEach((_bone, i) => {
      expect(after[i]).toBeCloseTo(before[i] as number, 10);
    });
  });
});

// Fix 3 (SLD_SKELETON_FIXES.md): applyHipRotation, exercised through
// applyAngleAdjustments the same way every other region's FK function is
// tested in this file.
describe("applyHipRotation (HIP, via applyAngleAdjustments)", () => {
  // Standing, feet together, directly below the hips — HIP flexion is
  // exactly 0° on both sides in this pose (each hip->knee vector points
  // straight down, parallel to hipFlexion's own vertical reference). NOSE
  // is off the trunk axis (unlike UPRIGHT_TORSO's own default (0.5,0.5)
  // placeholder, which sits exactly ON it) so computeAllAngles' own NECK
  // computation — unconditional, run for every region even in a test that
  // only cares about HIP — doesn't hit signedNeckFlexion's "not in
  // profile" throw.
  const STANDING_LEGS = {
    ...UPRIGHT_TORSO,
    NOSE: { x: 0.6, y: 0.2 },
    LEFT_ANKLE: { x: 0.5, y: 1.2 },
    RIGHT_ANKLE: { x: 0.5, y: 1.2 },
    LEFT_HEEL: { x: 0.48, y: 1.25 },
    RIGHT_HEEL: { x: 0.52, y: 1.25 },
    LEFT_FOOT_INDEX: { x: 0.5, y: 1.3 },
    RIGHT_FOOT_INDEX: { x: 0.5, y: 1.3 },
  } as const;

  it("moves both legs (knee/ankle/heel/foot) but leaves the hips, shoulders, and trunk untouched", () => {
    const landmarks = makeSkeleton(STANDING_LEGS);
    const result = applyAngleAdjustments(landmarks, [
      { bodyRegion: "HIP", currentDegrees: 0, targetDegrees: 45 },
    ]);

    for (const name of [
      "LEFT_HIP",
      "RIGHT_HIP",
      "LEFT_SHOULDER",
      "RIGHT_SHOULDER",
    ] as const) {
      const index = LANDMARK_INDEX[name];
      expect(result[index].x).toBeCloseTo(landmarks[index].x, 10);
      expect(result[index].y).toBeCloseTo(landmarks[index].y, 10);
    }

    for (const name of [
      "LEFT_KNEE",
      "RIGHT_KNEE",
      "LEFT_ANKLE",
      "RIGHT_ANKLE",
      "LEFT_HEEL",
      "RIGHT_HEEL",
      "LEFT_FOOT_INDEX",
      "RIGHT_FOOT_INDEX",
    ] as const) {
      const index = LANDMARK_INDEX[name];
      const moved =
        Math.abs(result[index].x - landmarks[index].x) +
        Math.abs(result[index].y - landmarks[index].y);
      expect(moved).toBeGreaterThan(0.01);
    }
  });

  // The property LEFT_HIP_DISTAL/RIGHT_HIP_DISTAL's own comment argues
  // for: rotating each leg around its OWN real hip (not a shared virtual
  // midpoint, unlike TRUNK) must preserve each thigh's bone length
  // exactly, since rotation around a point's true anatomical pivot can
  // never change its distance from that pivot.
  it("preserves both thigh lengths exactly", () => {
    const landmarks = makeSkeleton(STANDING_LEGS);
    const beforeLeft = distanceForTest(
      landmarks[LANDMARK_INDEX.LEFT_HIP],
      landmarks[LANDMARK_INDEX.LEFT_KNEE],
    );
    const beforeRight = distanceForTest(
      landmarks[LANDMARK_INDEX.RIGHT_HIP],
      landmarks[LANDMARK_INDEX.RIGHT_KNEE],
    );

    const result = applyAngleAdjustments(landmarks, [
      { bodyRegion: "HIP", currentDegrees: 0, targetDegrees: 60 },
    ]);

    const afterLeft = distanceForTest(
      result[LANDMARK_INDEX.LEFT_HIP],
      result[LANDMARK_INDEX.LEFT_KNEE],
    );
    const afterRight = distanceForTest(
      result[LANDMARK_INDEX.RIGHT_HIP],
      result[LANDMARK_INDEX.RIGHT_KNEE],
    );
    expect(afterLeft).toBeCloseTo(beforeLeft, 10);
    expect(afterRight).toBeCloseTo(beforeRight, 10);
  });

  it("round-trips through computeAllAngles: a HIP adjustment lands on the requested target angle", () => {
    const landmarks = makeSkeleton(STANDING_LEGS);
    const before = computeAllAngles(landmarks).get("HIP");
    expect(before).toBeCloseTo(0, 5);

    const result = applyAngleAdjustments(landmarks, [
      {
        bodyRegion: "HIP",
        currentDegrees: before as number,
        targetDegrees: 30,
      },
    ]);
    const after = computeAllAngles(result).get("HIP");
    expect(after).toBeCloseTo(30, 5);
  });

  // NOT independence — the opposite. computeRawBodyAngle's own TRUNK
  // formula is 180 - angle(shoulder, hip, knee): it reads the KNEE as one
  // of its own triangle vertices, the same landmark HIP's rotation moves.
  // Rotating only the knee ray around hip by θ (shoulder ray untouched)
  // changes that included angle by θ regardless of the shoulder ray's own
  // direction — a plain property of an included angle between two rays
  // sharing a vertex — so adjusting HIP always shifts TRUNK's own live
  // reading too, confirmed here rather than just reasoned about: in this
  // exactly-upright starting fixture (shoulder ray precisely opposite
  // hipFlexion's own vertical reference), the shift is the full 40°, not
  // an approximation. This is real, pre-existing coupling in v1's TRUNK
  // formula (see CLAUDE.md's scoring-methodology section — that formula is
  // versioned/seeded data, not something this fix touches or could fix),
  // now visible for the first time because HIP is the first control that
  // can move the KNEE landmark independently of a KNEE_LEFT/RIGHT edit
  // (which only ever rotates the shin distal to a FIXED knee vertex).
  // Known follow-up, not solved here: the posture editor's own
  // adjustedRegions tracking (posture-editor.ts) only marks the region the
  // user actually touched (HIP), so TRUNK's row will show this shifted
  // number without an "Adjusted" badge explaining why.
  it("HIP's own rotation shifts TRUNK's live reading too, since both formulas share the hip->knee ray", () => {
    const landmarks = makeSkeleton(STANDING_LEGS);
    const trunkBefore = computeAllAngles(landmarks).get("TRUNK");
    expect(trunkBefore).toBeCloseTo(0, 5);

    const result = applyAngleAdjustments(landmarks, [
      { bodyRegion: "HIP", currentDegrees: 0, targetDegrees: 40 },
    ]);
    const trunkAfter = computeAllAngles(result).get("TRUNK");
    expect(trunkAfter).toBeCloseTo(40, 5);
  });

  it("HIP resolves before KNEE when both are adjusted together, so KNEE rotates around the already-hip-moved knee position", () => {
    // Order-independence check, same style as this file's own
    // "applies TRUNK then ELBOW the same regardless of input order" test:
    // REGION_PRIORITY forces HIP before KNEE_LEFT internally regardless of
    // which order the caller lists them in.
    const landmarks = makeSkeleton(STANDING_LEGS);
    const hipAdjustment: AngleAdjustment = {
      bodyRegion: "HIP",
      currentDegrees: 0,
      targetDegrees: 30,
    };
    const kneeAdjustment: AngleAdjustment = {
      bodyRegion: "KNEE_LEFT",
      currentDegrees: 0,
      targetDegrees: 20,
    };

    const hipFirst = applyAngleAdjustments(landmarks, [
      hipAdjustment,
      kneeAdjustment,
    ]);
    const kneeFirst = applyAngleAdjustments(landmarks, [
      kneeAdjustment,
      hipAdjustment,
    ]);

    for (const name of [
      "LEFT_KNEE",
      "LEFT_ANKLE",
      "RIGHT_KNEE",
      "RIGHT_ANKLE",
    ] as const) {
      const index = LANDMARK_INDEX[name];
      expect(hipFirst[index].x).toBeCloseTo(kneeFirst[index].x, 10);
      expect(hipFirst[index].y).toBeCloseTo(kneeFirst[index].y, 10);
    }
  });
});
