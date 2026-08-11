import { describe, expect, it } from "vitest";
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
    const landmarks = makeSkeleton(UPRIGHT_TORSO);
    const result = applyAngleAdjustments(landmarks, [
      { bodyRegion: "HIP", currentDegrees: 0, targetDegrees: 90 },
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
