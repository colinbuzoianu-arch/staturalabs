import { describe, expect, it } from "vitest";
import { BodyRegion } from "@/generated/prisma/enums";
import type { RegionResult } from "@/lib/capture/types";
import { LANDMARK_INDEX, type PoseLandmark } from "./angles";
import { buildManikinPose } from "./manikin";
import {
  applyAngleInput,
  applyJointDrag,
  createPostureEditor,
  getRegionDelta,
  resetAll,
  resetRegion,
  type ScoringRuleRow,
} from "./posture-editor";
import { VIRTUAL_CHEST_LANDMARK_INDEX } from "./skeleton";

// A "standing, arms at sides, facing right" neutral pose where every one
// of the 8 computable regions reads ~0° — same shape as
// drag-to-angle.test.ts's own fixture, kept inside [0,1] mainly to mirror
// a real well-framed capture. Unlike drag-to-angle.test.ts (which calls
// computeAllAngles directly), createPostureEditor first runs keypoints
// through completeMissingLandmarks — but classifyLandmarkConfidence no
// longer treats an off-screen-but-plausible coordinate as "missing"
// regardless of visibility (only MediaPipe's genuine near-origin/near-zero-
// visibility degenerate signature is), so this fixture no longer strictly
// depends on staying inside [0,1] the way it once did.
function neutralLandmarks(): PoseLandmark[] {
  const placeholder: PoseLandmark = { x: 0, y: 0, z: 0, visibility: 1 };
  const landmarks: PoseLandmark[] = Array.from({ length: 33 }, () => ({
    ...placeholder,
  }));
  const set = (index: number, x: number, y: number) => {
    landmarks[index] = { x, y, z: 0, visibility: 1 };
  };
  set(LANDMARK_INDEX.NOSE, 0.55, 0.15);
  for (const side of ["LEFT", "RIGHT"] as const) {
    set(LANDMARK_INDEX[`${side}_EAR`], 0.5, 0.15);
    set(LANDMARK_INDEX[`${side}_SHOULDER`], 0.5, 0.25);
    set(LANDMARK_INDEX[`${side}_ELBOW`], 0.5, 0.4);
    set(LANDMARK_INDEX[`${side}_WRIST`], 0.5, 0.55);
    set(LANDMARK_INDEX[`${side}_HIP`], 0.5, 0.6);
    set(LANDMARK_INDEX[`${side}_KNEE`], 0.5, 0.8);
    set(LANDMARK_INDEX[`${side}_ANKLE`], 0.5, 0.95);
  }
  return landmarks;
}

const COMPUTED_REGIONS: readonly BodyRegion[] = [
  "TRUNK",
  "NECK",
  "SHOULDER_LEFT",
  "SHOULDER_RIGHT",
  "ELBOW_LEFT",
  "ELBOW_RIGHT",
  "KNEE_LEFT",
  "KNEE_RIGHT",
];

// Three flat bands per region — not a realistic methodology, just enough
// structure for a drag to visibly cross a band boundary in these tests.
function buildRules(): ScoringRuleRow[] {
  const rules: ScoringRuleRow[] = [];
  for (const region of COMPUTED_REGIONS) {
    rules.push(
      {
        bodyRegion: region,
        angleMin: null,
        angleMax: 45,
        riskBand: "LOW",
        riskScore: 1,
      },
      {
        bodyRegion: region,
        angleMin: 45,
        angleMax: 90,
        riskBand: "MODERATE",
        riskScore: 2,
      },
      {
        bodyRegion: region,
        angleMin: 90,
        angleMax: null,
        riskBand: "HIGH",
        riskScore: 3,
      },
    );
  }
  return rules;
}

// regionResults matching neutralLandmarks() exactly (every computed region
// at 0°, LOW band) — the 9 non-computed regions are "not-yet-supported",
// same as buildRegionResults would report for them.
function buildRegionResults(): Record<BodyRegion, RegionResult> {
  const results = {} as Record<BodyRegion, RegionResult>;
  for (const region of Object.values(BodyRegion)) {
    results[region] = COMPUTED_REGIONS.includes(region)
      ? {
          status: "scored",
          degrees: 0,
          riskBand: "LOW",
          riskScore: 1,
          methodologyVersion: "v-test",
        }
      : { status: "not-yet-supported" };
  }
  return results;
}

