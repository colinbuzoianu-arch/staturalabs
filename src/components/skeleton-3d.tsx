"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
// OrbitControls import note (per the task's own instruction to record
// which path was used): three@0.185.1 (installed in this repo) ships
// OrbitControls only under examples/jsm/controls/OrbitControls.js, but its
// package.json "exports" map aliases "three/addons/*" to that same
// examples/jsm/* path, and this project's tsconfig.json already sets
// moduleResolution: "bundler" (needed for Next.js generally), which
// resolves package "exports" maps correctly — confirmed directly with a
// throwaway probe file compiled via this project's own tsconfig before
// writing this import. No manual/homegrown orbit-rotation fallback needed.
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { BodyRegion, RiskBand } from "@/generated/prisma/enums";
import type { PoseLandmarks } from "@/lib/pose/angles";
import {
  ANATOMICAL_LIMITS,
  BODY_REGION_BONES,
  getVirtualChestPosition,
  JOINT_REGIONS,
  LANDMARK_INDEX,
  landmarksTo3DPositions,
  type SkeletonLandmarkConfidence,
  VIRTUAL_CHEST_LANDMARK_INDEX,
} from "@/lib/pose/skeleton";
import { NOT_ASSESSED_COLOR, riskBandColors } from "@/lib/risk/band-severity";

// Rotatable 3D counterpart to SkeletonViewer (the 2D/SVG renderer) — same
// "pure math in skeleton.ts, rendering here" split, and the same
// compliance posture as skeleton.ts's own COMPLIANCE NOTE: this component
// is a live, ephemeral rendering surface. It never persists anything it
// draws, the only thing that leaves this component is a drag position
// handed back to the caller in-memory via onJointDrag (never a network
// call from in here), and the entire three.js scene is created and torn
// down client-side, per mount. If this component is ever wired into
// anything beyond a live what-if view (persistence, cross-session
// comparison), re-read ERGO_COMPLIANCE_BY_DESIGN.md §3.2 first.
//
// SLD_POSTURE_EDITOR_FIDELITY_PLAN.md P3: renders a solid, neutral-grey
// mannequin (capsule limb meshes, rigid non-interactive head/hands/feet)
// rather than the old thin-line stick figure with a sphere at all 33
// landmarks — deliberately not a realistic human (see that plan's own
// "design intent, not taste" note on why an obviously synthetic figure
// matters for the workstation-not-worker framing).
//
// P5: limbs/joints below MIN_LANDMARK_VISIBILITY (angles.ts) render
// visibly distinct from a cleanly measured one — desaturated (color
// blended toward NOT_ASSESSED_COLOR) AND lower-opacity AND wireframe, all
// three stacked, driven by the same per-landmark SkeletonLandmarkConfidence
// this file already threaded through for P3's own rendering. Not a
// cosmetic choice: CLAUDE.md documents real captures with far-side limbs
// at 0.27 visibility next to 0.84+ on the near side — a figure that drew
// those identically would look more confident than the underlying
// measurement actually is.

export type Skeleton3DProps = {
  /** The landmark array to render — as of SLD_POSTURE_EDITOR_FIDELITY_PLAN.md P2, normally a manikin.ts pose built from the current 8 joint angles (fixed anthropometric proportions), not a real capture's own landmarks. Same PoseLandmarks shape landmarksTo3DPositions accepts either way — this component doesn't care which produced it. */
  keypoints: PoseLandmarks;
  /** Per-landmark confidence, keyed by MediaPipe landmark index (0-32) — typically built from classifyLandmarkConfidence or a completeMissingLandmarks result. An index with no entry is treated as "missing", the safe default — rendered faintly (low opacity, wireframe) rather than hidden, since a real skeleton should always look complete; see updateJointVisual/combineConfidence. */
  confidenceMap: ReadonlyMap<number, SkeletonLandmarkConfidence>;
  /** Which band each scored BodyRegion currently has, for limb/joint coloring. A region absent from the map (or mapped to null) renders NOT_ASSESSED_COLOR. */
  regionBands: ReadonlyMap<BodyRegion, RiskBand | null>;
  /** Landmark indices the user may drag — normally JOINT_REGIONS' keys (or a subset), including VIRTUAL_CHEST_LANDMARK_INDEX for the TRUNK handle. */
  draggableJoints: readonly number[];
  /**
   * Fires while dragging (throttled to ~30fps) and once more, unthrottled,
   * on drag end. `newPosition` is in the same three.js scene-unit space
   * landmarksTo3DPositions produces (already scaled/flipped from
   * MediaPipe's normalized image coordinates) — converting back to
   * MediaPipe space, if a caller needs that, is the caller's job, since
   * this component has no way to know whether the caller wants that
   * inverse transform applied.
   */
  onJointDrag?: (
    landmarkIndex: number,
    newPosition: { x: number; y: number; z: number },
  ) => void;
  width?: number;
  height?: number;
};

const DEFAULT_WIDTH = 500;
const DEFAULT_HEIGHT = 600;

// Sizing — "roughly human-sized" per landmarksTo3DPositions' own ~1.7-unit
// standing figure.
const JOINT_RADIUS = 0.02;
const DRAGGABLE_JOINT_RADIUS = 0.03;
const HALO_RADIUS_SCALE = 1.5;
const HOVER_SCALE = 1.2;

// Capsule radii for the solid mannequin body (P3) — one per limb "kind",
// not per BodyRegion, since e.g. both KNEE_LEFT bone segments (thigh AND
// shin) read the same LEG radius. Rough, deliberately schematic
// proportions for an "obviously synthetic" figure, not a precision
// anthropometric claim the way manikin.ts's own ratio table is — nothing
// here feeds a measurement.
const TORSO_CAPSULE_RADIUS = 0.07;
const NECK_CAPSULE_RADIUS = 0.025;
const ARM_CAPSULE_RADIUS = 0.035;
const LEG_CAPSULE_RADIUS = 0.05;

// Rigid, non-interactive extremities (P3's own "Head/Hands/Feet" spec) —
// each a single solid capsule, never articulated, never draggable.
const HEAD_RADIUS = 0.09;
const HEAD_LENGTH = 0.05;
const HAND_RADIUS = 0.03;
const HAND_LENGTH = 0.06;
const FOOT_RADIUS = 0.03;
const FOOT_LENGTH = 0.15;

// capSegments/radialSegments for every capsule mesh in this file (limbs,
// extremities, and — indirectly, via sphereGeometry's own low segment
// counts below — the draggable joint handles): deliberately low-poly, not
// smoothed for realism. Matches the "obviously a synthetic mannequin"
// design intent, and is cheap to render.
const CAPSULE_CAP_SEGMENTS = 4;
const CAPSULE_RADIAL_SEGMENTS = 8;

// BODY_REGION_BONES (skeleton.ts) is still the correct region -> segment
// map for colouring (SLD_POSTURE_EDITOR_FIDELITY_PLAN.md P3 says so
// explicitly) — this is the capsule-radius counterpart, one entry per
// region BODY_REGION_BONES actually has bones for.
const REGION_CAPSULE_RADIUS: Partial<Record<BodyRegion, number>> = {
  TRUNK: TORSO_CAPSULE_RADIUS,
  NECK: NECK_CAPSULE_RADIUS,
  SHOULDER_LEFT: ARM_CAPSULE_RADIUS,
  SHOULDER_RIGHT: ARM_CAPSULE_RADIUS,
  ELBOW_LEFT: ARM_CAPSULE_RADIUS,
  ELBOW_RIGHT: ARM_CAPSULE_RADIUS,
  KNEE_LEFT: LEG_CAPSULE_RADIUS,
  KNEE_RIGHT: LEG_CAPSULE_RADIUS,
};

// Same opacity tiers as skeleton-viewer.tsx's 2D equivalents (that file's
// own MEASURED_OPACITY/ESTIMATED_OPACITY/INFERRED_OPACITY are private
// consts, not exported — kept numerically in sync by hand, same as
// skeleton.ts's BODY_REGION_BONES duplicating that file's BONE_REGIONS).
const MEASURED_OPACITY = 1;
const ESTIMATED_OPACITY = 0.5;
const INFERRED_OPACITY = 0.3;
// completeMissingLandmarks (skeleton.ts) now guarantees its output never
// actually carries "missing" confidence except in the one documented case
// (no torso midline at all — both shoulders AND both hips degenerate). This
// is purely a safety net for that residual case: render the joint/limb
// faintly rather than hiding it outright, so the figure is always at least
// visually complete even when the underlying data genuinely couldn't place
// something.
const MISSING_OPACITY = 0.15;

