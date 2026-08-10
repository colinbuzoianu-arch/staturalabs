import { describe, expect, it } from "vitest";
import type { PoseLandmark, PoseLandmarks } from "./angles";
import {
  ANATOMICAL_LIMITS,
  BODY_REGION_BONES,
  classifyLandmarkConfidence,
  completeMissingLandmarks,
  getVirtualChestPosition,
  JOINT_REGIONS,
  LANDMARK_INDEX,
  landmarksTo3DPositions,
  POSE_CONNECTIONS,
  VIRTUAL_CHEST_LANDMARK_INDEX,
} from "./skeleton";

// Builds a full 33-entry landmarks array, same pattern as angles.test.ts's
// makeLandmarks: named-index overrides for the joints a test cares about,
// everything else defaulted to a plausible, fully-measured placeholder so
// it never accidentally participates in a test it's not meant to.
function makeLandmarks(
  overrides: Partial<
    Record<
      keyof typeof LANDMARK_INDEX,
      { x: number; y: number; visibility?: number }
    >
  >,
): PoseLandmarks {
  const placeholder: PoseLandmark = { x: 0.5, y: 0.5, z: 0, visibility: 1 };
  const landmarks: PoseLandmark[] = Array.from({ length: 33 }, () => ({
    ...placeholder,
  }));
  for (const [name, point] of Object.entries(overrides)) {
    if (!point) continue;
    landmarks[LANDMARK_INDEX[name as keyof typeof LANDMARK_INDEX]] = {
      x: point.x,
      y: point.y,
      z: 0,
      visibility: point.visibility ?? 1,
    };
  }
  return landmarks;
}

// MediaPipe's own degenerate "I have no idea" fallback shape — near-origin
// coordinates with near-zero visibility (see CLAUDE.md's
// MIN_LANDMARK_VISIBILITY note). Used to mark a landmark as "missing" in
// test fixtures.
const MISSING: { x: number; y: number; visibility: number } = {
  x: 0.005,
  y: 0.005,
  visibility: 0.01,
};

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

