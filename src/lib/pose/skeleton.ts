import * as THREE from "three";
import type { BodyRegion } from "@/generated/prisma/enums";
import type { PoseLandmark, PoseLandmarks } from "./angles";
import { MIN_LANDMARK_VISIBILITY } from "./angles";

// Pure math — no DOM, no React, no Canvas/SVG. Prepares data for a
// renderer to draw; never draws anything itself.
//
// COMPLIANCE NOTE (ERGO_COMPLIANCE_BY_DESIGN.md §3.2/§3.3): this module is
// visualization-only. It fills in a skeleton overlay for a single capture
// so the operator sees a complete stick figure instead of gaps — it does
// NOT feed computeBodyAngles, does NOT touch the scoring pipeline, is never
// persisted, and never compares one sample against another. The
// "approximate stature" it derives (§ completeMissingLandmarks below) is a
// transient in-memory ratio used once to place a missing joint on THIS
// frame's overlay, then discarded with the rest of the component's local
// state — it is not a stored biometric attribute, not compared across
// sessions, and not reusable to re-identify anyone. If this module is ever
// wired into anything beyond a live rendering overlay (persistence, a
// second sample for comparison, cross-session matching), stop and re-read
// §3.2 first.

// ---------------------------------------------------------------------
// Landmark indices — MediaPipe's full 33-point Pose Landmarker topology.
// angles.ts's own LANDMARK_INDEX only names the subset the scoring formulas
// read; this is the complete set, needed here because the skeleton overlay
// draws every point, not just the scoring-relevant ones.
// https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker
// ---------------------------------------------------------------------
export const LANDMARK_INDEX = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
} as const;

type LandmarkName = keyof typeof LANDMARK_INDEX;

// ---------------------------------------------------------------------
// Bone topology — pairs of landmark indices. Hand-curated for this module
// rather than re-exported from draw-skeleton.ts: that file draws
// PoseLandmarker.POSE_CONNECTIONS straight from the MediaPipe library (a
// larger, unlabeled face-mesh-shaped set), and there was nothing local to
// extract. This list is deliberately smaller and named. The head cluster
// connects to the torso via two real landmarks (NOSE-LEFT_SHOULDER,
// NOSE-RIGHT_SHOULDER) rather than a synthetic "neck" point, so every
// connection stays a plain index pair — no virtual/computed points needed
// just to draw the topology.
// ---------------------------------------------------------------------
export const POSE_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  // Torso
  [LANDMARK_INDEX.LEFT_SHOULDER, LANDMARK_INDEX.RIGHT_SHOULDER],
  [LANDMARK_INDEX.LEFT_HIP, LANDMARK_INDEX.RIGHT_HIP],
  [LANDMARK_INDEX.LEFT_SHOULDER, LANDMARK_INDEX.LEFT_HIP],
  [LANDMARK_INDEX.RIGHT_SHOULDER, LANDMARK_INDEX.RIGHT_HIP],
  // Left arm
  [LANDMARK_INDEX.LEFT_SHOULDER, LANDMARK_INDEX.LEFT_ELBOW],
  [LANDMARK_INDEX.LEFT_ELBOW, LANDMARK_INDEX.LEFT_WRIST],
  // Right arm
  [LANDMARK_INDEX.RIGHT_SHOULDER, LANDMARK_INDEX.RIGHT_ELBOW],
  [LANDMARK_INDEX.RIGHT_ELBOW, LANDMARK_INDEX.RIGHT_WRIST],
  // Left leg
  [LANDMARK_INDEX.LEFT_HIP, LANDMARK_INDEX.LEFT_KNEE],
  [LANDMARK_INDEX.LEFT_KNEE, LANDMARK_INDEX.LEFT_ANKLE],
  // Right leg
  [LANDMARK_INDEX.RIGHT_HIP, LANDMARK_INDEX.RIGHT_KNEE],
  [LANDMARK_INDEX.RIGHT_KNEE, LANDMARK_INDEX.RIGHT_ANKLE],
  // Head
  [LANDMARK_INDEX.NOSE, LANDMARK_INDEX.LEFT_EYE],
  [LANDMARK_INDEX.LEFT_EYE, LANDMARK_INDEX.LEFT_EAR],
  [LANDMARK_INDEX.NOSE, LANDMARK_INDEX.RIGHT_EYE],
  [LANDMARK_INDEX.RIGHT_EYE, LANDMARK_INDEX.RIGHT_EAR],
  [LANDMARK_INDEX.MOUTH_LEFT, LANDMARK_INDEX.MOUTH_RIGHT],
  // Head-to-torso approximation (see comment above — two real landmarks
  // standing in for a "neck" line to the shoulder midpoint).
  [LANDMARK_INDEX.NOSE, LANDMARK_INDEX.LEFT_SHOULDER],
  [LANDMARK_INDEX.NOSE, LANDMARK_INDEX.RIGHT_SHOULDER],
  // Feet (optional, per spec — included for a complete overlay)
  [LANDMARK_INDEX.LEFT_ANKLE, LANDMARK_INDEX.LEFT_HEEL],
  [LANDMARK_INDEX.LEFT_HEEL, LANDMARK_INDEX.LEFT_FOOT_INDEX],
  [LANDMARK_INDEX.LEFT_ANKLE, LANDMARK_INDEX.LEFT_FOOT_INDEX],
  [LANDMARK_INDEX.RIGHT_ANKLE, LANDMARK_INDEX.RIGHT_HEEL],
  [LANDMARK_INDEX.RIGHT_HEEL, LANDMARK_INDEX.RIGHT_FOOT_INDEX],
  [LANDMARK_INDEX.RIGHT_ANKLE, LANDMARK_INDEX.RIGHT_FOOT_INDEX],
];

// ---------------------------------------------------------------------
// Confidence classification
// ---------------------------------------------------------------------
export type LandmarkConfidence = "measured" | "estimated" | "missing";