const DRAG_HIGHLIGHT_COLOR = 0xffe066; // yellow/white highlight while a joint is actively being dragged
const DRAGGABLE_HALO_COLOR = 0x22d3ee; // cyan halo marking a joint as interactive, independent of its region color

const CAMERA_FOV_DEGREES = 45;
const CAMERA_NEAR = 0.05;
const CAMERA_FAR = 50;
const CAMERA_FIT_PADDING = 1.4;
const MIN_ZOOM_DISTANCE = 0.8;
const MAX_ZOOM_DISTANCE = 8;

// Iterations for the drag-clamp bisection below — cheap (a handful of
// vector ops per iteration), run at most once per pointermove.
const BISECTION_ITERATIONS = 16;
const DRAG_EMIT_INTERVAL_MS = 1000 / 30;
// Alternating-projection iterations for enforceRigidConstraints below — a
// joint dragged under two simultaneous distance constraints (a shoulder,
// against both the other shoulder and the same-side hip) can't generally
// satisfy both exactly with one projection each; a handful of rounds
// converges close enough for a soft, transient drag preview. Single-
// constraint joints (elbow, knee, trunk, neck) already sit exactly on
// their one sphere after the first round — the extra rounds are a no-op
// for them, not wasted precision.
const RIGID_CONSTRAINT_ITERATIONS = 4;

// ---------------------------------------------------------------------
// Confidence styling — mirrors skeleton-viewer.tsx's combineConfidence
// (weakest endpoint wins) and opacity tiers, reimplemented locally for the
// same reason skeleton.ts's BODY_REGION_BONES reimplements that file's
// BONE_REGIONS: skeleton-viewer.tsx is a 2D/SVG client component with
// nothing exported for this, and duplicating a few lines beats importing
// across renderer boundaries.
// ---------------------------------------------------------------------
type ConfidenceStyle = "measured" | "estimated" | "inferred";

function getConfidence(
  confidenceMap: ReadonlyMap<number, SkeletonLandmarkConfidence>,
  index: number,
): SkeletonLandmarkConfidence {
  return confidenceMap.get(index) ?? "missing";
}

// A limb with a "missing" endpoint used to be skipped (not drawn) entirely
// — now drawn "inferred" (the faintest tier already in this file) instead,
// same "always visually complete, never a gap" contract
// completeMissingLandmarks' own final fallback pass now guarantees at the
// data level. This function itself can still receive "missing" (see
// getConfidence's fallback above, and the one residual case
// completeMissingLandmarks documents), so it's the one place that still
// has to decide what to do with it — draw faintly, never hide.
function combineConfidence(
  a: SkeletonLandmarkConfidence,
  b: SkeletonLandmarkConfidence,
): ConfidenceStyle {
  if (a === "missing" || b === "missing") return "inferred";
  if (a === "inferred" || b === "inferred") return "inferred";
  if (a === "estimated" || b === "estimated") return "estimated";
  return "measured";
}

function opacityFor(style: "measured" | "estimated" | "inferred"): number {
  if (style === "measured") return MEASURED_OPACITY;
  return style === "estimated" ? ESTIMATED_OPACITY : INFERRED_OPACITY;
}

// Every material-opacity decision in this file (joints, limbs, and the
// rigid extremities) funnels through this one function — the single place
// that adds the "missing" tier combineConfidence's own return type
// deliberately excludes (a bone's combined confidence collapses "missing"
// into "inferred" at the pair level; a single landmark's own raw
// confidence, e.g. a joint handle or an extremity anchored on one
// landmark, can still be "missing" itself).
function opacityForConfidence(confidence: SkeletonLandmarkConfidence): number {
  if (confidence === "measured") return MEASURED_OPACITY;
  if (confidence === "missing") return MISSING_OPACITY;
  return opacityFor(confidence);
}

// P5's own second signal, stacked on top of opacity/wireframe rather than
// replacing them: how far a limb/joint's risk-band color gets blended
// toward NOT_ASSESSED_COLOR (the same grey this app already uses for "no
// data" everywhere else — riskBandColors/band-severity.ts). Opacity alone
// can still read as "confidently HIGH-risk-red, just a bit see-through" —
// desaturating the color itself is what actually says "we're not sure
// this reading is right," which is the truthful claim for a region below
// MIN_LANDMARK_VISIBILITY. 0 at "measured" (no change at all).
const CONFIDENCE_DESATURATION: Record<SkeletonLandmarkConfidence, number> = {
  measured: 0,
  estimated: 0.45,
  inferred: 0.7,
  missing: 0.85,
};

const DESATURATION_TARGET = new THREE.Color(NOT_ASSESSED_COLOR);

// Blends `baseColor` toward DESATURATION_TARGET by CONFIDENCE_DESATURATION's
// own per-tier amount — returns a fresh THREE.Color every call (cheap,
// three numbers) rather than mutating a shared instance, since every
// caller immediately hands the result to a material's own .color.copy().
function desaturateColor(
  baseColor: string,
  confidence: SkeletonLandmarkConfidence,
): THREE.Color {
  return new THREE.Color(baseColor).lerp(
    DESATURATION_TARGET,
    CONFIDENCE_DESATURATION[confidence],
  );
}

// The synthetic chest joint has no MediaPipe visibility of its own — it's
// only ever drawable when both shoulders (the real landmarks it's a
// midpoint of) are themselves usable. Deliberately collapsed to a plain
// measured/missing distinction rather than propagating estimated/inferred
// granularity from two different landmarks.
function chestConfidence(
  confidenceMap: ReadonlyMap<number, SkeletonLandmarkConfidence>,
): SkeletonLandmarkConfidence {
  const left = getConfidence(confidenceMap, LANDMARK_INDEX.LEFT_SHOULDER);
  const right = getConfidence(confidenceMap, LANDMARK_INDEX.RIGHT_SHOULDER);
  return left === "missing" || right === "missing" ? "missing" : "measured";
}

// ---------------------------------------------------------------------
// Angle geometry for drag-clamping. Deliberately 3D (THREE.Vector3.angleTo
// rather than a 2D-only formula) — this is a live 3D drag interaction, not
// the 2D scoring pipeline (see CLAUDE.md: z never feeds scoring geometry).
// ---------------------------------------------------------------------
function angleAtDegrees(
  vertex: THREE.Vector3,
  a: THREE.Vector3,
  c: THREE.Vector3,
): number {
  const va = a.clone().sub(vertex);
  const vc = c.clone().sub(vertex);
  if (va.lengthSq() === 0 || vc.lengthSq() === 0) return 0;
  return THREE.MathUtils.radToDeg(va.angleTo(vc));
}

function midpoint(a: THREE.Vector3, b: THREE.Vector3): THREE.Vector3 {
  return a.clone().add(b).multiplyScalar(0.5);
}

type FlexionMeasurer = (trial: THREE.Vector3) => number;

type SimpleJointConfig = {
  parentIndex: number;
  childIndex: number;
  toFlexion: (includedDeg: number) => number;
};

