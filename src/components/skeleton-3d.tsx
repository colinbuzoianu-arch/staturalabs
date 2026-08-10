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
  POSE_CONNECTIONS,
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

export type Skeleton3DProps = {
  /** The landmark array to render — either an original capture or an FK-adjusted pose. Same PoseLandmarks shape landmarksTo3DPositions accepts. */
  keypoints: PoseLandmarks;
  /** Per-landmark confidence, keyed by MediaPipe landmark index (0-32) — typically built from classifyLandmarkConfidence or a completeMissingLandmarks result. An index with no entry is treated as "missing" (never drawn), the safe default. */
  confidenceMap: ReadonlyMap<number, SkeletonLandmarkConfidence>;
  /** Which band each scored BodyRegion currently has, for bone/joint coloring. A region absent from the map (or mapped to null) renders NOT_ASSESSED_COLOR. */
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
const HEAD_RADIUS = 0.08;
const HALO_RADIUS_SCALE = 1.5;
const HOVER_SCALE = 1.2;

// Same opacity tiers as skeleton-viewer.tsx's 2D equivalents (that file's
// own MEASURED_OPACITY/ESTIMATED_OPACITY/INFERRED_OPACITY are private
// consts, not exported — kept numerically in sync by hand, same as
// skeleton.ts's BODY_REGION_BONES duplicating that file's BONE_REGIONS).
const MEASURED_OPACITY = 1;
const ESTIMATED_OPACITY = 0.5;
const INFERRED_OPACITY = 0.3;

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

// ---------------------------------------------------------------------
// Confidence styling — mirrors skeleton-viewer.tsx's combineConfidence
// (weakest endpoint wins) and opacity tiers, reimplemented locally for the
// same reason skeleton.ts's BODY_REGION_BONES reimplements that file's
// BONE_REGIONS: skeleton-viewer.tsx is a 2D/SVG client component with
// nothing exported for this, and duplicating a few lines beats importing
// across renderer boundaries.
// ---------------------------------------------------------------------
type ConfidenceStyle = "measured" | "estimated" | "inferred" | "skip";

function getConfidence(
  confidenceMap: ReadonlyMap<number, SkeletonLandmarkConfidence>,
  index: number,
): SkeletonLandmarkConfidence {
  return confidenceMap.get(index) ?? "missing";
}

function combineConfidence(
  a: SkeletonLandmarkConfidence,
  b: SkeletonLandmarkConfidence,
): ConfidenceStyle {
  if (a === "missing" || b === "missing") return "skip";
  if (a === "inferred" || b === "inferred") return "inferred";
  if (a === "estimated" || b === "estimated") return "estimated";
  return "measured";
}

function opacityFor(style: "measured" | "estimated" | "inferred"): number {
  if (style === "measured") return MEASURED_OPACITY;
  return style === "estimated" ? ESTIMATED_OPACITY : INFERRED_OPACITY;
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

function boneKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

// Inverse of BODY_REGION_BONES (region -> bone pairs), built once at
// module load so bone coloring is a lookup, not a linear scan — mirrors
// skeleton-viewer.tsx's own regionForBone/BONE_REGIONS, rebuilt from
// skeleton.ts's exported table (see that table's own comment) instead of a
// second hardcoded copy, so the 2D and 3D renderers can't drift apart.
const BONE_REGION_LOOKUP = new Map<string, BodyRegion>();
for (const [region, bones] of Object.entries(BODY_REGION_BONES) as Array<
  [BodyRegion, ReadonlyArray<readonly [number, number]>]
>) {
  for (const [a, b] of bones) {
    BONE_REGION_LOOKUP.set(boneKey(a, b), region);
  }
}

// JOINT_REGIONS is typed Record<number, BodyRegion> (every numeric key
// "promises" a BodyRegion) even though only 8 of the 34 possible indices
// actually have an entry — safe runtime lookup needs an explicit
// hasOwnProperty check rather than trusting that type for indices outside
// its real key set (no noUncheckedIndexedAccess in this project's
// tsconfig).
function regionForJoint(index: number): BodyRegion | undefined {
  return Object.hasOwn(JOINT_REGIONS, index) ? JOINT_REGIONS[index] : undefined;
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
function clampAlongDragPath(
  from: THREE.Vector3,
  to: THREE.Vector3,
  min: number,
  max: number,
  measure: FlexionMeasurer,
): THREE.Vector3 {
  const EPSILON = 1e-6;
  const inRange = (deg: number) => deg >= min - EPSILON && deg <= max + EPSILON;
  if (inRange(measure(to))) return to;
  if (!inRange(measure(from))) return from.clone();

  let lo = 0;
  let hi = 1;
  for (let i = 0; i < BISECTION_ITERATIONS; i++) {
    const mid = (lo + hi) / 2;
    const point = from.clone().lerp(to, mid);
    if (inRange(measure(point))) lo = mid;
    else hi = mid;
  }
  return from.clone().lerp(to, lo);
}

// ---------------------------------------------------------------------
// Scene state — every mutable three.js object for one mounted instance,
// held in a ref (never React state, so a joint drag never triggers a
// React re-render; only the on-demand render loop below repaints).
// ---------------------------------------------------------------------
type JointVisual = {
  group: THREE.Group;
  core: THREE.Mesh;
  halo: THREE.Mesh | null;
};

type BoneVisual = {
  line: THREE.Line;
  a: number;
  b: number;
};

type DragState = {
  landmarkIndex: number;
  pointerId: number;
  plane: THREE.Plane;
  fromPosition: THREE.Vector3;
  measure: FlexionMeasurer | null;
  limits: { min: number; max: number } | null;
  lastEmitTime: number;
};

type SceneState = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  raycaster: THREE.Raycaster;
  pointer: THREE.Vector2;
  bones: BoneVisual[];
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
  isHead: boolean;
  region: BodyRegion | undefined;
  regionBands: ReadonlyMap<BodyRegion, RiskBand | null>;
  isHovered: boolean;
  isDragging: boolean;
};

function updateJointVisual(joint: JointVisual, params: JointUpdateParams) {
  const { confidence } = params;
  if (confidence === "missing") {
    joint.group.visible = false;
    return;
  }
  joint.group.visible = true;
  joint.group.position.copy(params.position);

  const radius = params.isHead
    ? HEAD_RADIUS
    : params.isDraggable
      ? DRAGGABLE_JOINT_RADIUS
      : JOINT_RADIUS;
  joint.core.scale.setScalar(radius);
  if (joint.halo) joint.halo.scale.setScalar(radius * HALO_RADIUS_SCALE);

  const band = params.region
    ? (params.regionBands.get(params.region) ?? null)
    : null;
  const baseColor = band ? riskBandColors[band] : NOT_ASSESSED_COLOR;
  const color = params.isDragging ? DRAG_HIGHLIGHT_COLOR : baseColor;

  const material = joint.core.material as THREE.MeshStandardMaterial;
  material.color.set(color);
  material.wireframe = confidence !== "measured";
  material.opacity =
    confidence === "measured" ? MEASURED_OPACITY : opacityFor(confidence);

  if (joint.halo) {
    joint.halo.visible = params.isDraggable;
  }

  joint.group.scale.setScalar(
    params.isHovered || params.isDragging ? HOVER_SCALE : 1,
  );
}

// Rebuilds every bone/joint's position, color, opacity and visibility from
// `data` — the single code path used both by the prop-driven effect below
// and by an in-progress drag (via `override`), so there is only ever one
// implementation of "what the scene should look like right now." Cheap
// enough (33 landmarks, 26 bones, 34 joint slots — all plain vector/color
// writes onto already-created objects, nothing allocated on the GPU side)
// to call on every throttled drag frame.
function rebuildScene(
  state: SceneState,
  data: SceneData,
  override?: { index: number; position: THREE.Vector3 },
) {
  const basePositions = landmarksTo3DPositions(data.keypoints);
  const positions =
    override && override.index !== VIRTUAL_CHEST_LANDMARK_INDEX
      ? basePositions.map((p, i) =>
          i === override.index ? override.position : p,
        )
      : basePositions;
  const chestPosition =
    override && override.index === VIRTUAL_CHEST_LANDMARK_INDEX
      ? override.position
      : getVirtualChestPosition(positions);

  const draggableSet = new Set(data.draggableJoints);

  for (const bone of state.bones) {
    const style = combineConfidence(
      getConfidence(data.confidenceMap, bone.a),
      getConfidence(data.confidenceMap, bone.b),
    );
    if (style === "skip") {
      bone.line.visible = false;
      continue;
    }
    bone.line.visible = true;

    const pa = positions[bone.a];
    const pb = positions[bone.b];
    const posAttr = bone.line.geometry.attributes
      .position as THREE.BufferAttribute;
    posAttr.setXYZ(0, pa.x, pa.y, pa.z);
    posAttr.setXYZ(1, pb.x, pb.y, pb.z);
    posAttr.needsUpdate = true;
    bone.line.geometry.computeBoundingSphere();

    const region = BONE_REGION_LOOKUP.get(boneKey(bone.a, bone.b));
    const band = region ? (data.regionBands.get(region) ?? null) : null;
    const color = band ? riskBandColors[band] : NOT_ASSESSED_COLOR;

    const wantsDashed = style === "inferred";
    const isDashed = bone.line.material instanceof THREE.LineDashedMaterial;
    if (wantsDashed !== isDashed) {
      (bone.line.material as THREE.Material).dispose();
      bone.line.material = wantsDashed
        ? new THREE.LineDashedMaterial({
            color,
            transparent: true,
            dashSize: 0.03,
            gapSize: 0.02,
          })
        : new THREE.LineBasicMaterial({ color, transparent: true });
    } else {
      (bone.line.material as THREE.LineBasicMaterial).color.set(color);
    }
    (bone.line.material as THREE.Material & { opacity: number }).opacity =
      opacityFor(style);
    if (wantsDashed) bone.line.computeLineDistances();
  }

  for (let index = 0; index < 33; index++) {
    const joint = state.joints.get(index);
    if (!joint) continue;
    updateJointVisual(joint, {
      position: positions[index],
      confidence: getConfidence(data.confidenceMap, index),
      isDraggable: draggableSet.has(index),
      isHead: index === LANDMARK_INDEX.NOSE,
      region: regionForJoint(index),
      regionBands: data.regionBands,
      isHovered: state.hoveredIndex === index,
      isDragging: state.drag?.landmarkIndex === index,
    });
  }

  // Virtual chest (TRUNK drag handle) — only ever shown when actually
  // draggable; there's no non-interactive reason to float a synthetic
  // marker over the chest.
  const chestJoint = state.joints.get(VIRTUAL_CHEST_LANDMARK_INDEX);
  if (chestJoint) {
    const chestDraggable = draggableSet.has(VIRTUAL_CHEST_LANDMARK_INDEX);
    if (!chestDraggable) {
      chestJoint.group.visible = false;
    } else {
      updateJointVisual(chestJoint, {
        position: chestPosition,
        confidence: chestConfidence(data.confidenceMap),
        isDraggable: true,
        isHead: false,
        region: "TRUNK",
        regionBands: data.regionBands,
        isHovered: state.hoveredIndex === VIRTUAL_CHEST_LANDMARK_INDEX,
        isDragging: state.drag?.landmarkIndex === VIRTUAL_CHEST_LANDMARK_INDEX,
      });
    }
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

    const bones: BoneVisual[] = POSE_CONNECTIONS.map(([a, b]) => {
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(),
        new THREE.Vector3(),
      ]);
      const material = new THREE.LineBasicMaterial({
        color: NOT_ASSESSED_COLOR,
        transparent: true,
      });
      const line = new THREE.Line(geometry, material);
      scene.add(line);
      return { line, a, b };
    });

    const joints = new Map<number, JointVisual>();
    const allJointIndices = [
      ...Array.from({ length: 33 }, (_, i) => i),
      VIRTUAL_CHEST_LANDMARK_INDEX,
    ];
    for (const index of allJointIndices) {
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

      // A halo (glow shell) only for joints that could ever be draggable —
      // built once per index from JOINT_REGIONS' static key set, then
      // shown/hidden per-render based on the actual draggableJoints prop
      // (see updateJointVisual), never recreated.
      let halo: THREE.Mesh | null = null;
      if (regionForJoint(index) !== undefined) {
        halo = new THREE.Mesh(
          sphereGeometry,
          new THREE.MeshBasicMaterial({
            color: DRAGGABLE_HALO_COLOR,
            transparent: true,
            opacity: 0.25,
            depthWrite: false,
          }),
        );
        group.add(halo);
      }

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
      bones,
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

      const clamped =
        drag.measure && drag.limits
          ? clampAlongDragPath(
              drag.fromPosition,
              rawPoint,
              drag.limits.min,
              drag.limits.max,
              drag.measure,
            )
          : rawPoint;

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
      onJointDragRef.current?.(drag.landmarkIndex, {
        x: clamped.x,
        y: clamped.y,
        z: clamped.z,
      });
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
      const region = regionForJoint(landmarkIndex);
      const limits = region ? (ANATOMICAL_LIMITS[region] ?? null) : null;

      state.drag = {
        landmarkIndex,
        pointerId: event.pointerId,
        plane,
        fromPosition: joint.group.position.clone(),
        measure: buildMeasurer(landmarkIndex, positions),
        limits,
        lastEmitTime: 0,
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

    const endDrag = (event: PointerEvent) => {
      const drag = state.drag;
      if (!drag || drag.pointerId !== event.pointerId) return;

      // One final, unthrottled emit so the parent's state always lands
      // exactly on what was last shown, even if the ~30fps throttle
      // skipped the very last move.
      const joint = state.joints.get(drag.landmarkIndex);
      if (joint) {
        onJointDragRef.current?.(drag.landmarkIndex, {
          x: joint.group.position.x,
          y: joint.group.position.y,
          z: joint.group.position.z,
        });
      }

      state.drag = null;
      state.controls.enabled = true;
      canvas.style.cursor = "default";
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
      applyHoverScale(state);
      scheduleRender(state);
    };

    // Registered BEFORE constructing OrbitControls, deliberately — see the
    // comment inside onPointerDown above for why this ordering matters.
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableRotate = true;
    controls.enableZoom = true;
    controls.enablePan = false;
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
      resizeObserver.disconnect();
      if (state.animationFrameId !== null)
        cancelAnimationFrame(state.animationFrameId);
      controls.dispose();
      for (const bone of bones) {
        bone.line.geometry.dispose();
        (bone.line.material as THREE.Material).dispose();
      }
      for (const joint of joints.values()) {
        (joint.core.material as THREE.Material).dispose();
        if (joint.halo) (joint.halo.material as THREE.Material).dispose();
      }
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