// A landmark this module itself fabricated (mirrored or proportionally
// estimated) is "inferred" — distinct from "estimated", which is
// MediaPipe's own low-confidence guess. Never conflate the two: a renderer
// should be able to draw "inferred" segments even more distinctly
// (e.g. more heavily dashed) than "estimated" ones.
export type SkeletonLandmarkConfidence = LandmarkConfidence | "inferred";

// Coordinates within [0,1] but at/near the origin with near-zero
// visibility is MediaPipe's degenerate "I have no idea" fallback (see
// CLAUDE.md's MIN_LANDMARK_VISIBILITY note: the out-of-frame-hips capture
// that produced a confident-looking but meaningless NECK score reported
// coordinates like this) — different from a genuinely plausible
// low-confidence extrapolation elsewhere in frame.
const DEGENERATE_COORDINATE_EPSILON = 0.02;
const DEGENERATE_VISIBILITY_THRESHOLD = 0.05;

// Classifies a single landmark's usability for visualization. Distinct
// from (and deliberately looser than) the scoring pipeline's
// MIN_LANDMARK_VISIBILITY gate in computeBodyAngles, which rejects a whole
// BodyRegion outright rather than drawing a best-effort position — this
// classification exists so a renderer *can* still show something for a
// low-confidence point, just visually marked as such.
//
// Off-screen alone does NOT make a landmark "missing" — MediaPipe routinely
// extrapolates a real, usable position for a joint that's walked out of
// frame (e.g. hips below the bottom edge during a deep bend), and that
// extrapolation is exactly the kind of "rough but better than nothing"
// position this classification exists to let through as "estimated". Only
// the genuinely degenerate case — near-origin coordinates with near-zero
// visibility, MediaPipe's own "I have no idea" fallback shape — is
// "missing", regardless of whether that near-origin point happens to fall
// just inside or just outside the [0,1] frame bounds (that boundary is
// coincidental, not meaningful). An EARLIER version of this function also
// treated any off-screen coordinate as "missing" outright; that was too
// aggressive and produced skeletons with real, usable joints hidden simply
// because the subject stepped out of frame — see completeMissingLandmarks'
// own fallback pass below for the residual true-degenerate case this still
// leaves.
export function classifyLandmarkConfidence(
  landmark: PoseLandmark,
): LandmarkConfidence {
  const visibility = landmark.visibility ?? 0;
  const onScreen =
    landmark.x >= 0 && landmark.x <= 1 && landmark.y >= 0 && landmark.y <= 1;

  if (visibility >= MIN_LANDMARK_VISIBILITY && onScreen) return "measured";

  const nearOrigin =
    Math.abs(landmark.x) < DEGENERATE_COORDINATE_EPSILON &&
    Math.abs(landmark.y) < DEGENERATE_COORDINATE_EPSILON;
  const degenerate = nearOrigin && visibility < DEGENERATE_VISIBILITY_THRESHOLD;

  return degenerate ? "missing" : "estimated";
}

// ---------------------------------------------------------------------
// Pure 2D geometry helpers (self-contained — angles.ts's equivalents are
// private to that module, and these are generic enough not to be worth
// sharing beyond copy/paste of a few lines).
// ---------------------------------------------------------------------
type Point2D = { x: number; y: number };

function distance(a: Point2D, b: Point2D): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function averagePoint(points: readonly Point2D[]): Point2D | null {
  if (points.length === 0) return null;
  return {
    x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
    y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
  };
}

// Reflects `point` across the infinite line through `lineA`/`lineB`.
function reflectAcrossLine(
  point: Point2D,
  lineA: Point2D,
  lineB: Point2D,
): Point2D {
  const dx = lineB.x - lineA.x;
  const dy = lineB.y - lineA.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return point;
  const t =
    ((point.x - lineA.x) * dx + (point.y - lineA.y) * dy) / lengthSquared;
  const closest = { x: lineA.x + t * dx, y: lineA.y + t * dy };
  return { x: 2 * closest.x - point.x, y: 2 * closest.y - point.y };
}

// Included angle at `vertex` between rays to `a` and `c`, in degrees
// [0,180] — same magnitude-only convention as angles.ts's includedAngle.
function includedAngleDegrees(a: Point2D, vertex: Point2D, c: Point2D): number {
  const va = { x: a.x - vertex.x, y: a.y - vertex.y };
  const vc = { x: c.x - vertex.x, y: c.y - vertex.y };
  const magnitude = Math.hypot(va.x, va.y) * Math.hypot(vc.x, vc.y);
  if (magnitude === 0) return 0;
  const cos = Math.min(
    1,
    Math.max(-1, (va.x * vc.x + va.y * vc.y) / magnitude),
  );
  return (Math.acos(cos) * 180) / Math.PI;
}

// Same flexion-from-neutral convention CLAUDE.md mandates for the scoring
// pipeline (0° = straight/neutral, increasing = more flexed) — reused here
// rather than inventing a second convention, even though this value never
// reaches a ScoringRule lookup.
function flexionFromNeutral(includedDegrees: number): number {
  return 180 - includedDegrees;
}

