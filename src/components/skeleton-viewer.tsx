"use client";

import type {
  BodyRegion,
  CameraAngle,
  RiskBand,
} from "@/generated/prisma/enums";
import {
  LANDMARK_INDEX,
  POSE_CONNECTIONS,
  type SkeletonLandmark,
  type SkeletonLandmarkConfidence,
} from "@/lib/pose/skeleton";
import { NOT_ASSESSED_COLOR, riskBandColors } from "@/lib/risk/band-severity";

// Pure rendering component: receives an ALREADY-COMPLETED landmark set
// (via completeMissingLandmarks, see skeleton.ts) and draws it — it never
// calls completeMissingLandmarks itself. This is deliberate, not an
// oversight: a caller that also applies forward-kinematics adjustments
// (see forward-kinematics.ts, e.g. the what-if simulator) needs to
// complete the *original* keypoints exactly once (memoized), then re-apply
// cheap per-render rotations to that stable result — if this component
// re-ran completion on every render's already-adjusted positions, that
// memoization would be pointless and every slider move would redo the
// (comparatively) expensive mirror/proportional-estimation math for
// nothing. No server imports, no data fetching — same "pure math in, SVG
// out" split as skeleton.ts feeding a renderer, one layer up.
//
// Responsive by design: the SVG has no fixed pixel width/height attribute,
// just a viewBox — `width`/`height` below size that internal coordinate
// space (and therefore the aspect ratio), while the actual rendered size
// is whatever CSS gives the component's container (w-full + height:auto).

const DEFAULT_WIDTH = 300;
const DEFAULT_HEIGHT = 500;
const VIEWPORT_PADDING = 24;
const MIN_BBOX_EXTENT = 0.01; // guards against a divide-by-zero scale when every usable landmark coincides
const HEAD_RADIUS_RATIO = 0.25; // "roughly 1/4 of shoulder-to-shoulder distance"

const MEASURED_STROKE_WIDTH = 3;
const LOWER_CONFIDENCE_STROKE_WIDTH = 2;
const MEASURED_OPACITY = 1;
const ESTIMATED_OPACITY = 0.5;
const INFERRED_OPACITY = 0.3;
const INFERRED_DASH = "4 3";

const MEASURED_JOINT_RADIUS = 5;
const LOWER_CONFIDENCE_JOINT_RADIUS = 4;

type Point = { x: number; y: number };
type BoundingBox = { minX: number; minY: number; maxX: number; maxY: number };

// Which of a bone's two confidence levels wins the pair's visual treatment
// — the weaker one always does, so a bone never looks more trustworthy
// than its least-trustworthy endpoint. "missing" means one endpoint has no
// plausible position at all (the torso midline itself was unavailable, see
// skeleton.ts) — nothing sensible to draw, so the bone is skipped outright
// rather than drawn to a degenerate near-(0,0) point.
type BoneStyle = "measured" | "estimated" | "inferred" | "skip";

function combineConfidence(
  a: SkeletonLandmarkConfidence,
  b: SkeletonLandmarkConfidence,
): BoneStyle {
  if (a === "missing" || b === "missing") return "skip";
  if (a === "inferred" || b === "inferred") return "inferred";
  if (a === "estimated" || b === "estimated") return "estimated";
  return "measured";
}