function setup() {
  const keypoints = neutralLandmarks();
  const regionResults = buildRegionResults();
  const rules = buildRules();
  const state = createPostureEditor(keypoints, regionResults, rules);
  return { keypoints, regionResults, rules, state };
}

// Elbow dragged sideways by the same relative offset (+0.15 x, same y as
// its own neutral position) that gives a hand-verified 90°: with
// shoulder=(0.5,0.25) and wrist=(0.5,0.55) fixed, elbow->shoulder=
// (-0.15,-0.15) and elbow->wrist=(-0.15,0.15) are perpendicular.
const ELBOW_DRAG_90 = { x: 0.65, y: 0.4 };

// Chest handle dragged to a point giving a hand-verified 45°: with
// hipMid=(0.5,0.6) and kneeMid=(0.5,0.8) fixed, hip->knee=(0,0.2) and
// hip->new=(0.1,-0.1) meet at an included angle of 135°, i.e. flexion 45°.
const CHEST_DRAG_45 = { x: 0.6, y: 0.5 };

describe("createPostureEditor", () => {
  it("seeds original and current angles/bands identically from a neutral pose", () => {
    const { state } = setup();
    for (const region of COMPUTED_REGIONS) {
      expect(state.originalAngles.get(region)).toBeCloseTo(0, 5);
      expect(state.currentAngles.get(region)).toBeCloseTo(0, 5);
      expect(state.originalBands.get(region)).toBe("LOW");
      expect(state.currentBands.get(region)).toBe("LOW");
    }
    expect(state.adjustedRegions.size).toBe(0);
    expect(state.currentKeypoints).toBe(state.originalKeypoints);
  });
});