// Rotates `child` around `vertex` (preserving vertex-to-child distance) so
// the parent-vertex-child included angle's flexion-from-neutral value falls
// within [min, max]. A no-op if it already does. Used only to adjust a
// landmark THIS module fabricated (see the scope note on FLEXION_CONSTRAINTS
// below) — never a measured or estimated (real MediaPipe) position.
function clampChildToFlexionRange(
  vertex: Point2D,
  parent: Point2D,
  child: Point2D,
  min: number,
  max: number,
): Point2D {
  const included = includedAngleDegrees(parent, vertex, child);
  const flexion = flexionFromNeutral(included);
  const clampedFlexion = Math.min(max, Math.max(min, flexion));
  if (clampedFlexion === flexion) return child;

  const vp = { x: parent.x - vertex.x, y: parent.y - vertex.y };
  const vc = { x: child.x - vertex.x, y: child.y - vertex.y };
  const currentSignedRadians = Math.atan2(
    vp.x * vc.y - vp.y * vc.x,
    vp.x * vc.x + vp.y * vc.y,
  );
  const sign = currentSignedRadians === 0 ? 1 : Math.sign(currentSignedRadians);
  const targetIncluded = 180 - clampedFlexion;
  const targetSignedRadians = (sign * targetIncluded * Math.PI) / 180;
  const deltaRadians = targetSignedRadians - currentSignedRadians;

  const cos = Math.cos(deltaRadians);
  const sin = Math.sin(deltaRadians);
  return {
    x: vertex.x + (vc.x * cos - vc.y * sin),
    y: vertex.y + (vc.x * sin + vc.y * cos),
  };
}

// ---------------------------------------------------------------------
// Anthropometric segment ratios — Drillis & Contini (1966) / Winter
// (2009), standard public-domain biomechanics textbook values, expressed
// as a fraction of stature. Used only as a last-resort placement when
// neither the measured landmark nor its mirror partner is usable — never
// as an input to scoring (see the compliance note at the top of this
// file).
// ---------------------------------------------------------------------
const STATURE_TO_SHOULDER_HIP_RATIO = 0.288;
const SEGMENT_RATIO_OF_STATURE = {
  UPPER_ARM: 0.186,
  FOREARM: 0.146,
  UPPER_LEG: 0.245,
  LOWER_LEG: 0.233,
} as const;

// Head+neck length (vertex to the shoulder line) as a fraction of stature —
// same anthropometric source family as SEGMENT_RATIO_OF_STATURE above
// (Drillis & Contini (1966) / Winter (2009)). Used only by
// completeMissingLandmarks' final fallback pass to place NOSE when it has
// no mirror partner and no proportional chain of its own to fall back on
// (unlike every limb segment above) — not a measurement used anywhere near
// scoring.
const HEAD_ABOVE_SHOULDER_RATIO_OF_STATURE = 0.182;

// Landmarks this module will attempt to fill in when "missing" — every
// paired (LEFT_*/RIGHT_*) landmark except SHOULDER and HIP. Those two are
// deliberately excluded from MIRRORING specifically: reflecting one
// shoulder/hip off the other ACROSS THE SHOULDER-HIP MIDLINE ITSELF (the
// axis every other mirror in this table uses) degenerates to a no-op when
// that midline is partly derived from the very point being mirrored — see
// completeMissingLandmarks' own cross-reflection step for how a still-
// missing shoulder or hip is actually resolved instead (reflected across a
// DIFFERENT line, anchored at the *other* pair's midpoint, which sidesteps
// exactly that circularity). Not "stays missing forever" the way this
// comment used to claim — there is no anthropometric width ratio for
// shoulder/hip in this file, but a plain reflection needs no ratio.
const MIRROR_PAIRS: ReadonlyArray<readonly [LandmarkName, LandmarkName]> = [
  ["LEFT_EYE_INNER", "RIGHT_EYE_INNER"],
  ["LEFT_EYE", "RIGHT_EYE"],
  ["LEFT_EYE_OUTER", "RIGHT_EYE_OUTER"],
  ["LEFT_EAR", "RIGHT_EAR"],
  ["MOUTH_LEFT", "MOUTH_RIGHT"],
  ["LEFT_ELBOW", "RIGHT_ELBOW"],
  ["LEFT_WRIST", "RIGHT_WRIST"],
  ["LEFT_PINKY", "RIGHT_PINKY"],
  ["LEFT_INDEX", "RIGHT_INDEX"],
  ["LEFT_THUMB", "RIGHT_THUMB"],
  ["LEFT_KNEE", "RIGHT_KNEE"],
  ["LEFT_ANKLE", "RIGHT_ANKLE"],
  ["LEFT_HEEL", "RIGHT_HEEL"],
  ["LEFT_FOOT_INDEX", "RIGHT_FOOT_INDEX"],
];

// Proximal-to-distal placement chains — only the four segments an
// anthropometric ratio was given for. `grandparent: null` means "first
// joint in its chain": with no earlier segment to continue the direction
// of, it's placed straight down the torso axis (a neutral, arms/legs-at-
// rest default), same as every other unresolvable-direction case in this
// module falls back to a plain, documented assumption rather than a guess.
type ProportionalChainStep = {
  landmark: LandmarkName;
  parent: LandmarkName;
  grandparent: LandmarkName | null;
  ratioOfStature: number;
};

const PROPORTIONAL_CHAINS: readonly ProportionalChainStep[] = [
  {
    landmark: "LEFT_ELBOW",
    parent: "LEFT_SHOULDER",
    grandparent: null,
    ratioOfStature: SEGMENT_RATIO_OF_STATURE.UPPER_ARM,
  },
  {
    landmark: "LEFT_WRIST",
    parent: "LEFT_ELBOW",
    grandparent: "LEFT_SHOULDER",
    ratioOfStature: SEGMENT_RATIO_OF_STATURE.FOREARM,
  },
  {
    landmark: "RIGHT_ELBOW",
    parent: "RIGHT_SHOULDER",
    grandparent: null,
    ratioOfStature: SEGMENT_RATIO_OF_STATURE.UPPER_ARM,
  },
  {
    landmark: "RIGHT_WRIST",
    parent: "RIGHT_ELBOW",
    grandparent: "RIGHT_SHOULDER",
    ratioOfStature: SEGMENT_RATIO_OF_STATURE.FOREARM,
  },
  {
    landmark: "LEFT_KNEE",
    parent: "LEFT_HIP",
    grandparent: null,
    ratioOfStature: SEGMENT_RATIO_OF_STATURE.UPPER_LEG,
  },
  {
    landmark: "LEFT_ANKLE",
    parent: "LEFT_KNEE",
    grandparent: "LEFT_HIP",
    ratioOfStature: SEGMENT_RATIO_OF_STATURE.LOWER_LEG,
  },
  {
    landmark: "RIGHT_KNEE",
    parent: "RIGHT_HIP",
    grandparent: null,
    ratioOfStature: SEGMENT_RATIO_OF_STATURE.UPPER_LEG,
  },
  {
    landmark: "RIGHT_ANKLE",
    parent: "RIGHT_KNEE",
    grandparent: "RIGHT_HIP",
    ratioOfStature: SEGMENT_RATIO_OF_STATURE.LOWER_LEG,
  },
];

