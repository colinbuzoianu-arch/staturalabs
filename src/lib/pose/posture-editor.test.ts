import { describe, expect, it } from "vitest";
import { BodyRegion } from "@/generated/prisma/enums";
import type { RegionResult } from "@/lib/capture/types";
import { LANDMARK_INDEX, type PoseLandmark } from "./angles";
import {
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
    const next = applyJointDrag(state, elbowIndex, {
      x: current.x,
      y: current.y,
    });
    expect(next).toBe(state);
  });

  it("dragging the elbow changes only ELBOW_LEFT and its downstream wrist — shoulder and trunk are untouched", () => {
    const { state } = setup();
    const next = applyJointDrag(
      state,
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

  it("clamps a drag beyond ANATOMICAL_LIMITS before applying it", () => {
    const { state } = setup();
    const next = applyJointDrag(state, LANDMARK_INDEX.LEFT_ELBOW, {
      x: 1.5,
      y: 0.4,
    });
    expect(next.currentAngles.get("ELBOW_LEFT")).toBeCloseTo(145, 5);
  });
});

describe("resetRegion", () => {
  it("undoes a specific adjustment, leaving others intact", () => {
    const { state } = setup();
    const afterElbow = applyJointDrag(
      state,
      LANDMARK_INDEX.LEFT_ELBOW,
      ELBOW_DRAG_90,
    );
    const afterBoth = applyJointDrag(afterElbow, LANDMARK_INDEX.LEFT_KNEE, {
      x: 0.65,
      y: 0.8,
    });
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
      LANDMARK_INDEX.LEFT_ELBOW,
      ELBOW_DRAG_90,
    );
    const afterBoth = applyJointDrag(
      afterElbow,
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
      LANDMARK_INDEX.LEFT_ELBOW,
      ELBOW_DRAG_90,
    );
    expect([...step1.adjustedRegions].sort()).toEqual(["ELBOW_LEFT"]);

    const step2 = applyJointDrag(step1, LANDMARK_INDEX.RIGHT_KNEE, {
      x: 0.65,
      y: 0.8,
    });
    expect([...step2.adjustedRegions].sort()).toEqual([
      "ELBOW_LEFT",
      "KNEE_RIGHT",
    ]);

    const step3 = applyJointDrag(
      step2,
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
    });
  });

  it("summarizes an adjusted region after a drag", () => {
    const { state } = setup();
    const next = applyJointDrag(
      state,
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
    });
  });
});