// Bone → BodyRegion, for the subset of BodyRegion values this app actually
// scores (see angles.ts's ComputedBodyRegion) and that therefore ever show
// up in a real highlightedRegions map. Follows the same
// "region name = the joint at the proximal end of the segment it colors"
// pattern the spec's own SHOULDER_LEFT/ELBOW_LEFT examples establish:
// SHOULDER_LEFT colors shoulder→elbow, ELBOW_LEFT colors elbow→wrist, so
// KNEE_LEFT colors knee→ankle by the same logic. The hip→knee (upper leg)
// bone has no lateralized scored region to attach to (BodyRegion.HIP isn't
// scored) and stays neutral. NECK colors the two head-to-shoulder bones
// that stand in for a neck line (see POSE_CONNECTIONS' own comment).
const BONE_REGIONS: ReadonlyArray<{
  pair: readonly [number, number];
  region: BodyRegion;
}> = [
  {
    pair: [LANDMARK_INDEX.LEFT_SHOULDER, LANDMARK_INDEX.RIGHT_SHOULDER],
    region: "TRUNK",
  },
  {
    pair: [LANDMARK_INDEX.LEFT_HIP, LANDMARK_INDEX.RIGHT_HIP],
    region: "TRUNK",
  },
  {
    pair: [LANDMARK_INDEX.LEFT_SHOULDER, LANDMARK_INDEX.LEFT_HIP],
    region: "TRUNK",
  },
  {
    pair: [LANDMARK_INDEX.RIGHT_SHOULDER, LANDMARK_INDEX.RIGHT_HIP],
    region: "TRUNK",
  },
  { pair: [LANDMARK_INDEX.NOSE, LANDMARK_INDEX.LEFT_SHOULDER], region: "NECK" },
  {
    pair: [LANDMARK_INDEX.NOSE, LANDMARK_INDEX.RIGHT_SHOULDER],
    region: "NECK",
  },
  {
    pair: [LANDMARK_INDEX.LEFT_SHOULDER, LANDMARK_INDEX.LEFT_ELBOW],
    region: "SHOULDER_LEFT",
  },
  {
    pair: [LANDMARK_INDEX.RIGHT_SHOULDER, LANDMARK_INDEX.RIGHT_ELBOW],
    region: "SHOULDER_RIGHT",
  },
  {
    pair: [LANDMARK_INDEX.LEFT_ELBOW, LANDMARK_INDEX.LEFT_WRIST],
    region: "ELBOW_LEFT",
  },
  {
    pair: [LANDMARK_INDEX.RIGHT_ELBOW, LANDMARK_INDEX.RIGHT_WRIST],
    region: "ELBOW_RIGHT",
  },
  {
    pair: [LANDMARK_INDEX.LEFT_KNEE, LANDMARK_INDEX.LEFT_ANKLE],
    region: "KNEE_LEFT",
  },
  {
    pair: [LANDMARK_INDEX.RIGHT_KNEE, LANDMARK_INDEX.RIGHT_ANKLE],
    region: "KNEE_RIGHT",
  },
];

function regionForBone(a: number, b: number): BodyRegion | null {
  const found = BONE_REGIONS.find(
    (entry) =>
      (entry.pair[0] === a && entry.pair[1] === b) ||
      (entry.pair[0] === b && entry.pair[1] === a),
  );
  return found ? found.region : null;
}

// Bounding box of every landmark this module actually trusts (measured or
// estimated) — "inferred"/"missing" points are excluded so a fabricated
// limb can never stretch the view transform and shrink the real, observed
// figure to make room for it. Falls back to every landmark only in the
// degenerate case where nothing was trustworthy at all, so the view still
// renders something rather than dividing by an empty set.
function computeBoundingBox(
  landmarks: readonly {
    x: number;
    y: number;
    confidence: SkeletonLandmarkConfidence;
  }[],
): BoundingBox | null {
  const trusted = landmarks.filter(
    (l) => l.confidence === "measured" || l.confidence === "estimated",
  );
  const source = trusted.length > 0 ? trusted : landmarks;
  if (source.length === 0) return null;

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const p of source) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

// Uniform scale (never distorts the figure) that fits the bounding box
// within the padded viewport and centers it — MediaPipe's normalized
// coordinates already increase right/down exactly like SVG's own
// coordinate system, so this is a plain scale + translate, no axis flip.
function buildTransform(
  bbox: BoundingBox,
  width: number,
  height: number,
  padding: number,
): (p: Point) => Point {
  const bboxWidth = Math.max(bbox.maxX - bbox.minX, MIN_BBOX_EXTENT);
  const bboxHeight = Math.max(bbox.maxY - bbox.minY, MIN_BBOX_EXTENT);
  const availableWidth = Math.max(width - 2 * padding, 1);
  const availableHeight = Math.max(height - 2 * padding, 1);
  const scale = Math.min(
    availableWidth / bboxWidth,
    availableHeight / bboxHeight,
  );
  const contentWidth = bboxWidth * scale;
  const contentHeight = bboxHeight * scale;
  const offsetX =
    padding + (availableWidth - contentWidth) / 2 - bbox.minX * scale;
  const offsetY =
    padding + (availableHeight - contentHeight) / 2 - bbox.minY * scale;

  return (p) => ({ x: p.x * scale + offsetX, y: p.y * scale + offsetY });
}

function strokeWidthFor(style: "measured" | "estimated" | "inferred"): number {
  return style === "measured"
    ? MEASURED_STROKE_WIDTH
    : LOWER_CONFIDENCE_STROKE_WIDTH;
}

function opacityFor(style: "measured" | "estimated" | "inferred"): number {
  if (style === "measured") return MEASURED_OPACITY;
  return style === "estimated" ? ESTIMATED_OPACITY : INFERRED_OPACITY;
}

function dashFor(
  style: "measured" | "estimated" | "inferred",
): string | undefined {
  return style === "inferred" ? INFERRED_DASH : undefined;
}

function LegendSwatch({
  opacity,
  dashed,
}: {
  opacity: number;
  dashed?: boolean;
}) {
  return (
    <svg
      width="20"
      height="8"
      viewBox="0 0 20 8"
      className="shrink-0"
      aria-hidden="true"
    >
      <line
        x1="0"
        y1="4"
        x2="20"
        y2="4"
        stroke="currentColor"
        strokeWidth="2"
        strokeOpacity={opacity}
        strokeDasharray={dashed ? INFERRED_DASH : undefined}
      />
    </svg>
  );
}