// Soft visualization ROM limits — not hard limits, not fed into scoring.
// { vertex, parent, child } mirrors angles.ts's own (a, vertex, c) formulas
// for ELBOW/KNEE/TRUNK exactly, so the flexion sign convention matches.
// Applied only when `child` is a landmark THIS module fabricated (see the
// pass below) — a fabricated vertex whose neighbors are both real
// MediaPipe data is deliberately left uncorrected, since fixing it would
// mean moving one of those real points, which this module never does.
//
// Honesty note on the two hyperextension limits: includedAngleDegrees is
// magnitude-only (acos is bounded to [0,180], same convention angles.ts
// uses for TRUNK/ELBOW/KNEE), so flexionFromNeutral can never go below 0 —
// there is no way for this formula to represent "bent 5° past straight in
// the other direction" as a negative number, the way angles.ts's NECK
// formula can via its own signed facing-direction heuristic. The two
// negative bounds below are specified anyway, literally matching the
// anatomical intent, but under this convention `Math.max(min, flexion)`
// with flexion >= 0 always returns flexion unchanged — they're a
// documented no-op today, not a hidden bug, and would only become live if
// this module grew a signed convention for these two joints. The trunk
// bound below is the one of the three that's actually reachable: forward
// trunk flexion legitimately ranges well past 90° in this formula, so a
// fabricated knee position genuinely can, and does, get corrected by it —
// see skeleton.test.ts.
const ELBOW_HYPEREXTENSION_LIMIT_DEGREES = -5;
const KNEE_HYPEREXTENSION_LIMIT_DEGREES = -10;
const TRUNK_MAX_FLEXION_DEGREES = 90;

const FLEXION_CONSTRAINTS: ReadonlyArray<{
  vertex: LandmarkName;
  parent: LandmarkName;
  child: LandmarkName;
  min: number;
  max: number;
}> = [
  {
    vertex: "LEFT_ELBOW",
    parent: "LEFT_SHOULDER",
    child: "LEFT_WRIST",
    min: ELBOW_HYPEREXTENSION_LIMIT_DEGREES,
    max: Number.POSITIVE_INFINITY,
  },
  {
    vertex: "RIGHT_ELBOW",
    parent: "RIGHT_SHOULDER",
    child: "RIGHT_WRIST",
    min: ELBOW_HYPEREXTENSION_LIMIT_DEGREES,
    max: Number.POSITIVE_INFINITY,
  },
  {
    vertex: "LEFT_KNEE",
    parent: "LEFT_HIP",
    child: "LEFT_ANKLE",
    min: KNEE_HYPEREXTENSION_LIMIT_DEGREES,
    max: Number.POSITIVE_INFINITY,
  },
  {
    vertex: "RIGHT_KNEE",
    parent: "RIGHT_HIP",
    child: "RIGHT_ANKLE",
    min: KNEE_HYPEREXTENSION_LIMIT_DEGREES,
    max: Number.POSITIVE_INFINITY,
  },
  // Trunk has no landmark of its own (angles.ts derives it from
  // shoulder-hip-knee) — applied at the HIP vertex instead, the same
  // vertex angles.ts's own TRUNK formula uses, constraining a fabricated
  // KNEE against the (always-real, per the mirror-eligibility note above)
  // SHOULDER/HIP anchors.
  {
    vertex: "LEFT_HIP",
    parent: "LEFT_SHOULDER",
    child: "LEFT_KNEE",
    min: Number.NEGATIVE_INFINITY,
    max: TRUNK_MAX_FLEXION_DEGREES,
  },
  {
    vertex: "RIGHT_HIP",
    parent: "RIGHT_SHOULDER",
    child: "RIGHT_KNEE",
    min: Number.NEGATIVE_INFINITY,
    max: TRUNK_MAX_FLEXION_DEGREES,
  },
];

export type SkeletonLandmark = {
  index: number;
  x: number;
  y: number;
  z: number;
  visibility: number;
  confidence: SkeletonLandmarkConfidence;
  /** The raw MediaPipe landmark, untouched — always present even when x/y/z/visibility above were fabricated. */
  original: PoseLandmark;
};