// SHOULDER/ELBOW/KNEE per JOINT_REGIONS all mark the region's OWN vertex
// landmark as draggable (e.g. LEFT_ELBOW for ELBOW_LEFT) — the exact same
// (parent, vertex, child) triple angles.ts's own formulas read for that
// region, with the dragged point playing the vertex role and parent/child
// read from their current (this-drag-unmoved) positions. toFlexion matches
// angles.ts exactly: SHOULDER reports the raw included angle (already 0°
// at neutral), ELBOW/KNEE report 180-included.
const SIMPLE_JOINT_PARENT_CHILD: Partial<Record<number, SimpleJointConfig>> = {
  [LANDMARK_INDEX.LEFT_SHOULDER]: {
    parentIndex: LANDMARK_INDEX.LEFT_HIP,
    childIndex: LANDMARK_INDEX.LEFT_ELBOW,
    toFlexion: (included) => included,
  },
  [LANDMARK_INDEX.RIGHT_SHOULDER]: {
    parentIndex: LANDMARK_INDEX.RIGHT_HIP,
    childIndex: LANDMARK_INDEX.RIGHT_ELBOW,
    toFlexion: (included) => included,
  },
  [LANDMARK_INDEX.LEFT_ELBOW]: {
    parentIndex: LANDMARK_INDEX.LEFT_SHOULDER,
    childIndex: LANDMARK_INDEX.LEFT_WRIST,
    toFlexion: (included) => 180 - included,
  },
  [LANDMARK_INDEX.RIGHT_ELBOW]: {
    parentIndex: LANDMARK_INDEX.RIGHT_SHOULDER,
    childIndex: LANDMARK_INDEX.RIGHT_WRIST,
    toFlexion: (included) => 180 - included,
  },
  [LANDMARK_INDEX.LEFT_KNEE]: {
    parentIndex: LANDMARK_INDEX.LEFT_HIP,
    childIndex: LANDMARK_INDEX.LEFT_ANKLE,
    toFlexion: (included) => 180 - included,
  },
  [LANDMARK_INDEX.RIGHT_KNEE]: {
    parentIndex: LANDMARK_INDEX.RIGHT_HIP,
    childIndex: LANDMARK_INDEX.RIGHT_ANKLE,
    toFlexion: (included) => 180 - included,
  },
};

// Builds a closure measuring flexion-from-neutral degrees for `landmarkIndex`
// as a function of a trial position for that one landmark, holding every
// other landmark fixed at its current (drag-start) position — used both to
// evaluate ANATOMICAL_LIMITS and to bisect toward the boundary in
// clampAlongDragPath. Returns null when this component has no clamp
// geometry for that index (no JOINT_REGIONS entry) or when NECK's facing
// direction is momentarily indeterminate (nose.x exactly at the shoulder
// midpoint) — same degenerate case angles.ts's signedNeckFlexion throws on,
// but this is a soft visualization constraint, not the scoring pipeline, so
// it degrades to "don't clamp this drag" rather than crashing the UI.
function buildMeasurer(
  landmarkIndex: number,
  positions: readonly THREE.Vector3[],
): FlexionMeasurer | null {
  if (landmarkIndex === VIRTUAL_CHEST_LANDMARK_INDEX) {
    // TRUNK: matches forward-kinematics.ts's applyTrunkRotation exactly —
    // vertex=hipMid (fixed), parent=kneeMid (fixed), child=the dragged
    // chest point (standing in for shoulderMid).
    const hipMid = midpoint(
      positions[LANDMARK_INDEX.LEFT_HIP],
      positions[LANDMARK_INDEX.RIGHT_HIP],
    );
    const kneeMid = midpoint(
      positions[LANDMARK_INDEX.LEFT_KNEE],
      positions[LANDMARK_INDEX.RIGHT_KNEE],
    );
    return (trial) => 180 - angleAtDegrees(hipMid, kneeMid, trial);
  }

  if (landmarkIndex === LANDMARK_INDEX.NOSE) {
    // NECK: matches forward-kinematics.ts's applyNeckRotation — vertex=
    // shoulderMid (fixed), signed by facing direction rather than a plain
    // 180-flip. facingSign is fixed at drag-start (from the pre-drag nose
    // position) rather than recomputed per trial point, so a trial
    // crossing exactly over the shoulder midpoint mid-bisection can't
    // introduce a sign discontinuity into the search.
    const shoulderMid = midpoint(
      positions[LANDMARK_INDEX.LEFT_SHOULDER],
      positions[LANDMARK_INDEX.RIGHT_SHOULDER],
    );
    const hipMid = midpoint(
      positions[LANDMARK_INDEX.LEFT_HIP],
      positions[LANDMARK_INDEX.RIGHT_HIP],
    );
    const facingSign = Math.sign(
      positions[LANDMARK_INDEX.NOSE].x - shoulderMid.x,
    );
    if (facingSign === 0) return null;
    return (trial) =>
      (180 - angleAtDegrees(shoulderMid, hipMid, trial)) * facingSign;
  }

  const simple = SIMPLE_JOINT_PARENT_CHILD[landmarkIndex];
  if (!simple) return null;
  const parentPos = positions[simple.parentIndex];
  const childPos = positions[simple.childIndex];
  return (trial) =>
    simple.toFlexion(angleAtDegrees(trial, parentPos, childPos));
}

// ---------------------------------------------------------------------
// Rigid bone-length constraints for live dragging. A human skeleton has
// fixed bone lengths — dragging a joint should rotate it around its pivot,
// not translate it freely, or the torso/limb it's attached to visibly
// stretches or compresses while the pointer moves. VISUALIZATION ONLY:
// this never touches computeBodyAngles or a ScoringRule lookup, only the
// LIVE, in-progress drag position rendered on every pointermove — the
// angle actually reported/applied is still derived purely from landmark
// positions, exactly as before. This exists specifically because that
// live preview (rebuildScene's per-frame `override`, throttled separately
// from the ~30fps callback to the parent — see handleDragMove below) was
// otherwise showing an UNCONSTRAINED raw raycast position between the
// periodic corrections forward-kinematics.ts's own rigid rotation
// provides once the parent's state round-trips (see that file's own
// bone-length-preservation test) — correct eventually, disproportionate
// in between.
// ---------------------------------------------------------------------
type RigidConstraint = { pivot: THREE.Vector3; radius: number };

function projectOntoSphere(
  point: THREE.Vector3,
  pivot: THREE.Vector3,
  radius: number,
): THREE.Vector3 {
  const offset = point.clone().sub(pivot);
  if (offset.lengthSq() === 0) {
    // Degenerate: the candidate point coincides exactly with its own pivot
    // (zero-length offset has no direction to preserve) — pick an
    // arbitrary direction rather than normalizing a zero vector into NaN.
    // Not expected from a real raycasted drag position; a defensive floor,
    // not a case this drag interaction can actually produce.
    return pivot.clone().add(new THREE.Vector3(radius, 0, 0));
  }
  return pivot.clone().add(offset.normalize().multiplyScalar(radius));
}

// Projects `point` onto every constraint's sphere in turn, repeated a few
// times (RIGID_CONSTRAINT_ITERATIONS) so that a joint under TWO
// simultaneous constraints (a shoulder: same-side hip AND the other
// shoulder) converges close to satisfying both, rather than exactly
// solving the generally two-point intersection of two spheres — this is
// the LIVE-DRAG preview, not the committed pose (forward-kinematics.ts's
// exact rigid rotation is what actually gets persisted once the drag
// ends), so a cheap iterative approximation recomputed on every
// pointermove is the right trade here, not a closed-form solve. A single-
// constraint joint (elbow, knee, trunk, neck) already lands exactly on its
// one sphere after the first round.
function enforceRigidConstraints(
  point: THREE.Vector3,
  constraints: readonly RigidConstraint[],
): THREE.Vector3 {
  if (constraints.length === 0) return point;
  let result = point.clone();
  for (
    let iteration = 0;
    iteration < RIGID_CONSTRAINT_ITERATIONS;
    iteration++
  ) {
    for (const { pivot, radius } of constraints) {
      result = projectOntoSphere(result, pivot, radius);
    }
  }
  return result;
}