describe("applyJointDrag", () => {
  it("zero movement leaves the state unchanged", () => {
    const { state } = setup();
    const elbowIndex = LANDMARK_INDEX.LEFT_ELBOW;
    const current = state.currentKeypoints[elbowIndex];
    const next = applyJointDrag(state, state.currentKeypoints, elbowIndex, {
      x: current.x,
      y: current.y,
    });
    expect(next).toBe(state);
  });

  it("dragging the elbow changes only ELBOW_LEFT and its downstream wrist — shoulder and trunk are untouched", () => {
    const { state } = setup();
    const next = applyJointDrag(
      state,
      state.currentKeypoints,
      LANDMARK_INDEX.LEFT_ELBOW,
      ELBOW_DRAG_90,
    );

    expect(next).not.toBe(state);
    expect(next.currentAngles.get("ELBOW_LEFT")).toBeCloseTo(90, 1);
    expect(next.adjustedRegions.has("ELBOW_LEFT")).toBe(true);

    // Untouched regions.
    expect(next.currentAngles.get("SHOULDER_LEFT")).toBeCloseTo(0, 5);
    expect(next.currentAngles.get("TRUNK")).toBeCloseTo(0, 5);
    expect(next.adjustedRegions.has("SHOULDER_LEFT")).toBe(false);
    expect(next.adjustedRegions.has("TRUNK")).toBe(false);

    // The elbow's own landmark position is unchanged (forward-kinematics.ts
    // rotates the WRIST around the fixed elbow vertex, never the vertex
    // itself) — only the wrist moved.
    const elbowIndex = LANDMARK_INDEX.LEFT_ELBOW;
    const wristIndex = LANDMARK_INDEX.LEFT_WRIST;
    expect(next.currentKeypoints[elbowIndex].x).toBeCloseTo(
      state.currentKeypoints[elbowIndex].x,
      10,
    );
    expect(next.currentKeypoints[elbowIndex].y).toBeCloseTo(
      state.currentKeypoints[elbowIndex].y,
      10,
    );
    const wristMoved =
      Math.abs(
        next.currentKeypoints[wristIndex].x -
          state.currentKeypoints[wristIndex].x,
      ) > 1e-6 ||
      Math.abs(
        next.currentKeypoints[wristIndex].y -
          state.currentKeypoints[wristIndex].y,
      ) > 1e-6;
    expect(wristMoved).toBe(true);
  });

  it("dragging the elbow past a band boundary updates only that region's band", () => {
    const { state } = setup();
    // 90° flexion crosses into the HIGH band per buildRules (>= 90).
    const next = applyJointDrag(
      state,
      state.currentKeypoints,
      LANDMARK_INDEX.LEFT_ELBOW,
      ELBOW_DRAG_90,
    );
    expect(next.currentBands.get("ELBOW_LEFT")).toBe("HIGH");
    expect(next.currentBands.get("SHOULDER_LEFT")).toBe("LOW");
    expect(next.originalBands.get("ELBOW_LEFT")).toBe("LOW"); // original is never touched
  });

  it("FK cascade: dragging the trunk chest handle moves the shoulders, which can change the shoulder angle/band", () => {
    const { state } = setup();
    const next = applyJointDrag(
      state,
      state.currentKeypoints,
      VIRTUAL_CHEST_LANDMARK_INDEX,
      CHEST_DRAG_45,
    );

    expect(next.adjustedRegions.has("TRUNK")).toBe(true);
    expect(next.currentAngles.get("TRUNK")).toBeCloseTo(45, 5);

    // TRUNK's rotation carries the whole upper body (shoulders, elbows,
    // wrists, head) around the hip midpoint — the shoulder landmark itself
    // must have moved even though the user never touched it directly.
    const shoulderIndex = LANDMARK_INDEX.LEFT_SHOULDER;
    const shoulderMoved =
      Math.abs(
        next.currentKeypoints[shoulderIndex].x -
          state.currentKeypoints[shoulderIndex].x,
      ) > 1e-6 ||
      Math.abs(
        next.currentKeypoints[shoulderIndex].y -
          state.currentKeypoints[shoulderIndex].y,
      ) > 1e-6;
    expect(shoulderMoved).toBe(true);

    // Only the region the user actually dragged is added to
    // adjustedRegions — a side effect on the shoulder's landmark position
    // (from the rigid rotation) doesn't retroactively mark SHOULDER_LEFT
    // as user-adjusted.
    expect(next.adjustedRegions.has("SHOULDER_LEFT")).toBe(false);
  });

  it("clamps a drag beyond ANATOMICAL_LIMITS before applying it, and records the clamp (P4)", () => {
    const { state } = setup();
    const next = applyJointDrag(
      state,
      state.currentKeypoints,
      LANDMARK_INDEX.LEFT_ELBOW,
      { x: 1.5, y: 0.4 },
    );
    expect(next.currentAngles.get("ELBOW_LEFT")).toBeCloseTo(145, 5);
    expect(getRegionDelta(next, "ELBOW_LEFT").wasClamped).toBe(true);
  });

  it("a drag well within ANATOMICAL_LIMITS does not record a clamp", () => {
    const { state } = setup();
    const next = applyJointDrag(
      state,
      state.currentKeypoints,
      LANDMARK_INDEX.LEFT_ELBOW,
      ELBOW_DRAG_90,
    );
    expect(getRegionDelta(next, "ELBOW_LEFT").wasClamped).toBe(false);
  });
});

describe("resetRegion", () => {
  it("undoes a specific adjustment, leaving others intact", () => {
    const { state } = setup();
    const afterElbow = applyJointDrag(
      state,
      state.currentKeypoints,
      LANDMARK_INDEX.LEFT_ELBOW,
      ELBOW_DRAG_90,
    );
    const afterBoth = applyJointDrag(
      afterElbow,
      afterElbow.currentKeypoints,
      LANDMARK_INDEX.LEFT_KNEE,
      { x: 0.65, y: 0.8 },
    );
    expect(afterBoth.adjustedRegions.has("ELBOW_LEFT")).toBe(true);
    expect(afterBoth.adjustedRegions.has("KNEE_LEFT")).toBe(true);
    const kneeAngleBeforeReset = afterBoth.currentAngles.get("KNEE_LEFT");
    expect(kneeAngleBeforeReset).not.toBeCloseTo(0, 1); // the knee drag actually changed something

    const reset = resetRegion(afterBoth, "ELBOW_LEFT");
    expect(reset.adjustedRegions.has("ELBOW_LEFT")).toBe(false);
    expect(reset.currentAngles.get("ELBOW_LEFT")).toBeCloseTo(0, 5);

    // The knee adjustment survives, unchanged.
    expect(reset.adjustedRegions.has("KNEE_LEFT")).toBe(true);
    expect(reset.currentAngles.get("KNEE_LEFT")).toBeCloseTo(
      kneeAngleBeforeReset as number,
      5,
    );
  });

  it("is a no-op for a region that was never adjusted", () => {
    const { state } = setup();
    const result = resetRegion(state, "SHOULDER_RIGHT");
    expect(result).toBe(state);
  });
});