// Fills in "missing" landmarks (per classifyLandmarkConfidence) for
// visualization. "measured" and "estimated" landmarks pass through
// unchanged — this module never second-guesses real MediaPipe output,
// only fills genuine gaps. Five passes:
//   1. Classify every landmark.
//   2. Shoulder/hip cross-reflection: a still-missing shoulder is
//      reflected from its opposite side across a HIP-anchored vertical
//      line (not the shoulder-hip midline MIRROR_PAIRS uses — see that
//      table's own comment on why that would degenerate); a still-missing
//      hip is reflected the same way across a SHOULDER-anchored vertical
//      line. Runs before mirroring/proportional estimation specifically so
//      a resolved shoulder/hip is available as a valid parent for those.
//   3. Mirror: reflect a measured/estimated landmark from the opposite
//      side across the torso midline, for any still-missing paired
//      landmark in MIRROR_PAIRS.
//   4. Proportional: for the four limb segments with a given anthropometric
//      ratio, place a still-missing landmark from its (now-resolved, by an
//      earlier step) parent joint, then apply the soft ROM clamp.
//   5. Final completeness fallback: NOSE (no mirror partner, no
//      proportional chain), the face cluster on a side with nothing to
//      mirror from, and the two decorative foot landmarks (HEEL/
//      FOOT_INDEX, no proportional chain either) — plus a defensive
//      catch-all for any OTHER landmark somehow still "missing" at this
//      point. This is what guarantees the function's return value is
//      ALWAYS a complete 33-landmark set once a torso midline exists at
//      all (see the very next paragraph for the one case it doesn't).
// If the torso midline itself can't be computed (both shoulders AND both
// hips missing — no anchor to place anything relative to, not even
// approximately), nothing downstream can be inferred: every affected
// landmark is returned exactly as classified, unmodified. This is the one
// remaining case where a "missing" landmark can still reach a caller.
export function completeMissingLandmarks(
  keypoints: PoseLandmarks,
): SkeletonLandmark[] {
  const points: SkeletonLandmark[] = keypoints.map((landmark, index) => ({
    index,
    x: landmark.x,
    y: landmark.y,
    z: landmark.z,
    visibility: landmark.visibility ?? 0,
    confidence: classifyLandmarkConfidence(landmark),
    original: landmark,
  }));

  const at = (name: LandmarkName): SkeletonLandmark =>
    points[LANDMARK_INDEX[name]];
  const usablePoint = (name: LandmarkName): Point2D | null => {
    const p = at(name);
    return p.confidence === "missing" ? null : { x: p.x, y: p.y };
  };

  const shoulderMid = averagePoint(
    [usablePoint("LEFT_SHOULDER"), usablePoint("RIGHT_SHOULDER")].filter(
      (p): p is Point2D => p !== null,
    ),
  );
  const hipMid = averagePoint(
    [usablePoint("LEFT_HIP"), usablePoint("RIGHT_HIP")].filter(
      (p): p is Point2D => p !== null,
    ),
  );

  if (!shoulderMid || !hipMid) {
    // No torso midline to mirror across or derive stature from — every
    // "missing" landmark stays "missing", per the module-level contract:
    // never fabricate a position with nothing to anchor it to.
    return points;
  }

  const stature = distance(shoulderMid, hipMid) / STATURE_TO_SHOULDER_HIP_RATIO;
  const torsoDownDirection = normalize({
    x: hipMid.x - shoulderMid.x,
    y: hipMid.y - shoulderMid.y,
  });

  // Pass 2: shoulder/hip cross-reflection (see this function's own doc
  // comment for why this can't just be added to MIRROR_PAIRS). shoulderMid/
  // hipMid/stature/torsoDownDirection above are computed once, from
  // whatever was directly usable, and deliberately never recomputed as
  // inference proceeds — same convention passes 3/4 below already follow
  // (e.g. the "both elbows missing" case uses the real, un-mirrored
  // stature) — so a shoulder resolved here doesn't retroactively perturb
  // those torso reference values, only unblocks anything downstream that
  // needed this specific landmark as a parent.
  const verticalThroughHip = {
    x: hipMid.x + torsoDownDirection.x,
    y: hipMid.y + torsoDownDirection.y,
  };
  const verticalThroughShoulder = {
    x: shoulderMid.x + torsoDownDirection.x,
    y: shoulderMid.y + torsoDownDirection.y,
  };
  for (const [target, source] of [
    ["LEFT_SHOULDER", "RIGHT_SHOULDER"],
    ["RIGHT_SHOULDER", "LEFT_SHOULDER"],
  ] as const) {
    const targetPoint = at(target);
    if (targetPoint.confidence !== "missing") continue;
    const sourcePoint = usablePoint(source);
    if (!sourcePoint) continue; // both sides missing — nothing to reflect from
    const mirrored = reflectAcrossLine(sourcePoint, hipMid, verticalThroughHip);
    points[LANDMARK_INDEX[target]] = {
      ...targetPoint,
      x: mirrored.x,
      y: mirrored.y,
      z: 0,
      visibility: 0,
      confidence: "inferred",
    };
  }
  for (const [target, source] of [
    ["LEFT_HIP", "RIGHT_HIP"],
    ["RIGHT_HIP", "LEFT_HIP"],
  ] as const) {
    const targetPoint = at(target);
    if (targetPoint.confidence !== "missing") continue;
    const sourcePoint = usablePoint(source);
    if (!sourcePoint) continue;
    const mirrored = reflectAcrossLine(
      sourcePoint,
      shoulderMid,
      verticalThroughShoulder,
    );
    points[LANDMARK_INDEX[target]] = {
      ...targetPoint,
      x: mirrored.x,
      y: mirrored.y,
      z: 0,
      visibility: 0,
      confidence: "inferred",
    };
  }

  // Pass 3: mirroring.
  for (const [left, right] of MIRROR_PAIRS) {
    for (const [target, source] of [
      [left, right],
      [right, left],
    ] as const) {
      const targetPoint = at(target);
      if (targetPoint.confidence !== "missing") continue;
      const sourcePoint = usablePoint(source);
      if (!sourcePoint) continue;

      const mirrored = reflectAcrossLine(sourcePoint, shoulderMid, hipMid);
      points[LANDMARK_INDEX[target]] = {
        ...targetPoint,
        x: mirrored.x,
        y: mirrored.y,
        z: 0,
        visibility: 0,
        confidence: "inferred",
      };
    }
  }

  // Pass 4: proportional estimation, proximal-to-distal so a chain's own
  // earlier step (e.g. an elbow just placed) is available as the next
  // step's parent (e.g. the wrist).
  for (const step of PROPORTIONAL_CHAINS) {
    const target = at(step.landmark);
    if (target.confidence !== "missing") continue;

    const parentPoint = usablePoint(step.parent);
    if (!parentPoint) continue; // no anchor — leave "missing"

    const grandparentPoint = step.grandparent
      ? usablePoint(step.grandparent)
      : null;
    const direction =
      grandparentPoint && distance(grandparentPoint, parentPoint) > 0
        ? normalize({
            x: parentPoint.x - grandparentPoint.x,
            y: parentPoint.y - grandparentPoint.y,
          })
        : torsoDownDirection;

    const segmentLength = step.ratioOfStature * stature;
    const estimated = {
      x: parentPoint.x + direction.x * segmentLength,
      y: parentPoint.y + direction.y * segmentLength,
    };
    points[LANDMARK_INDEX[step.landmark]] = {
      ...target,
      x: estimated.x,
      y: estimated.y,
      z: 0,
      visibility: 0,
      confidence: "inferred",
    };
  }

  // Soft ROM clamp — only ever adjusts a `child` this pass itself just
  // fabricated (see FLEXION_CONSTRAINTS' comment).
  for (const constraint of FLEXION_CONSTRAINTS) {
    const childPoint = at(constraint.child);
    if (childPoint.confidence !== "inferred") continue;
    const vertexPoint = usablePoint(constraint.vertex);
    const parentPoint = usablePoint(constraint.parent);
    if (!vertexPoint || !parentPoint) continue;

    const clamped = clampChildToFlexionRange(
      vertexPoint,
      parentPoint,
      { x: childPoint.x, y: childPoint.y },
      constraint.min,
      constraint.max,
    );
    if (clamped.x === childPoint.x && clamped.y === childPoint.y) continue;

    points[LANDMARK_INDEX[constraint.child]] = {
      ...childPoint,
      x: clamped.x,
      y: clamped.y,
    };
  }

  // Pass 5: final completeness fallback. Everything above already resolves
  // the overwhelming majority of a real capture — this only ever fires for
  // landmarks structurally outside all of it: NOSE (no mirror partner, no
  // proportional chain), a face-cluster point on a side with nothing to
  // mirror from, and the two purely-decorative foot landmarks (a mirror
  // pair each, but no proportional chain to fall back to if BOTH sides are
  // degenerate). Everything placed here is "inferred" (this module's own
  // fabricated-position marker — see SkeletonLandmarkConfidence's own doc
  // comment), same as every other fabricated position above.
  const nose = at("NOSE");
  const headAnchor: Point2D =
    nose.confidence === "missing"
      ? {
          x:
            shoulderMid.x -
            torsoDownDirection.x *
              HEAD_ABOVE_SHOULDER_RATIO_OF_STATURE *
              stature,
          y:
            shoulderMid.y -
            torsoDownDirection.y *
              HEAD_ABOVE_SHOULDER_RATIO_OF_STATURE *
              stature,
        }
      : { x: nose.x, y: nose.y };
  if (nose.confidence === "missing") {
    points[LANDMARK_INDEX.NOSE] = {
      ...nose,
      x: headAnchor.x,
      y: headAnchor.y,
      z: 0,
      visibility: 0,
      confidence: "inferred",
    };
  }

  const FACE_CLUSTER: readonly LandmarkName[] = [
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
  ];
  for (const name of FACE_CLUSTER) {
    const point = at(name);
    if (point.confidence !== "missing") continue;
    // No per-feature ratio for eye/ear/mouth offsets from the nose exists
    // in this file (or is worth adding for landmarks POSE_CONNECTIONS only
    // ever draws as decorative face lines) — collapsing onto the resolved
    // head position is a deliberately crude last resort, not a claim about
    // real facial geometry.
    points[LANDMARK_INDEX[name]] = {
      ...point,
      x: headAnchor.x,
      y: headAnchor.y,
      z: 0,
      visibility: 0,
      confidence: "inferred",
    };
  }

  const FOOT_CLUSTER: ReadonlyArray<readonly [LandmarkName, LandmarkName]> = [
    ["LEFT_HEEL", "LEFT_ANKLE"],
    ["RIGHT_HEEL", "RIGHT_ANKLE"],
    ["LEFT_FOOT_INDEX", "LEFT_ANKLE"],
    ["RIGHT_FOOT_INDEX", "RIGHT_ANKLE"],
  ];
  for (const [name, ankleName] of FOOT_CLUSTER) {
    const point = at(name);
    if (point.confidence !== "missing") continue;
    // Same reasoning as FACE_CLUSTER above: no foot-length ratio exists in
    // this file, and HEEL/FOOT_INDEX are purely decorative (POSE_CONNECTIONS'
    // own "optional, per spec" comment) — defaulting to the resolved
    // ankle's own position (a zero-length foot) is crude but harmless.
    const ankle = at(ankleName);
    const anchor = ankle.confidence !== "missing" ? ankle : hipMid;
    points[LANDMARK_INDEX[name]] = {
      ...point,
      x: anchor.x,
      y: anchor.y,
      z: 0,
      visibility: 0,
      confidence: "inferred",
    };
  }

  // Defensive catch-all: every one of the 33 landmarks should already be
  // covered by a pass above, so nothing should actually reach this loop —
  // it exists so "always returns a complete skeleton" is guaranteed
  // unconditionally, rather than resting entirely on that reasoning never
  // having a gap (now or after a future edit to LANDMARK_INDEX/
  // MIRROR_PAIRS/PROPORTIONAL_CHAINS).
  for (const point of points) {
    if (point.confidence !== "missing") continue;
    points[point.index] = {
      ...point,
      x: hipMid.x,
      y: hipMid.y,
      z: 0,
      visibility: 0,
      confidence: "inferred",
    };
  }

  return points;
}