// Builds the distance constraint(s) for `landmarkIndex`, from its CURRENT
// (pre-drag) positions — captured once at drag start (see onPointerDown)
// since every other landmark's rendered position stays fixed for the
// duration of a single-joint drag (rebuildScene's override only ever
// repositions the one dragged index). Mirrors buildMeasurer's own
// per-region structure and pivot choices exactly, so the rigid constraint
// and the angular clamp always agree on what's "fixed" versus "moving":
//   - TRUNK (virtual chest): one constraint, pivot=hipMid — the same fixed
//     vertex buildMeasurer's own TRUNK case measures from.
//   - NECK (nose): one constraint, pivot=shoulderMid — same as buildMeasurer.
//   - SHOULDER_LEFT/RIGHT: TWO constraints — same-side hip (torso length)
//     AND the other shoulder (shoulder width), per the reported bug's own
//     two symptoms ("shoulder-to-shoulder distance changes... same for
//     hip-to-hip").
//   - ELBOW_LEFT/RIGHT: one constraint, pivot=same-side shoulder (upper
//     arm length) — matches buildMeasurer's own `parentIndex`.
//   - KNEE_LEFT/RIGHT: one constraint, pivot=same-side hip (thigh length)
//     — matches buildMeasurer's own `parentIndex`.
//
// WRIST/ANKLE/HIP no longer appear here — they were POSITION_ONLY_REGIONS
// draggable joints under the old model, removed entirely in P1 of
// SLD_POSTURE_EDITOR_FIDELITY_PLAN.md (never draggable now, so no rigid
// constraint is needed for them either).
function buildRigidConstraints(
  landmarkIndex: number,
  positions: readonly THREE.Vector3[],
): readonly RigidConstraint[] {
  if (landmarkIndex === VIRTUAL_CHEST_LANDMARK_INDEX) {
    const hipMid = midpoint(
      positions[LANDMARK_INDEX.LEFT_HIP],
      positions[LANDMARK_INDEX.RIGHT_HIP],
    );
    const shoulderMid = getVirtualChestPosition(positions);
    return [{ pivot: hipMid, radius: hipMid.distanceTo(shoulderMid) }];
  }

  if (landmarkIndex === LANDMARK_INDEX.NOSE) {
    const shoulderMid = midpoint(
      positions[LANDMARK_INDEX.LEFT_SHOULDER],
      positions[LANDMARK_INDEX.RIGHT_SHOULDER],
    );
    return [
      {
        pivot: shoulderMid,
        radius: shoulderMid.distanceTo(positions[LANDMARK_INDEX.NOSE]),
      },
    ];
  }

  if (
    landmarkIndex === LANDMARK_INDEX.LEFT_SHOULDER ||
    landmarkIndex === LANDMARK_INDEX.RIGHT_SHOULDER
  ) {
    const isLeft = landmarkIndex === LANDMARK_INDEX.LEFT_SHOULDER;
    const hipIndex = isLeft
      ? LANDMARK_INDEX.LEFT_HIP
      : LANDMARK_INDEX.RIGHT_HIP;
    const otherShoulderIndex = isLeft
      ? LANDMARK_INDEX.RIGHT_SHOULDER
      : LANDMARK_INDEX.LEFT_SHOULDER;
    const shoulderPos = positions[landmarkIndex];
    const hipPos = positions[hipIndex];
    const otherShoulderPos = positions[otherShoulderIndex];
    return [
      { pivot: hipPos, radius: hipPos.distanceTo(shoulderPos) },
      {
        pivot: otherShoulderPos,
        radius: otherShoulderPos.distanceTo(shoulderPos),
      },
    ];
  }

  if (
    landmarkIndex === LANDMARK_INDEX.LEFT_ELBOW ||
    landmarkIndex === LANDMARK_INDEX.RIGHT_ELBOW
  ) {
    const isLeft = landmarkIndex === LANDMARK_INDEX.LEFT_ELBOW;
    const shoulderIndex = isLeft
      ? LANDMARK_INDEX.LEFT_SHOULDER
      : LANDMARK_INDEX.RIGHT_SHOULDER;
    const shoulderPos = positions[shoulderIndex];
    const elbowPos = positions[landmarkIndex];
    return [{ pivot: shoulderPos, radius: shoulderPos.distanceTo(elbowPos) }];
  }

  if (
    landmarkIndex === LANDMARK_INDEX.LEFT_KNEE ||
    landmarkIndex === LANDMARK_INDEX.RIGHT_KNEE
  ) {
    const isLeft = landmarkIndex === LANDMARK_INDEX.LEFT_KNEE;
    const hipIndex = isLeft
      ? LANDMARK_INDEX.LEFT_HIP
      : LANDMARK_INDEX.RIGHT_HIP;
    const hipPos = positions[hipIndex];
    const kneePos = positions[landmarkIndex];
    return [{ pivot: hipPos, radius: hipPos.distanceTo(kneePos) }];
  }

  // Anything else (never a draggable joint) falls through to no constraint.
  return [];
}

// Finds, via bisection along the straight-line path from `from` (the
// joint's pre-drag position, assumed to already satisfy [min, max]) to
// `to` (the raw drag candidate, which may not), the furthest point along
// that path still inside [min, max] — a "soft clamp" that stops the drag
// right at the boundary rather than snapping to a single canonical
// posture. Works uniformly regardless of whether the dragged landmark
// plays the vertex or the child role in its own angle formula (see
// buildMeasurer): it only ever evaluates `measure` at trial points, never
// needs to know which role it's in. If `from` itself is already out of
// range (e.g. ANATOMICAL_LIMITS tightened since the pose was posed), holds
// at `from` rather than making things worse.
//
// `project`, if given, is applied to every candidate BEFORE `measure` sees
// it — every returned point (and every point fed to `measure` along the
// way) is one `project` already resolved, not something layered on
// afterward. That matters: a straight lerp between two points that both
// satisfy `project` (e.g. both already the correct bone length from a
// pivot) does NOT generally stay at that same distance for points strictly
// between them — projecting only the final answer would let intermediate
// bisection steps evaluate `measure` against a point that's momentarily
// the wrong bone length, and could return a final point that's off by the
// same small (chord-vs-arc) amount. Passing `project` in here instead
// keeps every candidate, at every step, exactly on the caller's rigid
// constraint — see enforceRigidConstraints above, this function's only
// current caller for it.
function clampAlongDragPath(
  from: THREE.Vector3,
  to: THREE.Vector3,
  min: number,
  max: number,
  measure: FlexionMeasurer,
  project?: (point: THREE.Vector3) => THREE.Vector3,
): THREE.Vector3 {
  const EPSILON = 1e-6;
  const applyProject = (point: THREE.Vector3) =>
    project ? project(point) : point;
  const inRange = (deg: number) => deg >= min - EPSILON && deg <= max + EPSILON;

  const projectedTo = applyProject(to);
  if (inRange(measure(projectedTo))) return projectedTo;
  const projectedFrom = applyProject(from);
  if (!inRange(measure(projectedFrom))) return projectedFrom;

  let lo = 0;
  let hi = 1;
  for (let i = 0; i < BISECTION_ITERATIONS; i++) {
    const mid = (lo + hi) / 2;
    const point = applyProject(from.clone().lerp(to, mid));
    if (inRange(measure(point))) lo = mid;
    else hi = mid;
  }
  return applyProject(from.clone().lerp(to, lo));
}

// ---------------------------------------------------------------------
// Solid-mannequin capsule geometry (P3). Every capsule mesh in this file
// (limbs and the rigid extremities alike) shares ONE unit CapsuleGeometry
// (radius=1, cylindrical length=1) — same "create once, reposition every
// render" discipline the old thin-line bones and joint spheres already
// used — and is fit to its actual span every render via orientCapsuleMesh
// below: position = center, rotation = aligning the capsule's local +Y to
// `direction`, scale = (radius, length, radius). Scaling X/Z and Y
// independently does mean the hemispherical end caps render slightly
// egg-shaped rather than perfectly round once radius and length differ
// (always, for an elongated limb) — an accepted trade for a stylized,
// obviously-synthetic mannequin, not a defect to chase.
// ---------------------------------------------------------------------
const CAPSULE_UP_AXIS = new THREE.Vector3(0, 1, 0);

function orientCapsuleMesh(
  mesh: THREE.Mesh,
  center: THREE.Vector3,
  direction: THREE.Vector3,
  radius: number,
  length: number,
) {
  mesh.position.copy(center);
  if (direction.lengthSq() > 0) {
    mesh.quaternion.setFromUnitVectors(
      CAPSULE_UP_AXIS,
      direction.clone().normalize(),
    );
  }
  mesh.scale.set(radius, length, radius);
}

const WORLD_FORWARD = new THREE.Vector3(1, 0, 0);
const WORLD_LATERAL = new THREE.Vector3(0, 0, 1);