describe("resetAll", () => {
  it("returns to the original state exactly", () => {
    const { state } = setup();
    const afterElbow = applyJointDrag(
      state,
      state.currentKeypoints,
      LANDMARK_INDEX.LEFT_ELBOW,
      ELBOW_DRAG_90,
    );
    const afterBoth = applyJointDrag(
      afterElbow,
      afterElbow.currentKeypoints,
      VIRTUAL_CHEST_LANDMARK_INDEX,
      CHEST_DRAG_45,
    );
    expect(afterBoth.adjustedRegions.size).toBe(2);

    const reset = resetAll(afterBoth);
    expect(reset.adjustedRegions.size).toBe(0);
    for (const region of COMPUTED_REGIONS) {
      expect(reset.currentAngles.get(region)).toBeCloseTo(
        state.currentAngles.get(region) as number,
        5,
      );
      expect(reset.currentBands.get(region)).toBe(
        state.currentBands.get(region),
      );
    }
    for (let i = 0; i < reset.currentKeypoints.length; i++) {
      expect(reset.currentKeypoints[i].x).toBeCloseTo(
        state.originalKeypoints[i].x,
        10,
      );
      expect(reset.currentKeypoints[i].y).toBeCloseTo(
        state.originalKeypoints[i].y,
        10,
      );
    }
  });

  it("is a no-op when nothing was adjusted", () => {
    const { state } = setup();
    expect(resetAll(state)).toBe(state);
  });
});

describe("adjustedRegions tracking across multiple drags and resets", () => {
  it("accumulates across drags and shrinks on individual resets, emptying on resetAll", () => {
    const { state } = setup();

    const step1 = applyJointDrag(
      state,
      state.currentKeypoints,
      LANDMARK_INDEX.LEFT_ELBOW,
      ELBOW_DRAG_90,
    );
    expect([...step1.adjustedRegions].sort()).toEqual(["ELBOW_LEFT"]);

    const step2 = applyJointDrag(
      step1,
      step1.currentKeypoints,
      LANDMARK_INDEX.RIGHT_KNEE,
      { x: 0.65, y: 0.8 },
    );
    expect([...step2.adjustedRegions].sort()).toEqual([
      "ELBOW_LEFT",
      "KNEE_RIGHT",
    ]);

    const step3 = applyJointDrag(
      step2,
      step2.currentKeypoints,
      VIRTUAL_CHEST_LANDMARK_INDEX,
      CHEST_DRAG_45,
    );
    expect([...step3.adjustedRegions].sort()).toEqual([
      "ELBOW_LEFT",
      "KNEE_RIGHT",
      "TRUNK",
    ]);

    const step4 = resetRegion(step3, "KNEE_RIGHT");
    expect([...step4.adjustedRegions].sort()).toEqual(["ELBOW_LEFT", "TRUNK"]);

    const step5 = resetAll(step4);
    expect(step5.adjustedRegions.size).toBe(0);
  });
});

describe("getRegionDelta", () => {
  it("summarizes an unadjusted region", () => {
    const { state } = setup();
    const delta = getRegionDelta(state, "SHOULDER_LEFT");
    expect(delta).toEqual({
      originalAngle: 0,
      currentAngle: 0,
      originalBand: "LOW",
      currentBand: "LOW",
      isAdjusted: false,
      wasClamped: false,
    });
  });

  it("summarizes an adjusted region after a drag", () => {
    const { state } = setup();
    const next = applyJointDrag(
      state,
      state.currentKeypoints,
      LANDMARK_INDEX.LEFT_ELBOW,
      ELBOW_DRAG_90,
    );
    const delta = getRegionDelta(next, "ELBOW_LEFT");
    expect(delta.originalAngle).toBeCloseTo(0, 5);
    expect(delta.currentAngle).toBeCloseTo(90, 1);
    expect(delta.originalBand).toBe("LOW");
    expect(delta.currentBand).toBe("HIGH");
    expect(delta.isAdjusted).toBe(true);
  });

  it("returns nulls for a region with no data at all", () => {
    const { state } = setup();
    const delta = getRegionDelta(state, "WRIST_LEFT");
    expect(delta).toEqual({
      originalAngle: null,
      currentAngle: null,
      originalBand: null,
      currentBand: null,
      isAdjusted: false,
      wasClamped: false,
    });
  });
});