function normalize(v: Point2D): Point2D {
  const length = Math.hypot(v.x, v.y);
  return length === 0 ? { x: 0, y: 0 } : { x: v.x / length, y: v.y / length };
}

// ---------------------------------------------------------------------
// 3D projection — MediaPipe's normalized image-space landmarks (x/y in
// [0,1], z relative depth) to three.js Vector3 positions for a 3D
// renderer. Still pure math: three.js's Vector3 is a plain math class, no
// DOM/WebGL/Canvas dependency, so importing it here doesn't violate this
// module's "no renderer" contract any more than importing a matrix-math
// library would.
//
// Takes PoseLandmarks (the same type completeMissingLandmarks accepts)
// rather than the raw Prisma `Json` PostureSample.keypoints is persisted
// as — every call site in this app already casts that raw Json to
// PoseLandmarks before calling into this module (see
// `sample.keypoints as unknown as PoseLandmarks` in the task/admin/report
// pages), and this function follows that same established boundary rather
// than being the one function in the module that accepts untyped JSON.
// SkeletonLandmark (this module's own completeMissingLandmarks output, and
// forward-kinematics.ts's applyAngleAdjustments output) structurally
// satisfies PoseLandmarks too — same x/y/z fields — so this same function
// projects a raw capture, a gap-filled skeleton, or a what-if-adjusted
// skeleton without a second overload.
// ---------------------------------------------------------------------