// The foot's own "fixed at 90° to the shank" placement (P3's own spec,
// "the anthropometric neutral convention, not an approximation"): the
// component of world-forward (+X — this app's own "front of the
// mannequin" convention, see manikin.ts's coordinate-convention comment)
// perpendicular to the CURRENT shank direction — a live Gram-Schmidt
// projection, not a fixed absolute direction, so the foot stays exactly
// perpendicular to the shank no matter how much KNEE flexion has rotated
// it (ANKLE has no scoring rule and never rotates independently — see
// that plan's own note that this changes no number anywhere).
function perpendicularForward(shankDirection: THREE.Vector3): THREE.Vector3 {
  const shank = shankDirection.clone().normalize();
  const forward = WORLD_FORWARD.clone().sub(
    shank.clone().multiplyScalar(WORLD_FORWARD.dot(shank)),
  );
  if (forward.lengthSq() > 1e-8) return forward.normalize();
  // Degenerate: the shank is exactly parallel to world-forward (a figure
  // lying on its side, facing the camera) — WORLD_LATERAL is guaranteed
  // non-parallel to it in that case, so it's a safe fallback reference
  // rather than normalizing a near-zero vector into NaN.
  const lateral = WORLD_LATERAL.clone().sub(
    shank.clone().multiplyScalar(WORLD_LATERAL.dot(shank)),
  );
  return lateral.normalize();
}

// ---------------------------------------------------------------------
// Scene state — every mutable three.js object for one mounted instance,
// held in a ref (never React state, so a joint drag never triggers a
// React re-render; only the on-demand render loop below repaints).
// ---------------------------------------------------------------------
type JointVisual = {
  group: THREE.Group;
  core: THREE.Mesh;
  halo: THREE.Mesh;
};

// One capsule per BODY_REGION_BONES segment (14 total: 4 TRUNK + 2 NECK +
// 1 each SHOULDER_LEFT/RIGHT/ELBOW_LEFT/RIGHT + 2 each KNEE_LEFT/RIGHT) —
// `a`/`b` are the two landmark indices it spans, `region` and `radius` are
// fixed at mount (BODY_REGION_BONES/REGION_CAPSULE_RADIUS never change at
// runtime), so only position/orientation/color/opacity are recomputed per
// render.
type LimbVisual = {
  mesh: THREE.Mesh;
  a: number;
  b: number;
  region: BodyRegion;
  radius: number;
};

// The five rigid, non-interactive extremities P3 specifies: one head
// (oriented along the neck vector, anchored on NOSE — see JOINT_REGIONS'
// own comment on why NOSE is the NECK pivot), one hand per side (anchored
// on WRIST, oriented "neutral to the forearm"), one foot per side
// (anchored on ANKLE, oriented perpendicularForward from the shank —
// "fixed at 90° to the shank"). None of these have a BodyRegion or a
// drag handle — they're never scored and never move independently of
// their parent limb.
type Extremities = {
  head: THREE.Mesh;
  handLeft: THREE.Mesh;
  handRight: THREE.Mesh;
  footLeft: THREE.Mesh;
  footRight: THREE.Mesh;
};

type DragState = {
  landmarkIndex: number;
  pointerId: number;
  plane: THREE.Plane;
  fromPosition: THREE.Vector3;
  measure: FlexionMeasurer | null;
  limits: { min: number; max: number } | null;
  lastEmitTime: number;
  rigidConstraints: readonly RigidConstraint[];
};

type SceneState = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  raycaster: THREE.Raycaster;
  pointer: THREE.Vector2;
  limbs: LimbVisual[];
  extremities: Extremities;
  joints: Map<number, JointVisual>;
  renderRequested: boolean;
  animationFrameId: number | null;
  initialView: { position: THREE.Vector3; target: THREE.Vector3 } | null;
  hoveredIndex: number | null;
  drag: DragState | null;
};

type SceneData = {
  keypoints: PoseLandmarks;
  confidenceMap: ReadonlyMap<number, SkeletonLandmarkConfidence>;
  regionBands: ReadonlyMap<BodyRegion, RiskBand | null>;
  draggableJoints: readonly number[];
};

// Schedules exactly one render on the next animation frame, no matter how
// many callers ask for one in the meantime — this is the entire "only
// re-render when something changes, don't spin the loop when idle"
// contract: nothing here loops on its own; every call site (OrbitControls'
// 'change' event, a geometry rebuild, a drag move, a resize) triggers this
// once, and there is otherwise no running rAF loop at all.
function scheduleRender(state: SceneState) {
  if (state.renderRequested) return;
  state.renderRequested = true;
  state.animationFrameId = requestAnimationFrame(() => {
    state.renderRequested = false;
    state.animationFrameId = null;
    state.renderer.render(state.scene, state.camera);
  });
}

function computeDefaultView(
  positions: readonly THREE.Vector3[],
  camera: THREE.PerspectiveCamera,
): { position: THREE.Vector3; target: THREE.Vector3 } {
  const target = midpoint(
    positions[LANDMARK_INDEX.LEFT_HIP],
    positions[LANDMARK_INDEX.RIGHT_HIP],
  );

  const box = new THREE.Box3().setFromPoints(Array.from(positions));
  const sphere = new THREE.Sphere();
  box.getBoundingSphere(sphere);
  const radius = Math.max(sphere.radius, 0.5);

  const fovRadians = THREE.MathUtils.degToRad(camera.fov);
  const distance = (radius * CAMERA_FIT_PADDING) / Math.sin(fovRadians / 2);

  const direction = new THREE.Vector3(0, 0.15, 1).normalize();
  const position = target.clone().add(direction.multiplyScalar(distance));

  return { position, target };
}

function applyRendererSize(state: SceneState, width: number, height: number) {
  if (width <= 0 || height <= 0) return;
  state.camera.aspect = width / height;
  state.camera.updateProjectionMatrix();
  state.renderer.setSize(width, height, false);
  scheduleRender(state);
}

type JointUpdateParams = {
  position: THREE.Vector3;
  confidence: SkeletonLandmarkConfidence;
  isDraggable: boolean;
  region: BodyRegion;
  regionBands: ReadonlyMap<BodyRegion, RiskBand | null>;
  isHovered: boolean;
  isDragging: boolean;
};

function updateJointVisual(joint: JointVisual, params: JointUpdateParams) {
  const { confidence } = params;
  joint.group.visible = true;
  joint.group.position.copy(params.position);

  const radius = params.isDraggable ? DRAGGABLE_JOINT_RADIUS : JOINT_RADIUS;
  joint.core.scale.setScalar(radius);
  joint.halo.scale.setScalar(radius * HALO_RADIUS_SCALE);

  const band = params.regionBands.get(params.region) ?? null;
  const baseColor = band ? riskBandColors[band] : NOT_ASSESSED_COLOR;

  const material = joint.core.material as THREE.MeshStandardMaterial;
  // While actively being dragged, the highlight stays full-strength
  // regardless of confidence — the user is looking straight at it and
  // actively correcting it, so desaturating the one joint under the
  // pointer would fight the feedback this highlight exists to give.
  if (params.isDragging) {
    material.color.set(DRAG_HIGHLIGHT_COLOR);
  } else {
    material.color.copy(desaturateColor(baseColor, confidence));
  }
  material.wireframe = confidence !== "measured";
  material.opacity = opacityForConfidence(confidence);

  joint.halo.visible = params.isDraggable;

  joint.group.scale.setScalar(
    params.isHovered || params.isDragging ? HOVER_SCALE : 1,
  );
}

type LimbUpdateParams = {
  a: THREE.Vector3;
  b: THREE.Vector3;
  radius: number;
  color: string;
  confidence: ConfidenceStyle;
};

function updateLimbVisual(mesh: THREE.Mesh, params: LimbUpdateParams) {
  const direction = params.b.clone().sub(params.a);
  orientCapsuleMesh(
    mesh,
    midpoint(params.a, params.b),
    direction,
    params.radius,
    direction.length(),
  );
  const material = mesh.material as THREE.MeshStandardMaterial;
  material.color.copy(desaturateColor(params.color, params.confidence));
  material.wireframe = params.confidence !== "measured";
  material.opacity = opacityForConfidence(params.confidence);
}

type ExtremityUpdateParams = {
  center: THREE.Vector3;
  direction: THREE.Vector3;
  radius: number;
  length: number;
  confidence: SkeletonLandmarkConfidence;
};

