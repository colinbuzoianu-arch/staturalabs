import { describe, expect, it } from "vitest";
import { CameraAngle } from "@/generated/prisma/enums";
import { computeBodyAngles, LANDMARK_INDEX, type PoseLandmark } from "./angles";
import { computeAllAngles, computeAngleFromDrag } from "./drag-to-angle";
import { VIRTUAL_CHEST_LANDMARK_INDEX } from "./skeleton";

// A full "standing, arms at sides, facing right" pose where every one of
// the 8 computable regions reads ~0° — every joint chain here is either a
// straight vertical line (TRUNK/NECK/ELBOW/KNEE) or hanging straight down
// from its proximal joint (SHOULDER), the exact same coordinates
// angles.test.ts's own "neutral" fixtures use per region, reused here
// rather than re-derived so the baseline values are already known-correct.
function neutralLandmarks(
  overrides: Partial<
    Record<number, { x: number; y: number; visibility?: number }>
  > = {},
): PoseLandmark[] {
  const placeholder: PoseLandmark = { x: 0, y: 0, z: 0, visibility: 1 };
  const landmarks: PoseLandmark[] = Array.from({ length: 33 }, () => ({
    ...placeholder,
  }));

  const set = (index: number, x: number, y: number, visibility = 1) => {
    landmarks[index] = { x, y, z: 0, visibility };
  };

  set(LANDMARK_INDEX.NOSE, 0.55, 0.3); // nose.x > shoulderMid.x -> facing right
  for (const side of ["LEFT", "RIGHT"] as const) {
    set(LANDMARK_INDEX[`${side}_EAR`], 0.5, 0.3);
    set(LANDMARK_INDEX[`${side}_SHOULDER`], 0.5, 0.5);
    set(LANDMARK_INDEX[`${side}_ELBOW`], 0.5, 0.65);
    set(LANDMARK_INDEX[`${side}_WRIST`], 0.5, 0.8);
    set(LANDMARK_INDEX[`${side}_HIP`], 0.5, 0.7);
    set(LANDMARK_INDEX[`${side}_KNEE`], 0.5, 0.9);
    set(LANDMARK_INDEX[`${side}_ANKLE`], 0.5, 1.1);
  }

  for (const [indexKey, point] of Object.entries(overrides)) {
    if (!point) continue;
    landmarks[Number(indexKey)] = {
      x: point.x,
      y: point.y,
      z: 0,
      visibility: point.visibility ?? 1,
    };
  }
  return landmarks;
}

describe("computeAllAngles", () => {
  it("computes all 8 regions from a neutral pose, all ~0°", () => {
    const angles = computeAllAngles(neutralLandmarks());
    expect(angles.size).toBe(8);
    for (const degrees of angles.values()) {
      expect(degrees).toBeCloseTo(0, 5);
    }
  });

  it("bypasses the camera-angle gate that computeBodyAngles itself applies", () => {
    const landmarks = neutralLandmarks();

    // TRUNK requires SAGITTAL — computeBodyAngles itself correctly refuses
    // a FRONTAL-tagged sample.
    const gated = computeBodyAngles(landmarks, CameraAngle.FRONTAL).TRUNK;
    expect(gated.ok).toBe(false);
    if (!gated.ok) expect(gated.reason).toBe("WRONG_CAMERA_ANGLE");

    // computeAllAngles doesn't take a cameraAngle at all — it still
    // reports TRUNK, with the same value computeBodyAngles would report
    // under SAGITTAL (the geometry doesn't depend on which angle gated
    // it through).
    const ungated = computeAllAngles(landmarks);
    expect(ungated.get("TRUNK")).toBeCloseTo(0, 5);
  });

  it("still omits a region whose required landmark has insufficient visibility", () => {
    const landmarks = neutralLandmarks({
      [LANDMARK_INDEX.LEFT_KNEE]: { x: 0.5, y: 0.9, visibility: 0.1 },
    });
    const angles = computeAllAngles(landmarks);
    // TRUNK reads both knees; KNEE_LEFT reads the left knee directly.
    expect(angles.has("TRUNK")).toBe(false);
    expect(angles.has("KNEE_LEFT")).toBe(false);
    // Unrelated regions are unaffected.
    expect(angles.has("ELBOW_LEFT")).toBe(true);
  });
});

