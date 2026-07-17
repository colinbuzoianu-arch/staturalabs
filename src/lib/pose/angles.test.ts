import { describe, expect, it } from "vitest";
import { CameraAngle } from "@/generated/prisma/enums";
import {
  type BodyAngleReading,
  computeBodyAngles,
  LANDMARK_INDEX,
  type PoseLandmark,
  type PoseLandmarks,
} from "./angles";

// Builds a full 33-entry landmarks array (computeBodyAngles indexes into a
// fixed-length array), with named-index overrides for the joints a given
// test actually cares about. Unused landmarks are filled with an arbitrary
// placeholder — computeBodyAngles never reads them, *except* NOSE and the
// shoulders, which every call needs for NECK's facing-direction check
// regardless of which region a given test is actually exercising. Default
// them to a non-degenerate "facing right" arrangement so KNEE/TRUNK/etc.
// tests that don't care about NECK don't trip that check by coincidentally
// leaving nose.x equal to the shoulder-midpoint x (both at the placeholder
// origin).
function makeLandmarks(
  overrides: Partial<
    Record<number, { x: number; y: number; visibility?: number }>
  >,
): PoseLandmarks {
  const placeholder: PoseLandmark = { x: 0, y: 0, z: 0, visibility: 1 };
  const landmarks: PoseLandmark[] = Array.from({ length: 33 }, () => ({
    ...placeholder,
  }));
  landmarks[LANDMARK_INDEX.NOSE] = { x: 0.55, y: 0.3, z: 0, visibility: 1 };
  landmarks[LANDMARK_INDEX.LEFT_SHOULDER] = {
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 1,
  };
  landmarks[LANDMARK_INDEX.RIGHT_SHOULDER] = {
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 1,
  };
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

// Mirrors both left and right landmark indices to the same point — the
// formulas average left/right, so a bilaterally symmetric synthetic pose
// keeps the arithmetic simple without weakening what's being tested (the
// per-side geometry is identical regardless of which side's index is used).
function bilateral(
  overrides: Partial<
    Record<
      "SHOULDER" | "ELBOW" | "WRIST" | "HIP" | "KNEE" | "ANKLE" | "EAR",
      { x: number; y: number }
    >
  >,
): Partial<Record<number, { x: number; y: number }>> {
  const result: Partial<Record<number, { x: number; y: number }>> = {};
  for (const [name, point] of Object.entries(overrides)) {
    if (!point) continue;
    const leftKey = `LEFT_${name}` as keyof typeof LANDMARK_INDEX;
    const rightKey = `RIGHT_${name}` as keyof typeof LANDMARK_INDEX;
    result[LANDMARK_INDEX[leftKey]] = point;
    result[LANDMARK_INDEX[rightKey]] = point;
  }
  return result;
}

// Asserts a reading succeeded and its degrees match, in one call — every
// existing call site reads `.degrees` off a reading that's expected to be
// `ok`, so this just keeps that pattern from being repeated at every
// assertion.
function expectDegrees(
  reading: BodyAngleReading,
  expected: number,
  precision = 5,
) {
  expect(reading.ok).toBe(true);
  if (reading.ok) {
    expect(reading.degrees).toBeCloseTo(expected, precision);
  }
}

describe("computeBodyAngles", () => {
  describe("TRUNK: 180 - angle(shoulder, hip, knee)", () => {
    it("neutral standing (shoulder/hip/knee colinear) is ~0°", () => {
      const landmarks = makeLandmarks(
        bilateral({
          SHOULDER: { x: 0.5, y: 0.5 },
          HIP: { x: 0.5, y: 0.7 },
          KNEE: { x: 0.5, y: 0.9 },
        }),
      );
      expectDegrees(
        computeBodyAngles(landmarks, CameraAngle.SAGITTAL).TRUNK,
        0,
      );
    });

    it("bending forward at the hip gives a clearly positive angle", () => {
      const landmarks = makeLandmarks(
        bilateral({
          SHOULDER: { x: 0.7, y: 0.55 },
          HIP: { x: 0.5, y: 0.7 },
          KNEE: { x: 0.5, y: 0.9 },
        }),
      );
      expectDegrees(
        computeBodyAngles(landmarks, CameraAngle.SAGITTAL).TRUNK,
        53.13,
        1,
      );
    });
  });

  describe("SHOULDER_LEFT/RIGHT: angle(hip, shoulder, elbow) — 0° at neutral, no 180-minus", () => {
    it("arm hanging at the side (shoulder/hip/elbow roughly vertical) is ~0°", () => {
      const landmarks = makeLandmarks(
        bilateral({
          SHOULDER: { x: 0.5, y: 0.5 },
          HIP: { x: 0.5, y: 0.7 },
          ELBOW: { x: 0.5, y: 0.65 },
        }),
      );
      const result = computeBodyAngles(landmarks, CameraAngle.SAGITTAL);
      expectDegrees(result.SHOULDER_LEFT, 0);
      expectDegrees(result.SHOULDER_RIGHT, 0);
    });

    it("arm raised to horizontal gives ~90°", () => {
      const landmarks = makeLandmarks(
        bilateral({
          SHOULDER: { x: 0.5, y: 0.5 },
          HIP: { x: 0.5, y: 0.7 },
          ELBOW: { x: 0.7, y: 0.5 },
        }),
      );
      const result = computeBodyAngles(landmarks, CameraAngle.SAGITTAL);
      expectDegrees(result.SHOULDER_LEFT, 90);
      expectDegrees(result.SHOULDER_RIGHT, 90);
    });
  });

  describe("ELBOW_LEFT/RIGHT: 180 - angle(shoulder, elbow, wrist)", () => {
    it("arm straight (shoulder/elbow/wrist colinear) is ~0°", () => {
      const landmarks = makeLandmarks(
        bilateral({
          SHOULDER: { x: 0.5, y: 0.5 },
          ELBOW: { x: 0.5, y: 0.65 },
          WRIST: { x: 0.5, y: 0.8 },
        }),
      );
      const result = computeBodyAngles(landmarks, CameraAngle.SAGITTAL);
      expectDegrees(result.ELBOW_LEFT, 0);
      expectDegrees(result.ELBOW_RIGHT, 0);
    });

    it("elbow bent 90° gives ~90°", () => {
      const landmarks = makeLandmarks(
        bilateral({
          SHOULDER: { x: 0.5, y: 0.5 },
          ELBOW: { x: 0.5, y: 0.65 },
          WRIST: { x: 0.65, y: 0.65 },
        }),
      );
      const result = computeBodyAngles(landmarks, CameraAngle.SAGITTAL);
      expectDegrees(result.ELBOW_LEFT, 90);
      expectDegrees(result.ELBOW_RIGHT, 90);
    });
  });

  describe("KNEE_LEFT/RIGHT: 180 - angle(hip, knee, ankle)", () => {
    it("leg straight (hip/knee/ankle colinear) is ~0°", () => {
      const landmarks = makeLandmarks(
        bilateral({
          HIP: { x: 0.5, y: 0.7 },
          KNEE: { x: 0.5, y: 0.9 },
          ANKLE: { x: 0.5, y: 1.1 },
        }),
      );
      const result = computeBodyAngles(landmarks, CameraAngle.SAGITTAL);
      expectDegrees(result.KNEE_LEFT, 0);
      expectDegrees(result.KNEE_RIGHT, 0);
    });

    it("knee bent gives a clearly positive angle", () => {
      const landmarks = makeLandmarks(
        bilateral({
          HIP: { x: 0.5, y: 0.7 },
          KNEE: { x: 0.5, y: 0.9 },
          ANKLE: { x: 0.65, y: 0.95 },
        }),
      );
      const result = computeBodyAngles(landmarks, CameraAngle.SAGITTAL);
      expectDegrees(result.KNEE_LEFT, 71.57, 1);
      expectDegrees(result.KNEE_RIGHT, 71.57, 1);
    });
  });

  describe("NECK: 180 - angle(ear, shoulder, hip), signed by facing direction", () => {
    it("neutral (ear directly above shoulder, above the hip line) is ~0°", () => {
      const landmarks = makeLandmarks({
        [LANDMARK_INDEX.NOSE]: { x: 0.55, y: 0.3 },
        ...bilateral({
          EAR: { x: 0.5, y: 0.3 },
          SHOULDER: { x: 0.5, y: 0.5 },
          HIP: { x: 0.5, y: 0.7 },
        }),
      });
      expectDegrees(computeBodyAngles(landmarks, CameraAngle.SAGITTAL).NECK, 0);
    });

    it("forward flexion (facing right, chin drops toward the facing side) is positive", () => {
      const landmarks = makeLandmarks({
        [LANDMARK_INDEX.NOSE]: { x: 0.55, y: 0.3 }, // nose.x > shoulder.x -> facing right
        ...bilateral({
          EAR: { x: 0.65, y: 0.4 }, // ear moves toward facing direction and down
          SHOULDER: { x: 0.5, y: 0.5 },
          HIP: { x: 0.5, y: 0.7 },
        }),
      });
      const neck = computeBodyAngles(landmarks, CameraAngle.SAGITTAL).NECK;
      expect(neck.ok && neck.degrees).toBeGreaterThan(0);
      expectDegrees(neck, 56.31, 1);
    });

    it("backward extension (facing right, head tips away from the facing side) is negative", () => {
      const landmarks = makeLandmarks({
        [LANDMARK_INDEX.NOSE]: { x: 0.55, y: 0.3 }, // still facing right
        ...bilateral({
          EAR: { x: 0.35, y: 0.2 }, // ear moves away from facing direction and up
          SHOULDER: { x: 0.5, y: 0.5 },
          HIP: { x: 0.5, y: 0.7 },
        }),
      });
      const neck = computeBodyAngles(landmarks, CameraAngle.SAGITTAL).NECK;
      expect(neck.ok && neck.degrees).toBeLessThan(0);
      expectDegrees(neck, -26.57, 1);
    });

    it("flexion and extension resolve to opposite signs, not the same magnitude with an ambiguous direction", () => {
      const flexed = computeBodyAngles(
        makeLandmarks({
          [LANDMARK_INDEX.NOSE]: { x: 0.55, y: 0.3 },
          ...bilateral({
            EAR: { x: 0.65, y: 0.4 },
            SHOULDER: { x: 0.5, y: 0.5 },
            HIP: { x: 0.5, y: 0.7 },
          }),
        }),
        CameraAngle.SAGITTAL,
      ).NECK;
      const extended = computeBodyAngles(
        makeLandmarks({
          [LANDMARK_INDEX.NOSE]: { x: 0.55, y: 0.3 },
          ...bilateral({
            EAR: { x: 0.35, y: 0.2 },
            SHOULDER: { x: 0.5, y: 0.5 },
            HIP: { x: 0.5, y: 0.7 },
          }),
        }),
        CameraAngle.SAGITTAL,
      ).NECK;

      expect(flexed.ok && extended.ok).toBe(true);
      if (flexed.ok && extended.ok) {
        expect(Math.sign(flexed.degrees)).not.toBe(Math.sign(extended.degrees));
      }
    });

    it("forward flexion facing LEFT is still positive (facing-direction auto-detect isn't hardcoded to one side)", () => {
      const landmarks = makeLandmarks({
        [LANDMARK_INDEX.NOSE]: { x: 0.45, y: 0.3 }, // nose.x < shoulder.x -> facing left
        ...bilateral({
          EAR: { x: 0.35, y: 0.4 }, // ear moves toward the (left) facing direction and down
          SHOULDER: { x: 0.5, y: 0.5 },
          HIP: { x: 0.5, y: 0.7 },
        }),
      });
      const neck = computeBodyAngles(landmarks, CameraAngle.SAGITTAL).NECK;
      expect(neck.ok && neck.degrees).toBeGreaterThan(0);
    });

    it("throws when facing direction can't be determined (nose exactly above the shoulder midpoint)", () => {
      const landmarks = makeLandmarks({
        [LANDMARK_INDEX.NOSE]: { x: 0.5, y: 0.3 }, // equal to shoulder-midpoint x
        ...bilateral({
          EAR: { x: 0.65, y: 0.4 },
          SHOULDER: { x: 0.5, y: 0.5 },
          HIP: { x: 0.5, y: 0.7 },
        }),
      });
      expect(() => computeBodyAngles(landmarks, CameraAngle.SAGITTAL)).toThrow(
        /cannot determine neck flexion sign/i,
      );
    });
  });

  describe("camera angle gating", () => {
    // A single neutral-standing landmarks set, reused across every gating
    // case below — what's under test here is the gate, not the geometry.
    const neutralStanding = makeLandmarks({
      [LANDMARK_INDEX.NOSE]: { x: 0.55, y: 0.3 },
      ...bilateral({
        EAR: { x: 0.5, y: 0.3 },
        SHOULDER: { x: 0.5, y: 0.5 },
        HIP: { x: 0.5, y: 0.7 },
        ELBOW: { x: 0.5, y: 0.65 },
        WRIST: { x: 0.5, y: 0.8 },
        KNEE: { x: 0.5, y: 0.9 },
        ANKLE: { x: 0.5, y: 1.1 },
      }),
    });

    it("TRUNK tagged FRONTAL is rejected rather than silently computed", () => {
      const result = computeBodyAngles(neutralStanding, CameraAngle.FRONTAL);
      expect(result.TRUNK).toEqual({
        ok: false,
        reason: "WRONG_CAMERA_ANGLE",
        requiredCameraAngle: [CameraAngle.SAGITTAL],
        actualCameraAngle: CameraAngle.FRONTAL,
      });
    });

    it("TRUNK tagged OBLIQUE is also rejected — SAGITTAL is the only accepted angle, not just 'not FRONTAL'", () => {
      const result = computeBodyAngles(neutralStanding, CameraAngle.OBLIQUE);
      expect(result.TRUNK.ok).toBe(false);
    });

    it("TRUNK tagged SAGITTAL computes normally", () => {
      const result = computeBodyAngles(neutralStanding, CameraAngle.SAGITTAL);
      expectDegrees(result.TRUNK, 0);
    });

    it("NECK tagged FRONTAL is rejected", () => {
      const result = computeBodyAngles(neutralStanding, CameraAngle.FRONTAL);
      expect(result.NECK.ok).toBe(false);
    });

    it("KNEE_LEFT and KNEE_RIGHT tagged FRONTAL are both rejected", () => {
      const result = computeBodyAngles(neutralStanding, CameraAngle.FRONTAL);
      expect(result.KNEE_LEFT.ok).toBe(false);
      expect(result.KNEE_RIGHT.ok).toBe(false);
    });

    it("ELBOW_LEFT tagged FRONTAL is rejected rather than silently computed", () => {
      const result = computeBodyAngles(neutralStanding, CameraAngle.FRONTAL);
      expect(result.ELBOW_LEFT).toEqual({
        ok: false,
        reason: "WRONG_CAMERA_ANGLE",
        requiredCameraAngle: [CameraAngle.SAGITTAL],
        actualCameraAngle: CameraAngle.FRONTAL,
      });
    });

    it("ELBOW_RIGHT tagged FRONTAL is rejected rather than silently computed", () => {
      const result = computeBodyAngles(neutralStanding, CameraAngle.FRONTAL);
      expect(result.ELBOW_RIGHT).toEqual({
        ok: false,
        reason: "WRONG_CAMERA_ANGLE",
        requiredCameraAngle: [CameraAngle.SAGITTAL],
        actualCameraAngle: CameraAngle.FRONTAL,
      });
    });

    it("ELBOW_LEFT/RIGHT tagged OBLIQUE are also rejected — SAGITTAL is the only accepted angle, not just 'not FRONTAL'", () => {
      const result = computeBodyAngles(neutralStanding, CameraAngle.OBLIQUE);
      expect(result.ELBOW_LEFT.ok).toBe(false);
      expect(result.ELBOW_RIGHT.ok).toBe(false);
    });

    it("ELBOW_LEFT/RIGHT tagged SAGITTAL compute normally", () => {
      const result = computeBodyAngles(neutralStanding, CameraAngle.SAGITTAL);
      expectDegrees(result.ELBOW_LEFT, 0);
      expectDegrees(result.ELBOW_RIGHT, 0);
    });

    it("SHOULDER_LEFT/RIGHT are NOT gated — still computed under FRONTAL", () => {
      // No CameraAngle can validate this formula reliably (sagittal
      // foreshortens lateral abduction, frontal foreshortens forward
      // flexion) — see the REQUIRED_CAMERA_ANGLE comment in angles.ts. This
      // pins down that the absence is deliberate, not an accidental gap.
      const result = computeBodyAngles(neutralStanding, CameraAngle.FRONTAL);
      expectDegrees(result.SHOULDER_LEFT, 0);
      expectDegrees(result.SHOULDER_RIGHT, 0);
    });
  });

  describe("visibility gating", () => {
    // Neutral standing pose, all landmarks at full (1.0) visibility unless
    // a specific test overrides one — this is the same baseline used by
    // "camera angle gating" above, confirming a fully-visible pose isn't
    // affected by adding the visibility gate.
    const fullyVisible = makeLandmarks({
      [LANDMARK_INDEX.NOSE]: { x: 0.55, y: 0.3 },
      ...bilateral({
        EAR: { x: 0.5, y: 0.3 },
        SHOULDER: { x: 0.5, y: 0.5 },
        HIP: { x: 0.5, y: 0.7 },
        ELBOW: { x: 0.5, y: 0.65 },
        WRIST: { x: 0.5, y: 0.8 },
        KNEE: { x: 0.5, y: 0.9 },
        ANKLE: { x: 0.5, y: 1.1 },
      }),
    });

    it("existing high-visibility fixture is unaffected: every region still computes", () => {
      const result = computeBodyAngles(fullyVisible, CameraAngle.SAGITTAL);
      expectDegrees(result.TRUNK, 0);
      expectDegrees(result.NECK, 0);
      expectDegrees(result.SHOULDER_LEFT, 0);
      expectDegrees(result.SHOULDER_RIGHT, 0);
      expectDegrees(result.ELBOW_LEFT, 0);
      expectDegrees(result.ELBOW_RIGHT, 0);
      expectDegrees(result.KNEE_LEFT, 0);
      expectDegrees(result.KNEE_RIGHT, 0);
    });

    it("TRUNK is rejected when a required landmark's visibility is below the threshold, naming it", () => {
      const landmarks = makeLandmarks({
        [LANDMARK_INDEX.NOSE]: { x: 0.55, y: 0.3 },
        ...bilateral({
          SHOULDER: { x: 0.5, y: 0.5 },
          HIP: { x: 0.5, y: 0.7 },
          KNEE: { x: 0.5, y: 0.9 },
        }),
        // Same position as the bilateral HIP override above, but this
        // entry is applied after it and wins — only leftHip's visibility
        // is degraded, rightHip stays at 1.
        [LANDMARK_INDEX.LEFT_HIP]: { x: 0.5, y: 0.7, visibility: 0.3 },
      });
      const result = computeBodyAngles(landmarks, CameraAngle.SAGITTAL);
      expect(result.TRUNK).toEqual({
        ok: false,
        reason: "INSUFFICIENT_VISIBILITY",
        failedLandmarks: [{ name: "leftHip", visibility: 0.3 }],
      });
    });

    it("NECK is rejected when nose visibility is below the threshold (not just ear/shoulder/hip)", () => {
      const landmarks = makeLandmarks({
        [LANDMARK_INDEX.NOSE]: { x: 0.55, y: 0.3, visibility: 0.4 },
        ...bilateral({
          EAR: { x: 0.5, y: 0.3 },
          SHOULDER: { x: 0.5, y: 0.5 },
          HIP: { x: 0.5, y: 0.7 },
        }),
      });
      const result = computeBodyAngles(landmarks, CameraAngle.SAGITTAL);
      expect(result.NECK).toEqual({
        ok: false,
        reason: "INSUFFICIENT_VISIBILITY",
        failedLandmarks: [{ name: "nose", visibility: 0.4 }],
      });
    });

    it("SHOULDER_LEFT is rejected on a low-visibility leftElbow, while SHOULDER_RIGHT (independent landmarks) still computes", () => {
      const landmarks = makeLandmarks({
        [LANDMARK_INDEX.NOSE]: { x: 0.55, y: 0.3 },
        ...bilateral({
          SHOULDER: { x: 0.5, y: 0.5 },
          HIP: { x: 0.5, y: 0.7 },
          ELBOW: { x: 0.5, y: 0.65 },
        }),
        [LANDMARK_INDEX.LEFT_ELBOW]: { x: 0.5, y: 0.65, visibility: 0.1 },
      });
      const result = computeBodyAngles(landmarks, CameraAngle.SAGITTAL);
      expect(result.SHOULDER_LEFT).toEqual({
        ok: false,
        reason: "INSUFFICIENT_VISIBILITY",
        failedLandmarks: [{ name: "leftElbow", visibility: 0.1 }],
      });
      expectDegrees(result.SHOULDER_RIGHT, 0);
    });

    it("lists every failed landmark, not just the first, when more than one is below threshold", () => {
      const landmarks = makeLandmarks({
        [LANDMARK_INDEX.NOSE]: { x: 0.55, y: 0.3 },
        ...bilateral({
          SHOULDER: { x: 0.5, y: 0.5 },
          HIP: { x: 0.5, y: 0.7 },
          KNEE: { x: 0.5, y: 0.9 },
        }),
        [LANDMARK_INDEX.LEFT_HIP]: { x: 0.5, y: 0.7, visibility: 0.2 },
        [LANDMARK_INDEX.RIGHT_HIP]: { x: 0.5, y: 0.7, visibility: 0.1 },
      });
      const result = computeBodyAngles(landmarks, CameraAngle.SAGITTAL);
      expect(result.TRUNK).toEqual({
        ok: false,
        reason: "INSUFFICIENT_VISIBILITY",
        failedLandmarks: [
          { name: "leftHip", visibility: 0.2 },
          { name: "rightHip", visibility: 0.1 },
        ],
      });
    });

    it("boundary: visibility exactly at the 0.5 threshold passes, just below it fails", () => {
      const passing = makeLandmarks({
        [LANDMARK_INDEX.NOSE]: { x: 0.55, y: 0.3 },
        ...bilateral({
          SHOULDER: { x: 0.5, y: 0.5 },
          HIP: { x: 0.5, y: 0.7 },
          KNEE: { x: 0.5, y: 0.9 },
        }),
        [LANDMARK_INDEX.LEFT_HIP]: { x: 0.5, y: 0.7, visibility: 0.5 },
      });
      expectDegrees(computeBodyAngles(passing, CameraAngle.SAGITTAL).TRUNK, 0);

      const failing = makeLandmarks({
        [LANDMARK_INDEX.NOSE]: { x: 0.55, y: 0.3 },
        ...bilateral({
          SHOULDER: { x: 0.5, y: 0.5 },
          HIP: { x: 0.5, y: 0.7 },
          KNEE: { x: 0.5, y: 0.9 },
        }),
        [LANDMARK_INDEX.LEFT_HIP]: { x: 0.5, y: 0.7, visibility: 0.49 },
      });
      expect(computeBodyAngles(failing, CameraAngle.SAGITTAL).TRUNK.ok).toBe(
        false,
      );
    });
  });
});