export function SkeletonViewer({
  landmarks,
  cameraAngle,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  highlightedRegions,
}: {
  landmarks: SkeletonLandmark[];
  cameraAngle: CameraAngle;
  width?: number;
  height?: number;
  highlightedRegions?: Partial<Record<BodyRegion, RiskBand>>;
}) {
  const bbox = computeBoundingBox(landmarks);

  if (!bbox) {
    return (
      <div className="flex min-h-[200px] w-full items-center justify-center rounded-lg border border-border p-4 text-center text-sm text-border">
        No landmarks to display.
      </div>
    );
  }

  const transform = buildTransform(bbox, width, height, VIEWPORT_PADDING);
  const projected: Point[] = landmarks.map((l) =>
    transform({ x: l.x, y: l.y }),
  );

  const nose = landmarks[LANDMARK_INDEX.NOSE];
  const leftShoulder = landmarks[LANDMARK_INDEX.LEFT_SHOULDER];
  const rightShoulder = landmarks[LANDMARK_INDEX.RIGHT_SHOULDER];
  const headStyle =
    nose.confidence === "missing"
      ? null
      : (nose.confidence as "measured" | "estimated" | "inferred");
  const headCircle =
    headStyle &&
    leftShoulder.confidence !== "missing" &&
    rightShoulder.confidence !== "missing"
      ? (() => {
          const noseP = projected[LANDMARK_INDEX.NOSE];
          const lsP = projected[LANDMARK_INDEX.LEFT_SHOULDER];
          const rsP = projected[LANDMARK_INDEX.RIGHT_SHOULDER];
          const shoulderWidth = Math.hypot(rsP.x - lsP.x, rsP.y - lsP.y);
          return { center: noseP, radius: shoulderWidth * HEAD_RADIUS_RATIO };
        })()
      : null;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-auto w-full"
        role="img"
        aria-label={`Posture skeleton (${cameraAngle.toLowerCase()} capture)`}
      >
        {POSE_CONNECTIONS.map(([a, b]) => {
          const style = combineConfidence(
            landmarks[a].confidence,
            landmarks[b].confidence,
          );
          if (style === "skip") return null;

          const region = highlightedRegions ? regionForBone(a, b) : null;
          const band = region ? highlightedRegions?.[region] : undefined;
          const stroke = highlightedRegions
            ? band
              ? riskBandColors[band]
              : NOT_ASSESSED_COLOR
            : "currentColor";

          const p1 = projected[a];
          const p2 = projected[b];
          return (
            <line
              key={`${a}-${b}`}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke={stroke}
              strokeWidth={strokeWidthFor(style)}
              strokeOpacity={opacityFor(style)}
              strokeDasharray={dashFor(style)}
              strokeLinecap="round"
            />
          );
        })}

        {landmarks.map((l) => {
          if (l.confidence === "missing") return null;
          if (l.index === LANDMARK_INDEX.NOSE) return null; // drawn as the head circle instead
          const style = l.confidence;
          const filled = style === "measured";
          const p = projected[l.index];
          return (
            <circle
              key={l.index}
              cx={p.x}
              cy={p.y}
              r={filled ? MEASURED_JOINT_RADIUS : LOWER_CONFIDENCE_JOINT_RADIUS}
              fill={filled ? "currentColor" : "none"}
              stroke={filled ? "none" : "currentColor"}
              strokeWidth={filled ? 0 : 1.5}
              strokeDasharray={dashFor(style)}
              opacity={opacityFor(style)}
            />
          );
        })}

        {headCircle && headStyle && (
          <circle
            cx={headCircle.center.x}
            cy={headCircle.center.y}
            r={headCircle.radius}
            fill={headStyle === "measured" ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth={headStyle === "measured" ? 0 : 1.5}
            strokeDasharray={dashFor(headStyle)}
            opacity={opacityFor(headStyle)}
          />
        )}
      </svg>

      <div className="mt-2 flex flex-col gap-1 font-technical text-xs text-border">
        <span>{cameraAngle} capture</span>
        <div className="flex items-center gap-2">
          <LegendSwatch opacity={MEASURED_OPACITY} />
          <span>Measured</span>
        </div>
        <div className="flex items-center gap-2">
          <LegendSwatch opacity={ESTIMATED_OPACITY} />
          <span>Camera estimate</span>
        </div>
        <div className="flex items-center gap-2">
          <LegendSwatch opacity={INFERRED_OPACITY} dashed />
          <span>Inferred from body proportions</span>
        </div>
      </div>
    </div>
  );
}