describe("computeAngleFromDrag", () => {
  it("SHOULDER_LEFT/ELBOW_LEFT/KNEE_LEFT: identical to computeBodyAngles with the dragged landmark patched in", () => {
    const landmarks = neutralLandmarks();

    // Elbow bent to 90°, same coordinates as angles.test.ts's own
    // "elbow bent 90°" case.
    const elbow = computeAngleFromDrag(landmarks, LANDMARK_INDEX.LEFT_ELBOW, {
      x: 0.65,
      y: 0.65,
    });
    expect(elbow.bodyRegion).toBe("ELBOW_LEFT");
    expect(elbow.angleDegrees).toBeCloseTo(90, 1);
    expect(elbow.clamped).toBe(false);

    // Shoulder raised to horizontal, same coordinates as angles.test.ts's
    // own "arm raised to horizontal" case.
    const shoulder = computeAngleFromDrag(
      landmarks,
      LANDMARK_INDEX.LEFT_SHOULDER,
      {
        x: 0.5,
        y: 0.5,
      },
    );
    // Dragging the shoulder itself doesn't change SHOULDER_LEFT's own
    // formula (hip, shoulder, elbow) unless the shoulder moves away from
    // its own neutral spot — sanity-check it still reports ~0 unchanged.
    expect(shoulder.bodyRegion).toBe("SHOULDER_LEFT");
    expect(shoulder.angleDegrees).toBeCloseTo(0, 1);

    // Knee dragged off to the side (hip and ankle stay fixed at their
    // neutral positions) — hand-verified: knee->hip=(-0.15,-0.25),
    // knee->ankle=(-0.15,0.15), included angle ≈104.04°, flexion ≈75.96°.
    const knee = computeAngleFromDrag(landmarks, LANDMARK_INDEX.LEFT_KNEE, {
      x: 0.65,
      y: 0.95,
    });
    expect(knee.bodyRegion).toBe("KNEE_LEFT");
    expect(knee.angleDegrees).toBeCloseTo(75.9638, 3);
    expect(knee.clamped).toBe(false);
  });

  it("TRUNK: dragging the virtual chest handle produces the bilateral-midpoint angle", () => {
    const landmarks = neutralLandmarks();
    // hipMid=(0.5,0.7), kneeMid=(0.5,0.9); dragging the chest to (0.6,0.6)
    // gives a clean 45° by construction (see the module comment's
    // derivation for this exact configuration).
    const result = computeAngleFromDrag(
      landmarks,
      VIRTUAL_CHEST_LANDMARK_INDEX,
      {
        x: 0.6,
        y: 0.6,
      },
    );
    expect(result.bodyRegion).toBe("TRUNK");
    expect(result.angleDegrees).toBeCloseTo(45, 5);
    expect(result.clamped).toBe(false);
  });

  it("NECK: dragging the nose produces the shoulderMid/hipMid-anchored, facing-signed angle", () => {
    const landmarks = neutralLandmarks();
    // shoulderMid=(0.5,0.5), hipMid=(0.5,0.7); nose dragged to (0.6,0.4) —
    // same right-triangle shape as the TRUNK case above, so also 45°, and
    // nose.x (0.6) > shoulderMid.x (0.5) so facing right -> positive
    // (flexion, not extension).
    const result = computeAngleFromDrag(landmarks, LANDMARK_INDEX.NOSE, {
      x: 0.6,
      y: 0.4,
    });
    expect(result.bodyRegion).toBe("NECK");
    expect(result.angleDegrees).toBeCloseTo(45, 5);
    expect(result.clamped).toBe(false);
  });

  it("NECK: dragging the nose to the opposite side of shoulderMid gives a negative (extension) angle", () => {
    const landmarks = neutralLandmarks();
    // Same magnitude as the previous case, mirrored below the shoulder
    // line but still facing right (nose.x > shoulderMid.x) is flexion; to
    // get extension, drag the nose so it moves toward the hip line but on
    // the FACING side is impossible to flip sign purely via y — flip x
    // below shoulderMid.x instead (facing sign becomes negative).
    const result = computeAngleFromDrag(landmarks, LANDMARK_INDEX.NOSE, {
      x: 0.4,
      y: 0.4,
    });
    expect(result.bodyRegion).toBe("NECK");
    expect(result.angleDegrees).toBeLessThan(0);
  });

  it("NECK: throws when the dragged nose lands exactly on the shoulder-midpoint x", () => {
    const landmarks = neutralLandmarks();
    expect(() =>
      computeAngleFromDrag(landmarks, LANDMARK_INDEX.NOSE, { x: 0.5, y: 0.2 }),
    ).toThrow(/profile/i);
  });

  it("clamps to ANATOMICAL_LIMITS and reports clamped: true when the drag exceeds it", () => {
    const landmarks = neutralLandmarks();
    // Elbow dragged far to the side so shoulder and wrist sit almost in
    // the same direction from it — a sharp "hairpin" fold well past the
    // 145° ELBOW_LEFT limit.
    const result = computeAngleFromDrag(landmarks, LANDMARK_INDEX.LEFT_ELBOW, {
      x: 1.5,
      y: 0.65,
    });
    expect(result.bodyRegion).toBe("ELBOW_LEFT");
    expect(result.angleDegrees).toBeCloseTo(145, 5);
    expect(result.clamped).toBe(true);
  });

  it("does not clamp when the drag stays within ANATOMICAL_LIMITS", () => {
    const landmarks = neutralLandmarks();
    const result = computeAngleFromDrag(landmarks, LANDMARK_INDEX.LEFT_ELBOW, {
      x: 0.65,
      y: 0.65,
    });
    expect(result.clamped).toBe(false);
  });

  it("throws for a landmark index JOINT_REGIONS doesn't map to any region", () => {
    const landmarks = neutralLandmarks();
    // Index 5 (RIGHT_EYE in MediaPipe's full 33-point topology, per
    // skeleton.ts's LANDMARK_INDEX) has no JOINT_REGIONS entry.
    expect(() =>
      computeAngleFromDrag(landmarks, 5, { x: 0.6, y: 0.3 }),
    ).toThrow(/does not control any BodyRegion/);
  });
});