// Multiplies MediaPipe's [0,1]-normalized coordinates up to human-scale
// scene units. A standing adult's head-to-heel span covers roughly 85% of
// a well-framed capture's normalized height (~0.85), so scaling by 2 puts
// a standing figure at roughly 1.7 scene units tall. Exported so a caller
// that receives a drag position in this module's 3D scene-unit space (e.g.
// posture-editor.tsx, converting Skeleton3D's onJointDrag output back to
// MediaPipe space before handing it to drag-to-angle.ts) can invert this
// exact transform rather than hand-copying the "2" as an untraceable magic
// number that could silently drift out of sync with this one.
export const THREE_D_SCALE = 2;

// x: MediaPipe increases left-to-right, same as three.js's +x — no flip.
// y: MediaPipe increases top-to-bottom (image convention); three.js's +y
//    is up, so the sign flips.
// z: MediaPipe's z is relative depth from the hip center, negative =
//    closer to the camera; inverted here so "closer to camera" reads as
//    +z, three.js's own toward-the-viewer convention (see CLAUDE.md's z
//    caveat in angles.ts — z still isn't used for any scoring geometry,
//    only for this visualization projection).
export function landmarksTo3DPositions(
  keypoints: PoseLandmarks,
): THREE.Vector3[] {
  return keypoints.map(
    (landmark) =>
      new THREE.Vector3(
        landmark.x * THREE_D_SCALE,
        -landmark.y * THREE_D_SCALE,
        -landmark.z * THREE_D_SCALE,
      ),
  );
}

// ---------------------------------------------------------------------
// BodyRegion -> bone segments (pairs of landmark indices) for a 3D
// renderer to color by that region's risk band — the inverse of
// skeleton-viewer.tsx's own BONE_REGIONS (bone -> region), rebuilt here
// rather than imported from that client component since this module must
// stay free of anything React/DOM. Only the 8 BodyRegion values
// angles.ts's ComputedBodyRegion actually produces a reading for have
// bones listed — every other BodyRegion has no formula and therefore
// nothing of its OWN to color-code (same "only what's scored" scope as
// skeleton-viewer.tsx's own comment on this exact table) — EXCEPT that
// ELBOW_LEFT/RIGHT's own bone was always [elbow, wrist], i.e. the forearm
// segment, and KNEE_LEFT/RIGHT's now includes [knee, ankle], i.e. the
// shin: the joint that's actually scored (elbow flexion, knee flexion)
// visually "owns" the segment leading away from it toward the next,
// unscored joint (wrist, ankle) — the same convention SHOULDER_LEFT/RIGHT
// already established for the upper arm. FOREARM_LEFT/RIGHT itself
// deliberately has no entry here: it isn't a second, independent region
// to color — it's the exact bone ELBOW_LEFT/RIGHT already colors, under a
// different anatomical name. Giving FOREARM its own (always-empty, since
// it has no ScoringRule) entry would just mean the same pixels have two
// competing region owners.
// ---------------------------------------------------------------------
export const BODY_REGION_BONES: Partial<
  Record<BodyRegion, ReadonlyArray<readonly [number, number]>>
> = {
  TRUNK: [
    [LANDMARK_INDEX.LEFT_SHOULDER, LANDMARK_INDEX.LEFT_HIP],
    [LANDMARK_INDEX.RIGHT_SHOULDER, LANDMARK_INDEX.RIGHT_HIP],
    [LANDMARK_INDEX.LEFT_SHOULDER, LANDMARK_INDEX.RIGHT_SHOULDER],
    [LANDMARK_INDEX.LEFT_HIP, LANDMARK_INDEX.RIGHT_HIP],
  ],
  // The two head-to-shoulder bones standing in for a neck line — same
  // approximation POSE_CONNECTIONS' own comment documents.
  NECK: [
    [LANDMARK_INDEX.NOSE, LANDMARK_INDEX.LEFT_SHOULDER],
    [LANDMARK_INDEX.NOSE, LANDMARK_INDEX.RIGHT_SHOULDER],
  ],
  SHOULDER_LEFT: [[LANDMARK_INDEX.LEFT_SHOULDER, LANDMARK_INDEX.LEFT_ELBOW]],
  SHOULDER_RIGHT: [[LANDMARK_INDEX.RIGHT_SHOULDER, LANDMARK_INDEX.RIGHT_ELBOW]],
  // The forearm segment — see this table's own top comment for why
  // FOREARM_LEFT/RIGHT has no entry of its own.
  ELBOW_LEFT: [[LANDMARK_INDEX.LEFT_ELBOW, LANDMARK_INDEX.LEFT_WRIST]],
  ELBOW_RIGHT: [[LANDMARK_INDEX.RIGHT_ELBOW, LANDMARK_INDEX.RIGHT_WRIST]],
  // The upper leg (hip->knee) — knee posture affects the upper-leg
  // segment's orientation, same convention skeleton-viewer.tsx's
  // BONE_REGIONS uses for this region — AND the shin (knee->ankle), same
  // "owns the segment leading toward the next unscored joint" convention
  // as ELBOW's forearm above. ANKLE_LEFT/RIGHT has no entry of its own
  // for the same reason FOREARM doesn't.
  KNEE_LEFT: [
    [LANDMARK_INDEX.LEFT_HIP, LANDMARK_INDEX.LEFT_KNEE],
    [LANDMARK_INDEX.LEFT_KNEE, LANDMARK_INDEX.LEFT_ANKLE],
  ],
  KNEE_RIGHT: [
    [LANDMARK_INDEX.RIGHT_HIP, LANDMARK_INDEX.RIGHT_KNEE],
    [LANDMARK_INDEX.RIGHT_KNEE, LANDMARK_INDEX.RIGHT_ANKLE],
  ],
};