// Every extremity renders NOT_ASSESSED_COLOR unconditionally — none of
// the five has a BodyRegion or a score of its own (head/hands/feet are
// never independently measured), so there is no band to tint them with.
function updateExtremityVisual(
  mesh: THREE.Mesh,
  params: ExtremityUpdateParams,
) {
  orientCapsuleMesh(
    mesh,
    params.center,
    params.direction,
    params.radius,
    params.length,
  );
  const material = mesh.material as THREE.MeshStandardMaterial;
  material.color.set(NOT_ASSESSED_COLOR);
  material.wireframe = params.confidence !== "measured";
  material.opacity = opacityForConfidence(params.confidence);
}

// Rebuilds every limb/extremity/joint's position, color, opacity and
// visibility from `data` — the single code path used both by the
// prop-driven effect below and by an in-progress drag (via `override`), so
// there is only ever one implementation of "what the scene should look
// like right now."
function rebuildScene(
  state: SceneState,
  data: SceneData,
  override?: { index: number; position: THREE.Vector3 },
) {
  const basePositions = landmarksTo3DPositions(data.keypoints);
  const isVirtualOverride = override?.index === VIRTUAL_CHEST_LANDMARK_INDEX;
  const positions =
    override && !isVirtualOverride
      ? basePositions.map((p, i) =>
          i === override.index ? override.position : p,
        )
      : basePositions;
  const chestPosition =
    override && override.index === VIRTUAL_CHEST_LANDMARK_INDEX
      ? override.position
      : getVirtualChestPosition(positions);

  const draggableSet = new Set(data.draggableJoints);

  for (const limb of state.limbs) {
    const style = combineConfidence(
      getConfidence(data.confidenceMap, limb.a),
      getConfidence(data.confidenceMap, limb.b),
    );
    const band = data.regionBands.get(limb.region) ?? null;
    const color = band ? riskBandColors[band] : NOT_ASSESSED_COLOR;
    updateLimbVisual(limb.mesh, {
      a: positions[limb.a],
      b: positions[limb.b],
      radius: limb.radius,
      color,
      confidence: style,
    });
  }

  // Head — one solid element, rigidly oriented along the neck vector
  // (shoulderMid -> NOSE), anchored at NOSE (the same landmark
  // JOINT_REGIONS already pivots the NECK drag handle on).
  const leftShoulder = positions[LANDMARK_INDEX.LEFT_SHOULDER];
  const rightShoulder = positions[LANDMARK_INDEX.RIGHT_SHOULDER];
  const shoulderMid = midpoint(leftShoulder, rightShoulder);
  const nose = positions[LANDMARK_INDEX.NOSE];
  updateExtremityVisual(state.extremities.head, {
    center: nose,
    direction: nose.clone().sub(shoulderMid),
    radius: HEAD_RADIUS,
    length: HEAD_LENGTH,
    confidence: getConfidence(data.confidenceMap, LANDMARK_INDEX.NOSE),
  });

  for (const side of ["LEFT", "RIGHT"] as const) {
    // Hand — neutral to the forearm: continues the elbow->wrist direction
    // past the wrist, never independently rotated.
    const elbow = positions[LANDMARK_INDEX[`${side}_ELBOW`]];
    const wrist = positions[LANDMARK_INDEX[`${side}_WRIST`]];
    const forearmDirection = wrist.clone().sub(elbow);
    const handCenter =
      forearmDirection.lengthSq() > 0
        ? wrist.clone().add(
            forearmDirection
              .clone()
              .normalize()
              .multiplyScalar(HAND_LENGTH / 2),
          )
        : wrist.clone();
    updateExtremityVisual(
      state.extremities[side === "LEFT" ? "handLeft" : "handRight"],
      {
        center: handCenter,
        direction: forearmDirection,
        radius: HAND_RADIUS,
        length: HAND_LENGTH,
        confidence: getConfidence(
          data.confidenceMap,
          LANDMARK_INDEX[`${side}_WRIST`],
        ),
      },
    );

    // Foot — fixed at 90° to the shank (perpendicularForward), extending
    // forward from the ankle.
    const knee = positions[LANDMARK_INDEX[`${side}_KNEE`]];
    const ankle = positions[LANDMARK_INDEX[`${side}_ANKLE`]];
    const footDirection = perpendicularForward(ankle.clone().sub(knee));
    const footCenter = ankle
      .clone()
      .add(footDirection.clone().multiplyScalar(FOOT_LENGTH / 2));
    updateExtremityVisual(
      state.extremities[side === "LEFT" ? "footLeft" : "footRight"],
      {
        center: footCenter,
        direction: footDirection,
        radius: FOOT_RADIUS,
        length: FOOT_LENGTH,
        confidence: getConfidence(
          data.confidenceMap,
          LANDMARK_INDEX[`${side}_ANKLE`],
        ),
      },
    );
  }

  // The 8 draggable joint handles (JOINT_REGIONS' own key set — exactly
  // TRUNK/NECK/SHOULDER_LEFT/RIGHT/ELBOW_LEFT/RIGHT/KNEE_LEFT/RIGHT, per
  // SLD_POSTURE_EDITOR_FIDELITY_PLAN.md's P1 invariant). VIRTUAL_CHEST
  // (TRUNK) has no real landmark behind it, so it's hidden entirely when
  // not draggable rather than floating a synthetic marker with nothing to
  // interact with — every other handle stays visible (smaller, no halo)
  // even when not draggable, same as before P3.
  for (const [indexKey, region] of Object.entries(JOINT_REGIONS) as Array<
    [string, BodyRegion]
  >) {
    const index = Number(indexKey);
    const joint = state.joints.get(index);
    if (!joint) continue;

    const isDraggable = draggableSet.has(index);
    const isChest = index === VIRTUAL_CHEST_LANDMARK_INDEX;
    if (isChest && !isDraggable) {
      joint.group.visible = false;
      continue;
    }

    updateJointVisual(joint, {
      position: isChest ? chestPosition : positions[index],
      confidence: isChest
        ? chestConfidence(data.confidenceMap)
        : getConfidence(data.confidenceMap, index),
      isDraggable,
      region,
      regionBands: data.regionBands,
      isHovered: state.hoveredIndex === index,
      isDragging: state.drag?.landmarkIndex === index,
    });
  }

  scheduleRender(state);
}

function applyHoverScale(state: SceneState) {
  for (const [index, joint] of state.joints) {
    const active =
      index === state.hoveredIndex || state.drag?.landmarkIndex === index;
    if (joint.group.visible)
      joint.group.scale.setScalar(active ? HOVER_SCALE : 1);
  }
}

function updatePointerNDC(
  state: SceneState,
  canvas: HTMLCanvasElement,
  event: PointerEvent,
) {
  const rect = canvas.getBoundingClientRect();
  state.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  state.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function draggableCoreMeshes(
  state: SceneState,
  draggableJoints: readonly number[],
): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  for (const index of draggableJoints) {
    const joint = state.joints.get(index);
    if (joint?.group.visible) meshes.push(joint.core);
  }
  return meshes;
}