function distanceForTest(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

describe("classifyLandmarkConfidence", () => {
  it("measured: high visibility, on-screen", () => {
    expect(
      classifyLandmarkConfidence({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }),
    ).toBe("measured");
  });

  it("measured: visibility exactly at MIN_LANDMARK_VISIBILITY (inclusive)", () => {
    expect(
      classifyLandmarkConfidence({ x: 0.5, y: 0.5, z: 0, visibility: 0.5 }),
    ).toBe("measured");
  });

  it("estimated: low visibility but plausible on-screen coordinates", () => {
    expect(
      classifyLandmarkConfidence({ x: 0.4, y: 0.6, z: 0, visibility: 0.2 }),
    ).toBe("estimated");
  });

  it("missing: near-origin with near-zero visibility (MediaPipe's degenerate fallback)", () => {
    expect(
      classifyLandmarkConfidence({
        x: 0.005,
        y: 0.005,
        z: 0,
        visibility: 0.01,
      }),
    ).toBe("missing");
  });

  it("missing: clearly off-screen even with high reported visibility", () => {
    expect(
      classifyLandmarkConfidence({ x: 0.5, y: 1.4, z: 0, visibility: 0.95 }),
    ).toBe("missing");
  });

  it("missing: off-screen on the negative side", () => {
    expect(
      classifyLandmarkConfidence({ x: -0.2, y: 0.5, z: 0, visibility: 0.9 }),
    ).toBe("missing");
  });

  it("not missing just because it's near the origin with high visibility", () => {
    // A real, confidently-tracked point can legitimately sit near (0,0) —
    // only near-origin AND near-zero visibility together are degenerate.
    expect(
      classifyLandmarkConfidence({ x: 0.01, y: 0.01, z: 0, visibility: 0.9 }),
    ).toBe("measured");
  });
});

describe("LANDMARK_INDEX / POSE_CONNECTIONS integrity", () => {
  it("LANDMARK_INDEX covers exactly 0-32 with no duplicates", () => {
    const values = Object.values(LANDMARK_INDEX);
    expect(values.length).toBe(33);
    expect(new Set(values).size).toBe(33);
    expect(Math.min(...values)).toBe(0);
    expect(Math.max(...values)).toBe(32);
  });

  it("every connection references two distinct valid indices", () => {
    for (const [start, end] of POSE_CONNECTIONS) {
      expect(start).toBeGreaterThanOrEqual(0);
      expect(start).toBeLessThanOrEqual(32);
      expect(end).toBeGreaterThanOrEqual(0);
      expect(end).toBeLessThanOrEqual(32);
      expect(start).not.toBe(end);
    }
  });

  it("includes the core torso rectangle", () => {
    const has = (a: number, b: number) =>
      POSE_CONNECTIONS.some(
        ([s, e]) => (s === a && e === b) || (s === b && e === a),
      );
    expect(
      has(LANDMARK_INDEX.LEFT_SHOULDER, LANDMARK_INDEX.RIGHT_SHOULDER),
    ).toBe(true);
    expect(has(LANDMARK_INDEX.LEFT_HIP, LANDMARK_INDEX.RIGHT_HIP)).toBe(true);
    expect(has(LANDMARK_INDEX.LEFT_SHOULDER, LANDMARK_INDEX.LEFT_HIP)).toBe(
      true,
    );
    expect(has(LANDMARK_INDEX.RIGHT_SHOULDER, LANDMARK_INDEX.RIGHT_HIP)).toBe(
      true,
    );
  });
});

// Symmetric torso for every completeMissingLandmarks test below: both
// shoulders at (0.5, 0.3), both hips at (0.5, 0.6) — a perfectly vertical
// torso midline (the line x=0.5), so mirror reflections reduce to the easy
// case x' = 1 - x, y' = y and are simple to hand-verify.
const SYMMETRIC_TORSO = {
  LEFT_SHOULDER: { x: 0.5, y: 0.3 },
  RIGHT_SHOULDER: { x: 0.5, y: 0.3 },
  LEFT_HIP: { x: 0.5, y: 0.6 },
  RIGHT_HIP: { x: 0.5, y: 0.6 },
} as const;

describe("completeMissingLandmarks", () => {
  it("passes measured/estimated landmarks through unchanged", () => {
    const landmarks = makeLandmarks({
      ...SYMMETRIC_TORSO,
      LEFT_ELBOW: { x: 0.42, y: 0.4, visibility: 0.95 },
    });
    const result = completeMissingLandmarks(landmarks);
    const elbow = result[LANDMARK_INDEX.LEFT_ELBOW];
    expect(elbow.confidence).toBe("measured");
    expect(elbow.x).toBeCloseTo(0.42, 10);
    expect(elbow.y).toBeCloseTo(0.4, 10);
  });

  it("mirrors a missing landmark from its measured opposite across the torso midline", () => {
    const landmarks = makeLandmarks({
      ...SYMMETRIC_TORSO,
      RIGHT_ELBOW: { x: 0.65, y: 0.55 },
      LEFT_ELBOW: MISSING,
    });
    const result = completeMissingLandmarks(landmarks);
    const elbow = result[LANDMARK_INDEX.LEFT_ELBOW];
    expect(elbow.confidence).toBe("inferred");
    // Vertical midline at x=0.5: reflection of (0.65, 0.55) is (0.35, 0.55).
    expect(elbow.x).toBeCloseTo(0.35, 5);
    expect(elbow.y).toBeCloseTo(0.55, 5);
    // The original (degenerate) MediaPipe data is preserved, not discarded.
    expect(elbow.original.x).toBeCloseTo(MISSING.x, 10);
  });

  it("mirrors symmetrically the other direction too", () => {
    const landmarks = makeLandmarks({
      ...SYMMETRIC_TORSO,
      LEFT_KNEE: { x: 0.4, y: 0.8 },
      RIGHT_KNEE: MISSING,
    });
    const result = completeMissingLandmarks(landmarks);
    const knee = result[LANDMARK_INDEX.RIGHT_KNEE];
    expect(knee.confidence).toBe("inferred");
    expect(knee.x).toBeCloseTo(0.6, 5);
    expect(knee.y).toBeCloseTo(0.8, 5);
  });

  it("proportionally estimates a limb missing on both sides, from anthropometric ratios", () => {
    const landmarks = makeLandmarks({
      ...SYMMETRIC_TORSO,
      LEFT_ELBOW: MISSING,
      RIGHT_ELBOW: MISSING,
    });
    const result = completeMissingLandmarks(landmarks);
    const elbow = result[LANDMARK_INDEX.LEFT_ELBOW];
    expect(elbow.confidence).toBe("inferred");

    // stature = shoulder-hip distance / 0.288; upper arm = 18.6% of stature.
    const stature = 0.3 / 0.288;
    const upperArmLength = 0.186 * stature;
    // Torso is perfectly vertical (down = +y), so the elbow should land
    // straight down from the shoulder by that length.
    expect(elbow.x).toBeCloseTo(0.5, 5);
    expect(elbow.y).toBeCloseTo(0.3 + upperArmLength, 5);
  });

  it("chains proportional estimation proximal-to-distal (wrist continues from the estimated elbow)", () => {
    const landmarks = makeLandmarks({
      ...SYMMETRIC_TORSO,
      LEFT_ELBOW: MISSING,
      LEFT_WRIST: MISSING,
      RIGHT_ELBOW: MISSING,
      RIGHT_WRIST: MISSING,
    });
    const result = completeMissingLandmarks(landmarks);
    const elbow = result[LANDMARK_INDEX.LEFT_ELBOW];
    const wrist = result[LANDMARK_INDEX.LEFT_WRIST];
    expect(elbow.confidence).toBe("inferred");
    expect(wrist.confidence).toBe("inferred");

    const stature = 0.3 / 0.288;
    const upperArmLength = 0.186 * stature;
    const forearmLength = 0.146 * stature;
    expect(elbow.y).toBeCloseTo(0.3 + upperArmLength, 5);
    expect(wrist.y).toBeCloseTo(0.3 + upperArmLength + forearmLength, 5);
    expect(wrist.x).toBeCloseTo(0.5, 5);
  });

  it("leaves everything unresolved when the torso midline itself is unavailable", () => {
    const landmarks = makeLandmarks({
      LEFT_SHOULDER: MISSING,
      RIGHT_SHOULDER: MISSING,
      LEFT_HIP: { x: 0.5, y: 0.6 },
      RIGHT_HIP: { x: 0.5, y: 0.6 },
      LEFT_ELBOW: MISSING,
    });
    const result = completeMissingLandmarks(landmarks);
    expect(result[LANDMARK_INDEX.LEFT_SHOULDER].confidence).toBe("missing");
    expect(result[LANDMARK_INDEX.LEFT_ELBOW].confidence).toBe("missing");
    // Nothing fabricated — position is exactly the degenerate input.
    expect(result[LANDMARK_INDEX.LEFT_ELBOW].x).toBeCloseTo(MISSING.x, 10);
    expect(result[LANDMARK_INDEX.LEFT_ELBOW].y).toBeCloseTo(MISSING.y, 10);
  });

  it("clamps a mirrored knee that would imply an anatomically implausible trunk flexion", () => {
    // RIGHT_KNEE pulled up toward shoulder height — reflecting it straight
    // across the torso midline would put LEFT_KNEE at a trunk (shoulder-
    // hip-knee) flexion well past 90°, well beyond §"trunk doesn't flex
    // past ~90° in normal work".
    const rightKnee = { x: 0.6, y: 0.45 };
    const landmarks = makeLandmarks({
      ...SYMMETRIC_TORSO,
      RIGHT_KNEE: rightKnee,
      LEFT_KNEE: MISSING,
    });

    // Sanity check the premise: the raw (unclamped) mirror really would
    // exceed 90° flexion, so this test is actually exercising the clamp
    // and not trivially passing.
    const rawMirroredKnee = { x: 1 - rightKnee.x, y: rightKnee.y };
    const rawIncluded = includedAngleDegreesForTest(
      SYMMETRIC_TORSO.LEFT_SHOULDER,
      SYMMETRIC_TORSO.LEFT_HIP,
      rawMirroredKnee,
    );
    expect(180 - rawIncluded).toBeGreaterThan(90);

    const result = completeMissingLandmarks(landmarks);
    const knee = result[LANDMARK_INDEX.LEFT_KNEE];
    expect(knee.confidence).toBe("inferred");

    const hip = SYMMETRIC_TORSO.LEFT_HIP;
    const shoulder = SYMMETRIC_TORSO.LEFT_SHOULDER;
    const clampedIncluded = includedAngleDegreesForTest(shoulder, hip, knee);
    const clampedFlexion = 180 - clampedIncluded;
    expect(clampedFlexion).toBeCloseTo(90, 3);

    // The clamp rotates around the hip — bone length (hip-to-knee
    // distance) is preserved, only the direction changes.
    const rawDistance = distanceForTest(hip, rawMirroredKnee);
    const clampedDistance = distanceForTest(hip, knee);
    expect(clampedDistance).toBeCloseTo(rawDistance, 5);

    // And it stayed on the same side (left of the hip), not flipped.
    expect(knee.x).toBeLessThan(hip.x);
  });

  it("does not touch measured landmarks even when a neighboring joint gets clamped", () => {
    const landmarks = makeLandmarks({
      ...SYMMETRIC_TORSO,
      RIGHT_KNEE: { x: 0.6, y: 0.45 },
      LEFT_KNEE: MISSING,
    });
    const result = completeMissingLandmarks(landmarks);
    expect(result[LANDMARK_INDEX.LEFT_SHOULDER].confidence).toBe("measured");
    expect(result[LANDMARK_INDEX.LEFT_HIP].confidence).toBe("measured");
    expect(result[LANDMARK_INDEX.RIGHT_KNEE].x).toBeCloseTo(0.6, 10);
    expect(result[LANDMARK_INDEX.RIGHT_KNEE].y).toBeCloseTo(0.45, 10);
  });
});

describe("landmarksTo3DPositions", () => {
  it("keeps x unchanged, flips y, flips z, and scales by the 3D scale factor", () => {
    const positions = landmarksTo3DPositions([
      { x: 0.3, y: 0.4, z: -0.1, visibility: 1 },
    ]);
    expect(positions).toHaveLength(1);
    expect(positions[0].x).toBeCloseTo(0.6, 10);
    expect(positions[0].y).toBeCloseTo(-0.8, 10);
    expect(positions[0].z).toBeCloseTo(0.2, 10);
  });

  it("preserves array length and index order 1:1 with the input landmarks", () => {
    const landmarks: PoseLandmarks = Array.from({ length: 33 }, (_, i) => ({
      x: i / 33,
      y: 0.5,
      z: 0,
      visibility: 1,
    }));
    const positions = landmarksTo3DPositions(landmarks);
    expect(positions).toHaveLength(33);
    expect(positions[10].x).toBeCloseTo((10 / 33) * 2, 10);
  });

  it("accepts a completeMissingLandmarks result directly (SkeletonLandmark structurally satisfies PoseLandmark)", () => {
    const landmarks = makeLandmarks(SYMMETRIC_TORSO);
    const completed = completeMissingLandmarks(landmarks);
    const positions = landmarksTo3DPositions(completed);
    expect(positions).toHaveLength(33);
  });
});

describe("getVirtualChestPosition", () => {
  it("is the midpoint of the projected left/right shoulder positions", () => {
    const landmarks = makeLandmarks({
      LEFT_SHOULDER: { x: 0.4, y: 0.3 },
      RIGHT_SHOULDER: { x: 0.6, y: 0.3 },
    });
    const positions = landmarksTo3DPositions(landmarks);
    const chest = getVirtualChestPosition(positions);
    expect(chest.x).toBeCloseTo(1.0, 10); // (0.4 + 0.6) / 2 * 2
    expect(chest.y).toBeCloseTo(-0.6, 10); // -0.3 * 2
  });
});

describe("BODY_REGION_BONES", () => {
  it("only references real MediaPipe landmark indices (0-32)", () => {
    for (const bones of Object.values(BODY_REGION_BONES)) {
      for (const [a, b] of bones ?? []) {
        expect(a).toBeGreaterThanOrEqual(0);
        expect(a).toBeLessThanOrEqual(32);
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThanOrEqual(32);
      }
    }
  });

  it("covers exactly the 8 BodyRegion values computeBodyAngles produces readings for", () => {
    expect(Object.keys(BODY_REGION_BONES).sort()).toEqual(
      [
        "TRUNK",
        "NECK",
        "SHOULDER_LEFT",
        "SHOULDER_RIGHT",
        "ELBOW_LEFT",
        "ELBOW_RIGHT",
        "KNEE_LEFT",
        "KNEE_RIGHT",
      ].sort(),
    );
  });
});

describe("JOINT_REGIONS", () => {
  it("maps each draggable joint landmark to the region it controls", () => {
    expect(JOINT_REGIONS[LANDMARK_INDEX.LEFT_ELBOW]).toBe("ELBOW_LEFT");
    expect(JOINT_REGIONS[LANDMARK_INDEX.RIGHT_ELBOW]).toBe("ELBOW_RIGHT");
    expect(JOINT_REGIONS[LANDMARK_INDEX.LEFT_SHOULDER]).toBe("SHOULDER_LEFT");
    expect(JOINT_REGIONS[LANDMARK_INDEX.RIGHT_SHOULDER]).toBe("SHOULDER_RIGHT");
    expect(JOINT_REGIONS[LANDMARK_INDEX.LEFT_KNEE]).toBe("KNEE_LEFT");
    expect(JOINT_REGIONS[LANDMARK_INDEX.RIGHT_KNEE]).toBe("KNEE_RIGHT");
    expect(JOINT_REGIONS[LANDMARK_INDEX.NOSE]).toBe("NECK");
    expect(JOINT_REGIONS[VIRTUAL_CHEST_LANDMARK_INDEX]).toBe("TRUNK");
  });

  it("VIRTUAL_CHEST_LANDMARK_INDEX falls outside MediaPipe's real 0-32 landmark range", () => {
    expect(VIRTUAL_CHEST_LANDMARK_INDEX).toBeGreaterThan(32);
  });
});

describe("ANATOMICAL_LIMITS", () => {
  it("covers exactly the 8 scored regions, each with min <= max", () => {
    expect(Object.keys(ANATOMICAL_LIMITS).sort()).toEqual(
      [
        "TRUNK",
        "NECK",
        "SHOULDER_LEFT",
        "SHOULDER_RIGHT",
        "ELBOW_LEFT",
        "ELBOW_RIGHT",
        "KNEE_LEFT",
        "KNEE_RIGHT",
      ].sort(),
    );
    for (const limit of Object.values(ANATOMICAL_LIMITS)) {
      expect(limit).toBeDefined();
      expect(limit?.min).toBeLessThanOrEqual(limit?.max as number);
    }
  });

  it("matches the spec's per-region degree bounds", () => {
    expect(ANATOMICAL_LIMITS.TRUNK).toEqual({ min: 0, max: 90 });
    expect(ANATOMICAL_LIMITS.NECK).toEqual({ min: -20, max: 60 });
    expect(ANATOMICAL_LIMITS.SHOULDER_LEFT).toEqual({ min: 0, max: 180 });
    expect(ANATOMICAL_LIMITS.ELBOW_LEFT).toEqual({ min: 0, max: 145 });
    expect(ANATOMICAL_LIMITS.KNEE_LEFT).toEqual({ min: 0, max: 130 });
  });
});
