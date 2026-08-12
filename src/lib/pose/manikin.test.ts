import { describe, expect, it } from "vitest";
import type { BodyRegion } from "@/generated/prisma/enums";
import { computeAngleFromDrag } from "./drag-to-angle";
import { buildManikinPose } from "./manikin";
import { LANDMARK_INDEX, VIRTUAL_CHEST_LANDMARK_INDEX } from "./skeleton";

// Mirrors manikin.ts's own private RATIO_OF_STATURE/STATURE — deliberately
// duplicated here rather than exported from that module and imported,
// matching skeleton.test.ts's own precedent (ANATOMICAL_LIMITS' exact
// values, SEGMENT_RATIO_OF_STATURE's values) of hardcoding the expected
// literal rather than reaching into a module's private constants.
const STATURE = 0.85;
const RATIO = {
  TORSO: 0.288,
  HEAD_ABOVE_SHOULDER: 0.182,
  UPPER_ARM: 0.186,
  FOREARM: 0.146,
  UPPER_LEG: 0.245,
  LOWER_LEG: 0.233,
  SHOULDER_WIDTH: 0.259,
  HIP_WIDTH: 0.191,
} as const;

function distance(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function angles(overrides: Partial<Record<BodyRegion, number>>) {
  return new Map(Object.entries(overrides)) as ReadonlyMap<BodyRegion, number>;
}

describe("buildManikinPose", () => {
  it("returns exactly 33 landmarks, none undefined", () => {
    const pose = buildManikinPose(angles({}));
    expect(pose).toHaveLength(33);
    for (const landmark of pose) {
      expect(landmark).toBeDefined();
      expect(Number.isFinite(landmark.x)).toBe(true);
      expect(Number.isFinite(landmark.y)).toBe(true);
      expect(Number.isFinite(landmark.z)).toBe(true);
    }
  });

  it("an empty angle map is exactly the neutral (all-0) pose", () => {
    const empty = buildManikinPose(angles({}));
    const explicitZero = buildManikinPose(
      angles({
        TRUNK: 0,
        NECK: 0,
        SHOULDER_LEFT: 0,
        SHOULDER_RIGHT: 0,
        ELBOW_LEFT: 0,
        ELBOW_RIGHT: 0,
        KNEE_LEFT: 0,
        KNEE_RIGHT: 0,
      }),
    );
    for (let i = 0; i < 33; i++) {
      expect(empty[i].x).toBeCloseTo(explicitZero[i].x, 10);
      expect(empty[i].y).toBeCloseTo(explicitZero[i].y, 10);
      expect(empty[i].z).toBeCloseTo(explicitZero[i].z, 10);
    }
  });

  describe("fixed anthropometric proportions", () => {
    it("torso length is TORSO ratio of stature, independent of TRUNK angle", () => {
      for (const trunk of [0, 30, 90]) {
        const pose = buildManikinPose(angles({ TRUNK: trunk }));
        const hip = pose[LANDMARK_INDEX.LEFT_HIP];
        const shoulder = pose[LANDMARK_INDEX.LEFT_SHOULDER];
        // Compares against the CENTERLINE, not the (laterally-offset) real
        // hip/shoulder landmarks — x/y only, matching how every angle
        // formula in this app reads these landmarks (z is lateral-only,
        // see manikin.ts's own coordinate-convention comment).
        expect(Math.hypot(shoulder.x - hip.x, shoulder.y - hip.y)).toBeCloseTo(
          RATIO.TORSO * STATURE,
          10,
        );
      }
    });

    it("upper-arm and forearm lengths are fixed, independent of SHOULDER/ELBOW angle", () => {
      for (const [shoulderFlexion, elbowFlexion] of [
        [0, 0],
        [90, 60],
        [180, 145],
      ]) {
        const pose = buildManikinPose(
          angles({ SHOULDER_LEFT: shoulderFlexion, ELBOW_LEFT: elbowFlexion }),
        );
        const shoulder = pose[LANDMARK_INDEX.LEFT_SHOULDER];
        const elbow = pose[LANDMARK_INDEX.LEFT_ELBOW];
        const wrist = pose[LANDMARK_INDEX.LEFT_WRIST];
        expect(distance(shoulder, elbow)).toBeCloseTo(
          RATIO.UPPER_ARM * STATURE,
          10,
        );
        expect(distance(elbow, wrist)).toBeCloseTo(RATIO.FOREARM * STATURE, 10);
      }
    });

    it("upper-leg length is fixed and the hip-knee segment never moves, regardless of KNEE angle", () => {
      const straight = buildManikinPose(angles({ KNEE_LEFT: 0 }));
      const bent = buildManikinPose(angles({ KNEE_LEFT: 100 }));
      const hipStraight = straight[LANDMARK_INDEX.LEFT_HIP];
      const kneeStraight = straight[LANDMARK_INDEX.LEFT_KNEE];
      const hipBent = bent[LANDMARK_INDEX.LEFT_HIP];
      const kneeBent = bent[LANDMARK_INDEX.LEFT_KNEE];

      expect(distance(hipStraight, kneeStraight)).toBeCloseTo(
        RATIO.UPPER_LEG * STATURE,
        10,
      );
      // Not just the same LENGTH — the exact same POSITION. None of the 8
      // scored regions carry a hip-for-legs angle, so nothing should ever
      // move this segment (see manikin.ts's own comment on this).
      expect(kneeBent.x).toBeCloseTo(kneeStraight.x, 10);
      expect(kneeBent.y).toBeCloseTo(kneeStraight.y, 10);
      expect(hipBent.x).toBeCloseTo(hipStraight.x, 10);

      const ankleBent = bent[LANDMARK_INDEX.RIGHT_ANKLE];
      const kneeBentRight = bent[LANDMARK_INDEX.RIGHT_KNEE];
      // KNEE_RIGHT wasn't set (defaults to neutral) — its shank should
      // still read as a straight, fully-extended leg.
      expect(distance(kneeBentRight, ankleBent)).toBeCloseTo(
        RATIO.LOWER_LEG * STATURE,
        10,
      );
    });

    it("shoulder and hip breadth match SHOULDER_WIDTH/HIP_WIDTH ratios", () => {
      const pose = buildManikinPose(angles({}));
      const leftShoulder = pose[LANDMARK_INDEX.LEFT_SHOULDER];
      const rightShoulder = pose[LANDMARK_INDEX.RIGHT_SHOULDER];
      const leftHip = pose[LANDMARK_INDEX.LEFT_HIP];
      const rightHip = pose[LANDMARK_INDEX.RIGHT_HIP];
      expect(distance(leftShoulder, rightShoulder)).toBeCloseTo(
        RATIO.SHOULDER_WIDTH * STATURE,
        10,
      );
      expect(distance(leftHip, rightHip)).toBeCloseTo(
        RATIO.HIP_WIDTH * STATURE,
        10,
      );
    });

    it("head/neck length is the HEAD_ABOVE_SHOULDER ratio, independent of NECK angle", () => {
      for (const neck of [-20, 0, 60]) {
        const pose = buildManikinPose(angles({ NECK: neck }));
        const shoulderMid = {
          x:
            (pose[LANDMARK_INDEX.LEFT_SHOULDER].x +
              pose[LANDMARK_INDEX.RIGHT_SHOULDER].x) /
            2,
          y:
            (pose[LANDMARK_INDEX.LEFT_SHOULDER].y +
              pose[LANDMARK_INDEX.RIGHT_SHOULDER].y) /
            2,
          z: 0,
        };
        const nose = pose[LANDMARK_INDEX.NOSE];
        expect(distance(shoulderMid, nose)).toBeCloseTo(
          RATIO.HEAD_ABOVE_SHOULDER * STATURE,
          10,
        );
      }
    });
  });

  describe("decorative (unscored) landmarks", () => {
    it("face-cluster landmarks collapse onto the nose", () => {
      const pose = buildManikinPose(angles({ TRUNK: 20, NECK: 15 }));
      const nose = pose[LANDMARK_INDEX.NOSE];
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
        const point = pose[LANDMARK_INDEX[name]];
        expect(point.x).toBeCloseTo(nose.x, 10);
        expect(point.y).toBeCloseTo(nose.y, 10);
        expect(point.z).toBeCloseTo(nose.z, 10);
      }
    });

    it("finger landmarks collapse onto the wrist, per side", () => {
      const pose = buildManikinPose(
        angles({ SHOULDER_LEFT: 45, ELBOW_LEFT: 30 }),
      );
      const wrist = pose[LANDMARK_INDEX.LEFT_WRIST];
      for (const name of ["LEFT_PINKY", "LEFT_INDEX", "LEFT_THUMB"] as const) {
        const point = pose[LANDMARK_INDEX[name]];
        expect(point.x).toBeCloseTo(wrist.x, 10);
        expect(point.y).toBeCloseTo(wrist.y, 10);
      }
    });

    it("heel/foot-index landmarks collapse onto the ankle, per side", () => {
      const pose = buildManikinPose(angles({ KNEE_RIGHT: 70 }));
      const ankle = pose[LANDMARK_INDEX.RIGHT_ANKLE];
      for (const name of ["RIGHT_HEEL", "RIGHT_FOOT_INDEX"] as const) {
        const point = pose[LANDMARK_INDEX[name]];
        expect(point.x).toBeCloseTo(ankle.x, 10);
        expect(point.y).toBeCloseTo(ankle.y, 10);
      }
    });
  });

  // The real correctness property this module exists for: feeding the
  // manikin's own output back through computeAngleFromDrag (dragging each
  // joint to its OWN current position — a zero-move "drag") must reproduce
  // the exact angle that built it. This is precisely how the app actually
  // consumes manikin.ts's output (posture-editor.tsx's handleJointDrag),
  // so it's a stronger guarantee than checking segment lengths/angles via
  // computeRawBodyAngle/computeAllAngles directly — see the note on NECK
  // below for why that distinction specifically matters here.
  describe("round-trips through computeAngleFromDrag at each joint's own position", () => {
    it("TRUNK, SHOULDER_LEFT/RIGHT, ELBOW_LEFT/RIGHT, KNEE_LEFT/RIGHT — a combined, non-trivial pose", () => {
      const input: Record<string, number> = {
        TRUNK: 30,
        SHOULDER_LEFT: 45,
        SHOULDER_RIGHT: 20,
        ELBOW_LEFT: 60,
        ELBOW_RIGHT: 90,
        KNEE_LEFT: 15,
        KNEE_RIGHT: 100,
      };
      const pose = buildManikinPose(angles(input));

      const check = (
        landmarkIndex: number,
        region: string,
        expected: number,
        position: { x: number; y: number; z: number } = pose[landmarkIndex],
      ) => {
        const result = computeAngleFromDrag(pose, landmarkIndex, position);
        expect(result.bodyRegion).toBe(region);
        expect(result.clamped).toBe(false);
        expect(result.angleDegrees).toBeCloseTo(expected, 3);
      };

      // VIRTUAL_CHEST_LANDMARK_INDEX (33) has no slot of its own in a
      // 33-element pose (indices 0-32) — the same relationship
      // getVirtualChestPosition (skeleton.ts) has to a real capture's own
      // landmarksTo3DPositions output, just computed here directly on
      // PoseLandmark values instead of THREE.Vector3s.
      const leftShoulder = pose[LANDMARK_INDEX.LEFT_SHOULDER];
      const rightShoulder = pose[LANDMARK_INDEX.RIGHT_SHOULDER];
      const chestMid = {
        x: (leftShoulder.x + rightShoulder.x) / 2,
        y: (leftShoulder.y + rightShoulder.y) / 2,
        z: (leftShoulder.z + rightShoulder.z) / 2,
      };
      check(VIRTUAL_CHEST_LANDMARK_INDEX, "TRUNK", input.TRUNK, chestMid);
      check(LANDMARK_INDEX.LEFT_SHOULDER, "SHOULDER_LEFT", input.SHOULDER_LEFT);
      check(
        LANDMARK_INDEX.RIGHT_SHOULDER,
        "SHOULDER_RIGHT",
        input.SHOULDER_RIGHT,
      );
      check(LANDMARK_INDEX.LEFT_ELBOW, "ELBOW_LEFT", input.ELBOW_LEFT);
      check(LANDMARK_INDEX.RIGHT_ELBOW, "ELBOW_RIGHT", input.ELBOW_RIGHT);
      check(LANDMARK_INDEX.LEFT_KNEE, "KNEE_LEFT", input.KNEE_LEFT);
      check(LANDMARK_INDEX.RIGHT_KNEE, "KNEE_RIGHT", input.KNEE_RIGHT);
    });

    it("NECK: positive (forward) and negative (backward) both round-trip with the correct sign", () => {
      // computeAngleFromDrag's own NOSE branch (unlike computeRawBodyAngle's
      // real ear-based signedNeckFlexion formula — see angles.ts) derives
      // both magnitude and sign directly from the dragged position against
      // shoulderMid/hipMid alone. It's the ONLY formula manikin.ts's
      // crude "ears collapse onto the nose" placement actually needs to
      // satisfy, since dragging the manikin's own NECK handle is the one
      // and only way this app ever asks a manikin pose for its NECK angle
      // (see posture-editor.tsx's handleJointDrag — nothing calls
      // computeAllAngles on a manikin pose directly). A perfectly neutral
      // manikin (TRUNK=0 and NECK=0 together) is a genuine degenerate case
      // for this formula too — the single-point head sits exactly on the
      // shoulder-midpoint vertical line, the same "subject not in profile"
      // condition a face-on real capture hits — which is why both cases
      // below give TRUNK a nonzero value.
      for (const neck of [25, -15]) {
        const pose = buildManikinPose(angles({ TRUNK: 10, NECK: neck }));
        const nose = pose[LANDMARK_INDEX.NOSE];
        const result = computeAngleFromDrag(pose, LANDMARK_INDEX.NOSE, nose);
        expect(result.bodyRegion).toBe("NECK");
        expect(result.angleDegrees).toBeCloseTo(neck, 3);
      }
    });

    it("throws for a perfectly neutral manikin's own NECK handle — TRUNK and NECK both 0 puts the single-point head exactly on the shoulder-midpoint line", () => {
      const pose = buildManikinPose(angles({}));
      const nose = pose[LANDMARK_INDEX.NOSE];
      expect(() =>
        computeAngleFromDrag(pose, LANDMARK_INDEX.NOSE, nose),
      ).toThrow(/profile/i);
    });
  });
});