// SLD_POSTURE_EDITOR_FIDELITY_PLAN.md P2's own explicit verification bar
// (§4.1, "round-trip assertion"): dragging a joint rendered at MANIKIN
// proportions must still persist in the REAL capture's own proportions —
// invariant §2.2, the single highest-risk failure mode in that whole plan.
describe("manikin-mediated drag round-trip (SLD_POSTURE_EDITOR_FIDELITY_PLAN.md P2)", () => {
  it("resolves the drag against manikin geometry but persists it in the real capture's own proportions", () => {
    const { state } = setup();
    // Built from state's own currentAngles (all ~0 for neutralLandmarks())
    // — deliberately a DIFFERENT set of proportions from the real capture:
    // manikin forearm = 0.146 * 0.85 = 0.1241, vs. neutralLandmarks' own
    // 0.15 (elbow (0.5,0.4) to wrist (0.5,0.55)).
    const manikinLandmarks = buildManikinPose(state.currentAngles);

    const manikinElbow = manikinLandmarks[LANDMARK_INDEX.LEFT_ELBOW];
    const manikinShoulder = manikinLandmarks[LANDMARK_INDEX.LEFT_SHOULDER];
    const upperArmLength = Math.hypot(
      manikinElbow.x - manikinShoulder.x,
      manikinElbow.y - manikinShoulder.y,
    );
    // A drag target that only makes sense in the MANIKIN's own coordinate
    // space — sideways by the manikin's own upper-arm length. Never a
    // valid real-capture coordinate (the real capture's own elbow sits at
    // a completely different (x, y)).
    const dragTarget = {
      x: manikinElbow.x + upperArmLength,
      y: manikinElbow.y,
    };

    const next = applyJointDrag(
      state,
      manikinLandmarks,
      LANDMARK_INDEX.LEFT_ELBOW,
      dragTarget,
    );

    // The drag resolved to a real, non-trivial angle, computed entirely
    // from manikin geometry.
    const resultingAngle = next.currentAngles.get("ELBOW_LEFT") as number;
    expect(resultingAngle).toBeGreaterThan(10);
    expect(next.adjustedRegions.has("ELBOW_LEFT")).toBe(true);

    // The elbow vertex itself never moves (forward-kinematics.ts rotates
    // the WRIST around the fixed elbow, never the vertex) — it's exactly
    // where the REAL capture had it, not anywhere near the manikin's own
    // elbow coordinates.
    const realElbowBefore = state.currentKeypoints[LANDMARK_INDEX.LEFT_ELBOW];
    const elbow = next.currentKeypoints[LANDMARK_INDEX.LEFT_ELBOW];
    expect(elbow.x).toBeCloseTo(realElbowBefore.x, 10);
    expect(elbow.y).toBeCloseTo(realElbowBefore.y, 10);

    // The forearm segment that DID rotate keeps the REAL capture's own
    // length (0.15) — never replaced by the manikin's own forearm ratio
    // (0.1241) — even though the angle that produced this rotation was
    // computed entirely from manikin geometry. This is the core assertion:
    // only the ANGLE crossed from manikin space into real space, never a
    // coordinate.
    const wrist = next.currentKeypoints[LANDMARK_INDEX.LEFT_WRIST];
    const realForearmLength = Math.hypot(wrist.x - elbow.x, wrist.y - elbow.y);
    expect(realForearmLength).toBeCloseTo(0.15, 10);
    expect(realForearmLength).not.toBeCloseTo(0.146 * 0.85, 2);

    // And the persisted wrist is nowhere near the manikin's own wrist.
    const manikinWrist = manikinLandmarks[LANDMARK_INDEX.LEFT_WRIST];
    expect(
      Math.hypot(wrist.x - manikinWrist.x, wrist.y - manikinWrist.y),
    ).toBeGreaterThan(0.1);
  });
});