export function Skeleton3D({
  keypoints,
  confidenceMap,
  regionBands,
  draggableJoints,
  onJointDrag,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
}: Skeleton3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneStateRef = useRef<SceneState | null>(null);

  // Latest-value refs so the DOM pointer listeners (registered once, in
  // the mount effect below, and never re-registered) always see current
  // props instead of closing over whatever was current at mount time.
  const keypointsRef = useRef(keypoints);
  keypointsRef.current = keypoints;
  const draggableJointsRef = useRef(draggableJoints);
  draggableJointsRef.current = draggableJoints;
  const onJointDragRef = useRef(onJointDrag);
  onJointDragRef.current = onJointDrag;

  // Mount effect: the three.js lifecycle (scene/camera/renderer/lights/
  // controls/raycaster/meshes/DOM listeners), created once and disposed on
  // unmount. Deliberately touches only refs and DOM/three.js state, never
  // destructured props directly, so the empty dependency array below is
  // actually correct, not a suppressed lint warning.
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      CAMERA_FOV_DEGREES,
      container.clientWidth / Math.max(container.clientHeight, 1),
      CAMERA_NEAR,
      CAMERA_FAR,
    );

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight, false);

    // Soft ambient + one directional light — a technical visualization,
    // not a game: no shadows, no rim lighting, nothing dramatic.
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(1, 2, 3);
    scene.add(ambientLight, directionalLight);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const sphereGeometry = new THREE.SphereGeometry(1, 16, 12);
    // Unit capsule (radius=1, cylindrical length=1) shared by every limb
    // and extremity mesh — see orientCapsuleMesh's own doc comment for why
    // one shared geometry, scaled per-instance every render, is enough.
    const capsuleGeometry = new THREE.CapsuleGeometry(
      1,
      1,
      CAPSULE_CAP_SEGMENTS,
      CAPSULE_RADIAL_SEGMENTS,
    );

    const neutralMaterial = () =>
      new THREE.MeshStandardMaterial({
        color: NOT_ASSESSED_COLOR,
        transparent: true,
      });

    // Solid mannequin limbs (P3) — one capsule per BODY_REGION_BONES
    // segment, still the correct region -> segment map per that plan's own
    // note. Every segment here has a real BodyRegion (BODY_REGION_BONES
    // has no unscored entries), so there is no "no region" case to guard.
    const limbs: LimbVisual[] = [];
    for (const [region, bones] of Object.entries(BODY_REGION_BONES) as Array<
      [BodyRegion, ReadonlyArray<readonly [number, number]>]
    >) {
      const radius = REGION_CAPSULE_RADIUS[region] ?? ARM_CAPSULE_RADIUS;
      for (const [a, b] of bones) {
        const mesh = new THREE.Mesh(capsuleGeometry, neutralMaterial());
        scene.add(mesh);
        limbs.push({ mesh, a, b, region, radius });
      }
    }

    // Rigid, non-interactive extremities (P3) — head, hands, feet. None
    // of these have a BodyRegion, a drag handle, or independent
    // articulation; rebuildScene repositions/reorients them every render
    // from their anchor landmark (NOSE / WRIST / ANKLE) alone.
    const extremities: Extremities = {
      head: new THREE.Mesh(capsuleGeometry, neutralMaterial()),
      handLeft: new THREE.Mesh(capsuleGeometry, neutralMaterial()),
      handRight: new THREE.Mesh(capsuleGeometry, neutralMaterial()),
      footLeft: new THREE.Mesh(capsuleGeometry, neutralMaterial()),
      footRight: new THREE.Mesh(capsuleGeometry, neutralMaterial()),
    };
    for (const mesh of Object.values(extremities)) scene.add(mesh);

    // Draggable joint handles — exactly JOINT_REGIONS' own 8 entries
    // (SLD_POSTURE_EDITOR_FIDELITY_PLAN.md P1's "exactly eight drag
    // handles" invariant), not all 33+1 landmark slots the pre-P3 renderer
    // built spheres for. Every one of these 8 is always potentially
    // draggable, so every one always gets a halo too — shown/hidden
    // per-render based on the actual draggableJoints prop (see
    // updateJointVisual), never recreated.
    const joints = new Map<number, JointVisual>();
    for (const indexKey of Object.keys(JOINT_REGIONS)) {
      const index = Number(indexKey);
      const core = new THREE.Mesh(
        sphereGeometry,
        new THREE.MeshStandardMaterial({
          color: NOT_ASSESSED_COLOR,
          transparent: true,
        }),
      );
      core.userData.landmarkIndex = index;

      const group = new THREE.Group();
      group.add(core);

      const halo = new THREE.Mesh(
        sphereGeometry,
        new THREE.MeshBasicMaterial({
          color: DRAGGABLE_HALO_COLOR,
          transparent: true,
          opacity: 0.25,
          depthWrite: false,
        }),
      );
      group.add(halo);

      scene.add(group);
      joints.set(index, { group, core, halo });
    }

    const state: SceneState = {
      scene,
      camera,
      renderer,
      controls: undefined as unknown as OrbitControls, // assigned just below, before any event can reference it
      raycaster,
      pointer,
      limbs,
      extremities,
      joints,
      renderRequested: false,
      animationFrameId: null,
      initialView: null,
      hoveredIndex: null,
      drag: null,
    };

    const onPointerMove = (event: PointerEvent) => {
      updatePointerNDC(state, canvas, event);
      if (state.drag) {
        handleDragMove(event);
      } else {
        handleHover();
      }
    };

    const handleHover = () => {
      state.scene.updateMatrixWorld(true);
      state.raycaster.setFromCamera(state.pointer, state.camera);
      const hits = state.raycaster.intersectObjects(
        draggableCoreMeshes(state, draggableJointsRef.current),
        false,
      );
      const newHovered =
        hits.length > 0
          ? (hits[0].object.userData.landmarkIndex as number)
          : null;
      if (newHovered === state.hoveredIndex) return;
      state.hoveredIndex = newHovered;
      canvas.style.cursor = newHovered !== null ? "grab" : "default";
      applyHoverScale(state);
      scheduleRender(state);
    };

    const handleDragMove = (event: PointerEvent) => {
      const drag = state.drag;
      if (!drag || event.pointerId !== drag.pointerId) return;

      state.raycaster.setFromCamera(state.pointer, state.camera);
      const rawPoint = new THREE.Vector3();
      const hit = state.raycaster.ray.intersectPlane(drag.plane, rawPoint);
      if (!hit) return;

      // Rigid bone-length projection always applies (see
      // enforceRigidConstraints' own doc comment) — threaded into
      // clampAlongDragPath as `project` when an angular clamp also applies,
      // so every trial the bisection evaluates is already the correct
      // bone length, not just the final answer; applied directly to the
      // raw point otherwise (e.g. a landmark with no ANATOMICAL_LIMITS
      // entry, or NECK's degenerate not-in-profile case where buildMeasurer
      // returned null).
      const rigidProject = (point: THREE.Vector3) =>
        enforceRigidConstraints(point, drag.rigidConstraints);
      const clamped =
        drag.measure && drag.limits
          ? clampAlongDragPath(
              drag.fromPosition,
              rawPoint,
              drag.limits.min,
              drag.limits.max,
              drag.measure,
              rigidProject,
            )
          : rigidProject(rawPoint);

      // Local visual feedback is immediate/unthrottled — only the
      // callback to the parent (which likely drives re-scoring) is
      // throttled below, per the ~30fps budget in the task.
      rebuildScene(
        state,
        {
          keypoints: keypointsRef.current,
          confidenceMap: confidenceMapRef.current,
          regionBands: regionBandsRef.current,
          draggableJoints: draggableJointsRef.current,
        },
        { index: drag.landmarkIndex, position: clamped },
      );

      const now = performance.now();
      if (now - drag.lastEmitTime < DRAG_EMIT_INTERVAL_MS) return;
      drag.lastEmitTime = now;
      // Same defensive wrap as endDrag's final emit, for the same reason
      // (onJointDragRef can throw on a real, reachable condition) — not
      // strictly required here for the stuck-drag bug specifically (this
      // mid-drag emit never touches state.drag), but an uncaught throw
      // from inside a "pointermove" listener is still an unhandled error
      // on every remaining frame of the same drag, worth containing the
      // same way.
      try {
        onJointDragRef.current?.(drag.landmarkIndex, {
          x: clamped.x,
          y: clamped.y,
          z: clamped.z,
        });
      } catch (err) {
        console.error("onJointDrag threw during drag move:", err);
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      updatePointerNDC(state, canvas, event);
      state.scene.updateMatrixWorld(true);
      state.raycaster.setFromCamera(state.pointer, state.camera);
      const hits = state.raycaster.intersectObjects(
        draggableCoreMeshes(state, draggableJointsRef.current),
        false,
      );
      if (hits.length === 0) return;

      const landmarkIndex = hits[0].object.userData.landmarkIndex as number;
      const joint = state.joints.get(landmarkIndex);
      if (!joint) return;

      const cameraDirection = new THREE.Vector3();
      state.camera.getWorldDirection(cameraDirection);
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
        cameraDirection,
        joint.group.position,
      );

      const positions = landmarksTo3DPositions(keypointsRef.current);
      const region = Object.hasOwn(JOINT_REGIONS, landmarkIndex)
        ? JOINT_REGIONS[landmarkIndex]
        : undefined;
      const limits = region ? (ANATOMICAL_LIMITS[region] ?? null) : null;

      state.drag = {
        landmarkIndex,
        pointerId: event.pointerId,
        plane,
        fromPosition: joint.group.position.clone(),
        measure: buildMeasurer(landmarkIndex, positions),
        limits,
        lastEmitTime: 0,
        rigidConstraints: buildRigidConstraints(landmarkIndex, positions),
      };

      // Disabling OrbitControls here relies on our own pointerdown
      // listener having been registered on `canvas` BEFORE
      // `new OrbitControls(...)` below attaches its own — see the comment
      // at that construction site. OrbitControls checks `this.enabled` at
      // the top of its internal pointerdown handler, so as long as ours
      // runs first in the browser's dispatch order, this reliably stops
      // it from also starting a camera rotation on the same gesture.
      state.controls.enabled = false;
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = "grabbing";
      applyHoverScale(state);
      scheduleRender(state);
    };

    // Ends whatever drag is in progress, unconditionally — every path that
    // can signal "this pointer interaction is over" (a clean pointerup on
    // the canvas, pointercancel, losing pointer capture, the pointer
    // leaving the canvas, or a pointerup anywhere in the document because
    // it never reached the canvas at all) funnels through this one
    // function, so there is exactly one implementation of the cleanup
    // contract: (a) clear state.drag, (b) re-enable OrbitControls, (c)
    // reset the cursor, (d) release pointer capture — every one of those
    // unconditional, never gated behind a check that could itself fail and
    // leave the drag stuck.
    //
    // Deliberately does NOT filter by the terminating event's pointerId
    // (an earlier version required it to match drag.pointerId, which is
    // exactly what let a stuck drag happen: browsers don't reliably fire
    // pointerup with the same id pointerdown recorded — touch, pen, and
    // lost-capture cases have all been observed to disagree). Pointer
    // capture is released using drag.pointerId (recorded at drag start),
    // never the terminating event's id, since several of these call sites
    // (lostpointercapture, pointerleave, the document-level fallback) have
    // no reliable "current" pointerId of their own to use instead — this
    // component only ever tracks one drag at a time, so "a drag is active"
    // is itself sufficient reason to end it.
    const endDrag = () => {
      const drag = state.drag;
      if (!drag) return;

      // One final, unthrottled emit so the parent's state always lands
      // exactly on what was last shown, even if the ~30fps throttle
      // skipped the very last move. Wrapped in try/catch: onJointDragRef
      // is arbitrary caller code (posture-editor.tsx's handleJointDrag,
      // which cascades into computeAngleFromDrag — genuinely throws for a
      // region whose other required landmarks have insufficient
      // visibility, or NECK's "subject not in profile" degeneracy, both
      // real conditions a sample with low-visibility body parts can hit).
      // This function's entire contract is unconditional cleanup below; a
      // throw here must never skip it — an uncaught exception at this
      // point used to abort the rest of endDrag entirely, leaving
      // state.drag stuck non-null and the joint following the pointer
      // indefinitely, exactly the bug this function exists to prevent.
      const joint = state.joints.get(drag.landmarkIndex);
      if (joint) {
        try {
          onJointDragRef.current?.(drag.landmarkIndex, {
            x: joint.group.position.x,
            y: joint.group.position.y,
            z: joint.group.position.z,
          });
        } catch (err) {
          console.error("onJointDrag threw during drag-end emit:", err);
        }
      }

      state.drag = null;
      state.controls.enabled = true;
      canvas.style.cursor = "default";
      if (canvas.hasPointerCapture(drag.pointerId)) {
        canvas.releasePointerCapture(drag.pointerId);
      }
      applyHoverScale(state);
      scheduleRender(state);
    };

    // Catches the case where a pointerup never reaches the canvas at all
    // (released outside its bounds without capture having been
    // established) — a bubble-phase document listener still sees it
    // regardless of which element the browser considers "under" the
    // pointer at release time.
    const documentEndDrag = () => {
      if (!state.drag) return;
      endDrag();
    };

    // Registered BEFORE constructing OrbitControls, deliberately — see the
    // comment inside onPointerDown above for why this ordering matters.
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);
    // The definitive "this pointer interaction is over" signal when
    // setPointerCapture fails or capture is broken out from under us (a
    // context menu, an OS-level gesture, an alt-tab) — fires regardless of
    // which pointerId caused it.
    canvas.addEventListener("lostpointercapture", endDrag);
    // Fallback for when the pointer leaves the canvas without a pointerup
    // ever firing on it (possible when capture wasn't established).
    canvas.addEventListener("pointerleave", endDrag);
    document.addEventListener("pointerup", documentEndDrag);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableRotate = true;
    controls.enableZoom = true;
    // Panning re-frames the figure — the practical purpose the removed
    // virtual hip drag handle used to serve (see
    // SLD_POSTURE_EDITOR_FIDELITY_PLAN.md's P1), now covered by ordinary
    // camera control instead of a fake anatomical drag.
    controls.enablePan = true;
    controls.autoRotate = false;
    controls.minDistance = MIN_ZOOM_DISTANCE;
    controls.maxDistance = MAX_ZOOM_DISTANCE;
    // Damping needs a continuously-running render loop to animate the
    // decay after the user lets go — that's exactly the "spin the loop
    // when idle" behavior this component avoids. Off, so every camera
    // move maps 1:1 to a single 'change' event and a single scheduled
    // render (see the listener just below), never a lingering animation.
    controls.enableDamping = false;
    controls.addEventListener("change", () => scheduleRender(state));
    state.controls = controls;

    const initialPositions = landmarksTo3DPositions(keypointsRef.current);
    const view = computeDefaultView(initialPositions, camera);
    camera.position.copy(view.position);
    controls.target.copy(view.target);
    camera.lookAt(view.target);
    controls.update();
    state.initialView = {
      position: view.position.clone(),
      target: view.target.clone(),
    };

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      applyRendererSize(
        state,
        entry.contentRect.width,
        entry.contentRect.height,
      );
    });
    resizeObserver.observe(container);

    sceneStateRef.current = state;
    scheduleRender(state);

    return () => {
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", endDrag);
      canvas.removeEventListener("pointercancel", endDrag);
      canvas.removeEventListener("lostpointercapture", endDrag);
      canvas.removeEventListener("pointerleave", endDrag);
      document.removeEventListener("pointerup", documentEndDrag);
      resizeObserver.disconnect();
      if (state.animationFrameId !== null)
        cancelAnimationFrame(state.animationFrameId);
      controls.dispose();
      for (const limb of limbs) {
        (limb.mesh.material as THREE.Material).dispose();
      }
      for (const mesh of Object.values(extremities)) {
        (mesh.material as THREE.Material).dispose();
      }
      for (const joint of joints.values()) {
        (joint.core.material as THREE.Material).dispose();
        (joint.halo.material as THREE.Material).dispose();
      }
      capsuleGeometry.dispose();
      sphereGeometry.dispose();
      renderer.dispose();
      sceneStateRef.current = null;
    };
  }, []);

  // Latest-value refs used by the drag-move handler above, which is
  // defined inside the mount effect and therefore can't see later
  // renders' confidenceMap/regionBands directly.
  const confidenceMapRef = useRef(confidenceMap);
  confidenceMapRef.current = confidenceMap;
  const regionBandsRef = useRef(regionBands);
  regionBandsRef.current = regionBands;

  // Geometry rebuild — re-runs whenever the data driving the figure
  // changes. Runs once more on mount too (after the effect above), which
  // is what actually paints the initial pose onto the placeholder meshes
  // that effect created.
  useEffect(() => {
    const state = sceneStateRef.current;
    if (!state) return;
    rebuildScene(state, {
      keypoints,
      confidenceMap,
      regionBands,
      draggableJoints,
    });
  }, [keypoints, confidenceMap, regionBands, draggableJoints]);

  const resetView = () => {
    const state = sceneStateRef.current;
    if (!state?.initialView) return;
    state.camera.position.copy(state.initialView.position);
    state.controls.target.copy(state.initialView.target);
    state.controls.update();
    scheduleRender(state);
  };

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-lg border border-border bg-surface"
      style={{ width, height, maxWidth: "100%" }}
    >
      <canvas ref={canvasRef} className="block h-full w-full touch-none" />
      <button
        type="button"
        onClick={resetView}
        className="absolute top-2 right-2 rounded-md bg-surface/90 px-2 py-1 font-technical text-xs text-foreground shadow hover:bg-surface"
      >
        Reset view
      </button>
    </div>
  );
}