// ---------------------------------------------------------------------
// Draggable joint -> BodyRegion. Not every one of the 33 MediaPipe
// landmarks is draggable in a 3D what-if view — only the ones that sit at
// the vertex of a scored region's angle (matching
// forward-kinematics.ts's SIMPLE_JOINT_CONFIG vertices exactly for
// SHOULDER/ELBOW/KNEE, and NOSE as the head proxy for NECK, same as
// applyNeckRotation pivoting on the nose/shoulder-midpoint relationship).
// ---------------------------------------------------------------------

// TRUNK has no landmark of its own to drag: neither computeBodyAngles
// (angles.ts) nor applyTrunkRotation (forward-kinematics.ts) pivot on a
// single named joint — both work from the hip midpoint and shoulder
// midpoint. Reusing an existing shoulder's landmark index for TRUNK would
// collide with that shoulder's own SHOULDER_LEFT/RIGHT drag entry below (a
// landmark index can only map to one region here). A synthetic index one
// past MediaPipe's real 0-32 range stands in for a virtual "chest" handle
// at the shoulder midpoint instead — getVirtualChestPosition below
// computes where a renderer should draw it, from the same projected
// positions landmarksTo3DPositions returns.
export const VIRTUAL_CHEST_LANDMARK_INDEX = 33;

export function getVirtualChestPosition(
  positions: readonly THREE.Vector3[],
): THREE.Vector3 {
  return positions[LANDMARK_INDEX.LEFT_SHOULDER]
    .clone()
    .add(positions[LANDMARK_INDEX.RIGHT_SHOULDER])
    .multiplyScalar(0.5);
}

export const JOINT_REGIONS: Readonly<Record<number, BodyRegion>> = {
  [LANDMARK_INDEX.LEFT_SHOULDER]: "SHOULDER_LEFT",
  [LANDMARK_INDEX.RIGHT_SHOULDER]: "SHOULDER_RIGHT",
  [LANDMARK_INDEX.LEFT_ELBOW]: "ELBOW_LEFT",
  [LANDMARK_INDEX.RIGHT_ELBOW]: "ELBOW_RIGHT",
  [LANDMARK_INDEX.LEFT_KNEE]: "KNEE_LEFT",
  [LANDMARK_INDEX.RIGHT_KNEE]: "KNEE_RIGHT",
  [LANDMARK_INDEX.NOSE]: "NECK",
  [VIRTUAL_CHEST_LANDMARK_INDEX]: "TRUNK",
};

// ---------------------------------------------------------------------
// Soft range-of-motion limits for interactive dragging in the 3D what-if
// view, in the same flexion-from-neutral convention computeBodyAngles
// reports (0° = upright/neutral). Distinct from two other, easily
// confused things in this codebase:
//   - FLEXION_CONSTRAINTS above, which clamps a landmark THIS module
//     itself fabricated when filling a gap, not a user's live drag.
//   - ScoringRule's own angleMin/angleMax bands, which are the actual
//     scoring thresholds — these ANATOMICAL_LIMITS never feed a
//     ScoringRule lookup and exist purely to stop a drag gesture from
//     posing an anatomically impossible figure (e.g. an elbow bent past
//     145°). Widening or narrowing a ScoringRule band must never be done
//     by editing this table, and vice versa.
//
// Manipulable ⟺ has an entry here — the key set of JOINT_REGIONS' values
// equals the key set of this table exactly (see skeleton.test.ts's own
// invariant test). WRIST_LEFT/RIGHT, ANKLE_LEFT/RIGHT and HIP used to be
// draggable too, position-only with no angle/limit of their own
// (POSITION_ONLY_REGIONS, now removed — see
// SLD_POSTURE_EDITOR_FIDELITY_PLAN.md P1): WRIST needs MediaPipe's Hand
// Landmarker (a model this app doesn't run), ANKLE dorsiflexion and HIP
// (shoulder-hip-knee is TRUNK's own triangle, not independent
// information) are both unmeasurable/redundant for the same reasons
// documented in that plan. Free translation of an unscoreable joint was
// pure interaction cost with no angle to show for it — cut rather than
// kept as a non-clamping special case.
// ---------------------------------------------------------------------
export const ANATOMICAL_LIMITS: Partial<
  Record<BodyRegion, { min: number; max: number }>
> = {
  TRUNK: { min: 0, max: 90 },
  NECK: { min: -20, max: 60 },
  SHOULDER_LEFT: { min: 0, max: 180 },
  SHOULDER_RIGHT: { min: 0, max: 180 },
  ELBOW_LEFT: { min: 0, max: 145 },
  ELBOW_RIGHT: { min: 0, max: 145 },
  KNEE_LEFT: { min: 0, max: 130 },
  KNEE_RIGHT: { min: 0, max: 130 },
};