// SLD_POSTURE_EDITOR_FIDELITY_PLAN.md P4: "surface `clamped` from
// computeAngleFromDrag ... silence is what makes a clamp feel like a bug."
describe("clampedRegions / wasClamped tracking (P4)", () => {
  it("clears once a subsequent drag lands back within range", () => {
    const { state } = setup();
    const clamped = applyJointDrag(
      state,
      state.currentKeypoints,
      LANDMARK_INDEX.LEFT_ELBOW,
      { x: 1.5, y: 0.4 },
    );
    expect(getRegionDelta(clamped, "ELBOW_LEFT").wasClamped).toBe(true);

    // Reference landmarks stay the ORIGINAL (unrotated) neutral pose —
    // state.currentKeypoints, not clamped.currentKeypoints — the same
    // "measure the drag against a fixed reference, apply the resulting
    // angle to wherever the real keypoints currently are" split
    // applyJointDrag's own doc comment describes for the real manikin
    // wiring: the STATE being updated (clamped) and the REFERENCE a drag
    // is measured against are independent by design (see invariant §2.1),
    // so ELBOW_DRAG_90's own known-90° geometry is reused unchanged here
    // rather than re-deriving it against the previous drag's now-rotated
    // wrist.
    const backInRange = applyJointDrag(
      clamped,
      state.currentKeypoints,
      LANDMARK_INDEX.LEFT_ELBOW,
      ELBOW_DRAG_90,
    );
    expect(getRegionDelta(backInRange, "ELBOW_LEFT").wasClamped).toBe(false);
  });

  it("applyAngleInput (the typed-angle path) records and clears a clamp the same way a drag does", () => {
    const { state } = setup();
    const overMax = applyAngleInput(state, "TRUNK", 500);
    expect(overMax.currentAngles.get("TRUNK")).toBeCloseTo(90, 10);
    expect(getRegionDelta(overMax, "TRUNK").wasClamped).toBe(true);

    const underMin = applyAngleInput(overMax, "TRUNK", -500);
    expect(underMin.currentAngles.get("TRUNK")).toBeCloseTo(0, 10);
    expect(getRegionDelta(underMin, "TRUNK").wasClamped).toBe(true);

    const inRange = applyAngleInput(underMin, "TRUNK", 30);
    expect(inRange.currentAngles.get("TRUNK")).toBeCloseTo(30, 10);
    expect(getRegionDelta(inRange, "TRUNK").wasClamped).toBe(false);
  });

  it("resetRegion clears the clamped flag along with the adjustment", () => {
    const { state } = setup();
    const clamped = applyJointDrag(
      state,
      state.currentKeypoints,
      LANDMARK_INDEX.LEFT_ELBOW,
      { x: 1.5, y: 0.4 },
    );
    expect(getRegionDelta(clamped, "ELBOW_LEFT").wasClamped).toBe(true);

    const reset = resetRegion(clamped, "ELBOW_LEFT");
    expect(getRegionDelta(reset, "ELBOW_LEFT").wasClamped).toBe(false);
  });

  it("resetAll clears every clamped flag", () => {
    const { state } = setup();
    const clamped = applyJointDrag(
      state,
      state.currentKeypoints,
      LANDMARK_INDEX.LEFT_ELBOW,
      { x: 1.5, y: 0.4 },
    );
    expect(getRegionDelta(clamped, "ELBOW_LEFT").wasClamped).toBe(true);

    const reset = resetAll(clamped);
    expect(getRegionDelta(reset, "ELBOW_LEFT").wasClamped).toBe(false);
    expect(reset.clampedRegions.size).toBe(0);
  });

  it("a second typed value that clamps to the SAME already-current angle is a true no-op (both angle and clamped status unchanged)", () => {
    const { state } = setup();
    const first = applyAngleInput(state, "TRUNK", 999);
    expect(getRegionDelta(first, "TRUNK").wasClamped).toBe(true);

    const second = applyAngleInput(first, "TRUNK", 999);
    expect(second).toBe(first);
  });
});
