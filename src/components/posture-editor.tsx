"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  BodyRegion,
  CameraAngle,
  RiskBand,
  ValidationStatus,
} from "@/generated/prisma/enums";
import { describeRegionResult } from "@/lib/capture/describe-region-result";
import type { RegionResult } from "@/lib/capture/types";
import type { PoseLandmarks } from "@/lib/pose/angles";
import { computeAllAngles } from "@/lib/pose/drag-to-angle";
import {
  applyAngleInput,
  applyJointDrag,
  applyPositionDrag,
  createPostureEditor,
  getRegionDelta,
  type PostureEditorState,
  type RegionDelta,
  resetAll,
  resetRegion,
  type ScoringRuleRow,
} from "@/lib/pose/posture-editor";
import {
  ANATOMICAL_LIMITS,
  completeMissingLandmarks,
  JOINT_REGIONS,
  POSITION_ONLY_REGIONS,
  type SkeletonLandmark,
  type SkeletonLandmarkConfidence,
  THREE_D_SCALE,
} from "@/lib/pose/skeleton";
import { NOT_ASSESSED_COLOR, riskBandColors } from "@/lib/risk/band-severity";
import { matchScoringRule } from "@/lib/scoring/match";
import { Skeleton3D } from "./skeleton-3d";

// The primary measurement review and adjustment surface for a
// PostureSample — replaces the old WhatIfSimulator/PostureSampleSimulatorToggle
// pair entirely (see those files' removal). Where the old simulator was a
// secondary, collapsible "what if the angle were different" exploration
// tool sitting below a read-only results table, this component IS the
// results view: a live 3D skeleton the user can drag or type exact angles
// into, feeding the same posture-editor.ts state machine either way, ending
// in an explicit human validation step (ERGO_COMPLIANCE_BY_DESIGN.md §3.4).
//
// A minimal structural stand-in for Prisma's JsonValue — this component
// only ever treats it as "cast to PoseLandmarks" or "build a plain array of
// plain landmark objects to hand back," never inspects its shape beyond
// that, so importing the generated client's actual Json type (and whatever
// it pulls in) isn't worth it. Same reasoning ScoringRuleRow in
// posture-editor.ts gives for not importing the generated ScoringRuleModel.
type Json = unknown;

export type PostureEditorProps = {
  postureSampleId: string;
  /** The original, immutable MediaPipe capture — never mutated, always available for "what did the camera actually see." */
  keypoints: Json;
  cameraAngle: CameraAngle;
  /** Per-region result from buildRegionResults, exactly as computed/persisted at capture time — the audit-trail-faithful "measured" baseline for every region row. */
  regionResults: Record<BodyRegion, RegionResult>;
  /** A previously-validated keypoints set, if this sample has one — the session resumes from here instead of from `keypoints`. */
  validatedKeypoints?: Json | null;
  validationStatus: ValidationStatus;
  /** When validationStatus is VALIDATED, shown alongside the "Validated ✓" indicator. */
  validatedAt?: Date | string | null;
  /**
   * Server action: persists the given keypoints as this sample's validated
   * measurement and re-scores from them (the same pipeline the original
   * capture used), returning the resulting per-region results. This
   * component uses the RETURN VALUE, not just a page-level revalidation,
   * to update the region panel immediately — that re-score runs the real,
   * camera-angle-*gated* scoring pipeline server-side, which can
   * legitimately disagree with this component's own live, ungated
   * (computeAllAngles) display for a region that fails that gate, so the
   * server's answer is the one shown once validation succeeds.
   */
  onValidate: (validatedKeypoints: Json) => Promise<{
    regionResults: Record<BodyRegion, RegionResult>;
    validatedAt: Date | string;
  }>;
  /**
   * Server action: reopens an already-VALIDATED sample back to
   * PENDING_REVIEW (reopenPostureSampleForEdit) so it can be edited and
   * re-validated — every call is its own audited
   * PostureSampleValidationEvent row, never a silent overwrite. Returns
   * regionResults recomputed from the original camera capture (not the
   * just-superseded validated posture), which this component uses to
   * immediately rebuild the editing session — see handleReopen below.
   */
  onReopen: (note: string | null) => Promise<{
    regionResults: Record<BodyRegion, RegionResult>;
  }>;
};

// ---------------------------------------------------------------------
// Region metadata — every BodyRegion, in display order, and which kind of
// row each one renders as:
//   - 8 angle-based, scored regions (JOINT_REGIONS): TRUNK, NECK,
//     SHOULDER_LEFT/RIGHT, ELBOW_LEFT/RIGHT, KNEE_LEFT/RIGHT — RegionRow,
//     with a slider.
//   - 5 position-only regions (skeleton.ts's POSITION_ONLY_REGIONS — see
//     that export's own comment for the full rationale): WRIST_LEFT/RIGHT,
//     ANKLE_LEFT/RIGHT, HIP — PositionOnlyRegionRow, draggable but no
//     angle/slider/score.
//   - 4 regions with no row of their own at all (UPPER_ARM_LEFT/RIGHT,
//     FOREARM_LEFT/RIGHT) — SharedMeasurementRegionRow: they're already
//     the exact bone segments SHOULDER/ELBOW color (skeleton.ts's
//     BODY_REGION_BONES), not a second thing to independently edit.
// ---------------------------------------------------------------------
const REGION_ORDER: readonly BodyRegion[] = [
  "TRUNK",
  "NECK",
  "SHOULDER_LEFT",
  "SHOULDER_RIGHT",
  "UPPER_ARM_LEFT",
  "UPPER_ARM_RIGHT",
  "ELBOW_LEFT",
  "ELBOW_RIGHT",
  "FOREARM_LEFT",
  "FOREARM_RIGHT",
  "WRIST_LEFT",
  "WRIST_RIGHT",
  "HIP",
  "KNEE_LEFT",
  "KNEE_RIGHT",
  "ANKLE_LEFT",
  "ANKLE_RIGHT",
];

// Hand-authored presentation copy over the enum, same category as
// what-if-simulator.tsx's own (now-removed) REGION_LABELS — English-only
// for now, matching that component's precedent: this surface has no page
// wiring yet for i18n to attach to (see CLAUDE.md's i18n scope notes).
const REGION_LABELS: Record<BodyRegion, string> = {
  TRUNK: "Trunk",
  NECK: "Neck",
  SHOULDER_LEFT: "Left Shoulder",
  SHOULDER_RIGHT: "Right Shoulder",
  UPPER_ARM_LEFT: "Left Upper Arm",
  UPPER_ARM_RIGHT: "Right Upper Arm",
  ELBOW_LEFT: "Left Elbow",
  ELBOW_RIGHT: "Right Elbow",
  FOREARM_LEFT: "Left Forearm",
  FOREARM_RIGHT: "Right Forearm",
  WRIST_LEFT: "Left Wrist",
  WRIST_RIGHT: "Right Wrist",
  HIP: "Hip",
  KNEE_LEFT: "Left Knee",
  KNEE_RIGHT: "Right Knee",
  ANKLE_LEFT: "Left Ankle",
  ANKLE_RIGHT: "Right Ankle",
};

const ANGLE_EDITABLE_REGIONS = new Set<BodyRegion>(
  Object.values(JOINT_REGIONS),
);
const POSITION_ONLY_REGION_SET = new Set<BodyRegion>(
  Object.values(POSITION_ONLY_REGIONS),
);
const DRAGGABLE_JOINTS = [
  ...Object.keys(JOINT_REGIONS).map(Number),
  ...Object.keys(POSITION_ONLY_REGIONS).map(Number),
];

const DESKTOP_SKELETON_SIZE = { width: 500, height: 600 };
const MOBILE_MAX_SKELETON_SIZE = 480;
const MOBILE_BREAKPOINT_PX = 768; // Tailwind's md — matches the lg switch below for the two-column layout
const MOBILE_VIEWPORT_PADDING_PX = 48;

// Skeleton3D takes literal pixel width/height (see that component's own
// props doc), not a responsive CSS size — this hook is what gives "square
// aspect on mobile, taller rectangle on desktop" (per this component's
// mobile-layout spec) without changing Skeleton3D's own sizing model,
// which a whole separate task built and which nothing else in this app
// asks to be responsive.
function useSkeletonDimensions(): { width: number; height: number } {
  const [dimensions, setDimensions] = useState(DESKTOP_SKELETON_SIZE);

  useEffect(() => {
    const update = () => {
      if (window.innerWidth < MOBILE_BREAKPOINT_PX) {
        const size = Math.min(
          window.innerWidth - MOBILE_VIEWPORT_PADDING_PX,
          MOBILE_MAX_SKELETON_SIZE,
        );
        setDimensions({ width: size, height: size });
      } else {
        setDimensions(DESKTOP_SKELETON_SIZE);
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return dimensions;
}

// Duplicated from posture-editor.ts's own (private) bandsFromAngles — same
// three lines, same reasoning every other small cross-module duplicate in
// this codebase gives (skeleton.ts/skeleton-viewer.tsx,
// skeleton.ts/forward-kinematics.ts, drag-to-angle.ts/skeleton-3d.tsx):
// not worth exporting an internal helper across a module boundary for this
// little logic, and matchScoringRule/ScoringRuleRow are already the public,
// intended surface for this exact computation.
function bandsFromAngles(
  angles: ReadonlyMap<BodyRegion, number>,
  rules: readonly ScoringRuleRow[],
): Map<BodyRegion, RiskBand> {
  const bands = new Map<BodyRegion, RiskBand>();
  for (const [region, degrees] of angles) {
    const regionRules = rules.filter((rule) => rule.bodyRegion === region);
    const matched = matchScoringRule(regionRules, degrees);
    if (matched) bands.set(region, matched.riskBand);
  }
  return bands;
}

// Resumes a freshly-created editor (seeded from the TRUE original capture,
// so originalKeypoints/originalAngles/originalBands always stay the real
// audit-trail baseline — see createPostureEditor's own doc comment) at a
// previously-validated pose. Adopts `validatedKeypoints` directly as
// currentKeypoints — deliberately NOT by replaying angle deltas through
// applyAngleInput, which would risk reconstructing a subtly different pose
// from floating-point rotation composition instead of exactly what was
// actually saved. adjustedRegions is derived by diffing against the
// original angle per region, so the resumed session correctly shows which
// regions the user had already touched last time.
const ANGLE_EPSILON = 1e-6;

function resumeFromValidatedKeypoints(
  base: PostureEditorState,
  validatedLandmarks: PoseLandmarks,
  rules: ScoringRuleRow[],
): PostureEditorState {
  const currentKeypoints = completeMissingLandmarks(validatedLandmarks);
  const currentAngles = computeAllAngles(currentKeypoints);
  const currentBands = bandsFromAngles(currentAngles, rules);

  const adjustedRegions = new Set<BodyRegion>();
  for (const [region, degrees] of currentAngles) {
    const original = base.originalAngles.get(region);
    if (
      original === undefined ||
      Math.abs(original - degrees) > ANGLE_EPSILON
    ) {
      adjustedRegions.add(region);
    }
  }

  return {
    ...base,
    currentKeypoints,
    currentAngles,
    currentBands,
    adjustedRegions,
  };
}

// Builds the plain {x,y,z,visibility}[] to hand to onValidate. For every
// landmark index, compares `candidate` against `startingKeypoints` (the
// session's own starting completed pose — editorState.originalKeypoints):
// unchanged means this landmark was never actually part of any FK
// adjustment's distal set, so it falls back to `rawOriginal` (the literal
// original `keypoints` prop, byte for byte) rather than
// completeMissingLandmarks' gap-filled value. This is load-bearing, not
// cosmetic: completeMissingLandmarks fabricates "inferred" positions for
// visualization only (see that function's own compliance note) and this is
// the one place in this component where persisting the wrong array would
// leak that fabricated data into a "validated" record. A landmark that
// genuinely moved (dragged directly, or carried along by a parent region's
// rotation, e.g. the wrist after an elbow adjustment) uses its real new
// position from `candidate`.
function buildValidatedPayload(
  rawOriginal: PoseLandmarks,
  startingKeypoints: SkeletonLandmark[],
  candidate: SkeletonLandmark[],
): Json {
  return candidate.map((landmark, index) => {
    const starting = startingKeypoints[index];
    const touched = landmark.x !== starting.x || landmark.y !== starting.y;
    const source = touched ? landmark : rawOriginal[index];
    return {
      x: source.x,
      y: source.y,
      z: source.z,
      visibility: source.visibility,
    };
  });
}

function threeScenePositionToMediaPipe(position: {
  x: number;
  y: number;
  z: number;
}): { x: number; y: number; z: number } {
  // Exact inverse of landmarksTo3DPositions (skeleton.ts): x unscaled, y
  // and z sign-flipped-and-unscaled. Skeleton3D's onJointDrag reports
  // positions in that 3D scene-unit space (see its own prop doc); every
  // pure pose function downstream of here (computeAngleFromDrag,
  // applyAngleAdjustments) works in MediaPipe's normalized image space, so
  // this conversion has to happen exactly once, here, where both
  // conventions actually meet.
  return {
    x: position.x / THREE_D_SCALE,
    y: -position.y / THREE_D_SCALE,
    z: -position.z / THREE_D_SCALE,
  };
}

function BandDot({ band }: { band: RiskBand | null }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
      style={{
        backgroundColor: band ? riskBandColors[band] : NOT_ASSESSED_COLOR,
      }}
    />
  );
}

// Local, uncontrolled-feeling number input: keeps its own draft text while
// the user types, only calling onCommit on blur/Enter (never per
// keystroke, so an in-progress "-4" or "12." doesn't trigger a live FK
// cascade on every character), and resyncs its draft whenever the
// authoritative `value` changes from outside (a drag on the skeleton, or a
// reset).
function AngleNumberInput({
  id,
  value,
  min,
  max,
  onCommit,
}: {
  id: string;
  value: number | null;
  min?: number;
  max?: number;
  onCommit: (degrees: number) => void;
}) {
  const [draft, setDraft] = useState(value !== null ? value.toFixed(1) : "");

  useEffect(() => {
    setDraft(value !== null ? value.toFixed(1) : "");
  }, [value]);

  const commit = () => {
    const parsed = Number.parseFloat(draft);
    if (Number.isFinite(parsed)) {
      onCommit(parsed);
    } else {
      setDraft(value !== null ? value.toFixed(1) : "");
    }
  };

  return (
    <input
      id={id}
      type="number"
      inputMode="decimal"
      step={0.5}
      min={min}
      max={max}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
        }
      }}
      className="w-16 shrink-0 rounded border border-border bg-background px-1.5 py-0.5 text-right font-technical text-xs"
    />
  );
}

// Builds a hard-stop CSS linear-gradient covering [min, max] and colored by
// `rules` (already filtered to one BodyRegion) — the visual band map a
// reviewer drags across. Deliberately per-row REPEATED color stops (same
// color at a segment's start AND end percentage) rather than a smooth
// blend: ScoringRule bands are discrete, not a continuous scale, so the
// gradient should look like colored zones with sharp edges, not a fade.
// ScoringRule has no cameraAngle column (see prisma/schema.prisma) — the
// camera-angle gate lives in computeBodyAngles, deciding whether a region
// is readable at all, not in the rule lookup itself — so this only filters
// by bodyRegion, matching every other rule-matching call site in this file
// (bandsFromAngles above) and in posture-editor.ts.
//
// A gap between rule ranges (or the union of ranges not covering the full
// [min, max] anatomical range) renders NOT_ASSESSED_COLOR, same meaning
// BandDot/ValidatedRegionRow already give that color elsewhere in this
// file: "no ScoringRule covers this angle." matchScoringRule's own
// ambiguous-overlap case is a data-integrity bug it already throws loudly
// on elsewhere in this app (posture-editor.ts's applyResolvedAngle path);
// this purely-visual gradient doesn't re-throw for it, since a slightly
// wrong preview color is a much smaller problem than crashing the editor —
// it just paints whichever rule sorts first at that angle.
function buildTrackGradient(
  rules: readonly ScoringRuleRow[],
  region: BodyRegion,
  min: number,
  max: number,
): string {
  const span = max - min;
  if (span <= 0) return NOT_ASSESSED_COLOR;

  const regionRules = rules
    .filter((rule) => rule.bodyRegion === region)
    .map((rule) => ({
      start: Math.max(min, rule.angleMin ?? min),
      end: Math.min(max, rule.angleMax ?? max),
      color: riskBandColors[rule.riskBand],
    }))
    .filter((r) => r.end > r.start)
    .sort((a, b) => a.start - b.start);

  if (regionRules.length === 0) return NOT_ASSESSED_COLOR;

  const segments: { start: number; end: number; color: string }[] = [];
  let cursor = min;
  for (const rule of regionRules) {
    if (rule.start > cursor) {
      segments.push({
        start: cursor,
        end: rule.start,
        color: NOT_ASSESSED_COLOR,
      });
    }
    segments.push(rule);
    cursor = Math.max(cursor, rule.end);
  }
  if (cursor < max) {
    segments.push({ start: cursor, end: max, color: NOT_ASSESSED_COLOR });
  }

  const stops = segments.flatMap((segment) => {
    const startPct = ((segment.start - min) / span) * 100;
    const endPct = ((segment.end - min) / span) * 100;
    return [`${segment.color} ${startPct}%`, `${segment.color} ${endPct}%`];
  });

  return `linear-gradient(to right, ${stops.join(", ")})`;
}

// Primary angle input — a colored range slider whose track literally shows
// the scoring bands (e.g. ELBOW's HIGH-below-20/LOW-20-100/HIGH-above-100
// non-monotonic rule set naturally renders red-green-red, explaining the
// scoring visually instead of requiring the reviewer to remember it).
// Fires onChange on every native `input` event — React's onChange for a
// range input already IS the continuous drag event, not a release-only
// `change` — so the caller (RegionRow -> handleAngleCommit -> applyAngleInput,
// both pure O(1) lookups) re-scores live as the thumb moves, matching the
// number input's separate commit-on-blur behavior for the secondary field
// next to it.
//
// Styling approach: the colored gradient is painted on a wrapping <div>;
// the <input type="range"> itself sits on top with its own track made
// transparent (`.angle-slider` in globals.css — appearance:none plus the
// ::-webkit-slider-runnable-track/::-moz-range-track transparent overrides)
// so the div's gradient shows through. Chosen over styling the gradient
// directly onto ::-webkit-slider-runnable-track/::-moz-range-track because
// those two pseudo-elements don't share a syntax (one is a background
// shorthand context, the other isn't) and would mean computing the same
// gradient string twice for two different property names; a plain
// `background` on a div behind a transparent input needs it computed once.
function AngleSlider({
  region,
  value,
  min,
  max,
  rules,
  onChange,
}: {
  region: BodyRegion;
  value: number | null;
  min: number;
  max: number;
  rules: readonly ScoringRuleRow[];
  onChange: (degrees: number) => void;
}) {
  const gradient = useMemo(
    () => buildTrackGradient(rules, region, min, max),
    [rules, region, min, max],
  );
  const sliderValue =
    value === null ? min : Math.min(max, Math.max(min, value));

  return (
    <div
      // flex-1 + min-w-0, NOT w-full: this div is a flex child alongside the
      // fixed-width number input and degree sign in RegionRow's row. w-full
      // sets this item's flex-basis to the WHOLE row's width regardless of
      // those siblings — with default flex-shrink math that starves (or on
      // a narrow enough row, entirely displaces) them, which is exactly
      // what made the number input render "out of frame" and left the
      // actual draggable slider area collapsed to a sliver too thin to
      // grab. flex-1 correctly means "take the space left over after
      // siblings claim theirs"; min-w-0 stops a flex item's default
      // min-width:auto from fighting that shrink.
      className="relative h-3 min-w-0 flex-1 rounded-full"
      style={{ background: gradient }}
    >
      <input
        type="range"
        aria-label={`${REGION_LABELS[region]} angle`}
        min={min}
        max={max}
        step={0.5}
        value={sliderValue}
        onChange={(event) => onChange(Number.parseFloat(event.target.value))}
        className="angle-slider absolute inset-0 h-full w-full"
      />
    </div>
  );
}

// Read-only summary shown once a sample is validated (locally, right after
// a successful onValidate call, or because it already was on mount) —
// there's no more editing at that point, so this replaces the interactive
// RegionRow/UnsupportedRegionRow pair entirely rather than just disabling
// their controls. Renders straight from the server's authoritative
// re-scored `regionResults`, not the client's own (possibly-gated-
// differently) editor state — see onValidate's prop doc for why that
// distinction matters.
function ValidatedRegionRow({
  region,
  result,
}: {
  region: BodyRegion;
  result: RegionResult;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface p-3">
      <span className="font-heading font-bold">{REGION_LABELS[region]}</span>
      {result.status === "scored" ? (
        <span className="flex items-center gap-1.5 font-technical text-xs">
          <BandDot band={result.riskBand} />
          {result.degrees.toFixed(1)}° — {result.riskBand}
        </span>
      ) : (
        <span className="font-technical text-xs text-border">
          {describeRegionResult(result)}
        </span>
      )}
    </div>
  );
}

// UPPER_ARM_LEFT/RIGHT and FOREARM_LEFT/RIGHT aren't separately editable
// regions with their own row/slider — they're already the exact bone
// segments SHOULDER_LEFT/RIGHT and ELBOW_LEFT/RIGHT color (see
// skeleton.ts's BODY_REGION_BONES' own comment for why: a real, separate
// upper-arm/forearm measurement would be rotation around the limb's own
// long axis — humeral rotation, forearm pronation/supination — which a
// single 2D camera can't observe). Naming which joint actually drives each
// one here, rather than a bare "not yet supported", makes that an
// intentional design boundary visible in the UI, not a gap that reads like
// unfinished work.
const SHARED_MEASUREMENT_SOURCE: Partial<Record<BodyRegion, string>> = {
  UPPER_ARM_LEFT: "Left Shoulder",
  UPPER_ARM_RIGHT: "Right Shoulder",
  FOREARM_LEFT: "Left Elbow",
  FOREARM_RIGHT: "Right Elbow",
};

function SharedMeasurementRegionRow({ region }: { region: BodyRegion }) {
  const source = SHARED_MEASUREMENT_SOURCE[region];
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/50 bg-surface/50 p-3 opacity-60">
      <span className="font-heading font-bold">{REGION_LABELS[region]}</span>
      <span className="font-technical text-xs text-border">
        {source
          ? `no separate measurement — see ${source}`
          : "not yet supported"}
      </span>
    </div>
  );
}

// WRIST_LEFT/RIGHT, ANKLE_LEFT/RIGHT, and HIP (skeleton.ts's
// POSITION_ONLY_REGIONS — see that export's own comment for the full
// rationale) are real, functional, draggable parts of the skeleton with
// no independent angle or score: "the whole hand"/"the whole foot"/"the
// pelvis" gets a position relative to the rest of the body, deliberately
// no more granular than that. This row is the position-only equivalent of
// RegionRow below — same isAdjusted/reset affordance, no slider or angle
// input since there's no angle to show one for.
function PositionOnlyRegionRow({
  region,
  isAdjusted,
  onReset,
}: {
  region: BodyRegion;
  isAdjusted: boolean;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-heading font-bold">
            {REGION_LABELS[region]}
          </span>
          {isAdjusted && (
            <span
              className="flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 font-technical text-[11px] font-bold text-accent"
              title="Repositioned from the camera-measured position"
            >
              <span aria-hidden="true">✎</span> Adjusted
            </span>
          )}
        </div>
        {isAdjusted && (
          <button
            type="button"
            onClick={onReset}
            aria-label={`Reset ${REGION_LABELS[region]} to measured position`}
            title="Reset to measured position"
            className="rounded px-1.5 py-0.5 font-technical text-sm text-border hover:text-accent"
          >
            ↩
          </button>
        )}
      </div>
      <span className="font-technical text-xs text-border">
        Position only — drag on the skeleton to reposition. No independent
        ergonomic score for this region.
      </span>
    </div>
  );
}

function RegionRow({
  idPrefix,
  region,
  originalResult,
  delta,
  rules,
  onAngleCommit,
  onReset,
}: {
  idPrefix: string;
  region: BodyRegion;
  originalResult: RegionResult;
  delta: RegionDelta;
  rules: readonly ScoringRuleRow[];
  onAngleCommit: (degrees: number) => void;
  onReset: () => void;
}) {
  const wasScored =
    originalResult.status === "scored" ||
    originalResult.status === "no-matching-rule";
  const adjustmentLabel = delta.isAdjusted
    ? wasScored
      ? "Adjusted"
      : "User-provided"
    : null;
  const bandChanged =
    delta.isAdjusted &&
    delta.originalBand !== null &&
    delta.currentBand !== null &&
    delta.originalBand !== delta.currentBand;
  const limits = ANATOMICAL_LIMITS[region];

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-heading font-bold">
            {REGION_LABELS[region]}
          </span>
          {adjustmentLabel && (
            <span
              className="flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 font-technical text-[11px] font-bold text-accent"
              title={
                adjustmentLabel === "Adjusted"
                  ? "Changed from the camera-measured angle"
                  : "Provided by the reviewer — the camera could not measure this region"
              }
            >
              <span aria-hidden="true">✎</span> {adjustmentLabel}
            </span>
          )}
        </div>
        {delta.isAdjusted && (
          <button
            type="button"
            onClick={onReset}
            aria-label={`Reset ${REGION_LABELS[region]} to measured`}
            title="Reset to measured"
            className="rounded px-1.5 py-0.5 font-technical text-sm text-border hover:text-accent"
          >
            ↩
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-technical text-xs">
        {wasScored ? (
          <span className="text-border">
            Measured {(delta.originalAngle as number).toFixed(1)}°
          </span>
        ) : (
          <span className="text-border">
            {describeRegionResult(originalResult)}
          </span>
        )}

        {delta.isAdjusted && delta.currentAngle !== null && (
          <span className="font-bold text-accent">
            Current {delta.currentAngle.toFixed(1)}°
          </span>
        )}

        {bandChanged ? (
          <span className="flex items-center gap-1.5">
            <BandDot band={delta.originalBand} />
            {delta.originalBand}
            <span aria-hidden="true">→</span>
            <BandDot band={delta.currentBand} />
            {delta.currentBand}
          </span>
        ) : delta.currentBand ? (
          <span className="flex items-center gap-1.5">
            <BandDot band={delta.currentBand} />
            {delta.currentBand}
          </span>
        ) : (
          wasScored && <span className="text-border">no threshold matched</span>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          {/* limits is always defined here in practice — RegionRow only
              ever renders for EDITABLE_REGIONS (JOINT_REGIONS' keys), which
              is exactly ANATOMICAL_LIMITS' key set — but the fallback keeps
              this branch type-safe against ANATOMICAL_LIMITS' Partial type
              without threading a non-null assertion through. */}
          <AngleSlider
            region={region}
            value={delta.currentAngle}
            min={limits?.min ?? 0}
            max={limits?.max ?? 180}
            rules={rules}
            onChange={onAngleCommit}
          />
          <label className="sr-only" htmlFor={`${idPrefix}-angle-${region}`}>
            {REGION_LABELS[region]} angle, exact value
          </label>
          <AngleNumberInput
            id={`${idPrefix}-angle-${region}`}
            value={delta.currentAngle}
            min={limits?.min}
            max={limits?.max}
            onCommit={onAngleCommit}
          />
          <span
            className="font-technical text-xs text-border"
            aria-hidden="true"
          >
            °
          </span>
        </div>
        <span className="flex items-center gap-1.5 font-technical text-xs">
          <BandDot band={delta.currentBand} />
          {delta.currentAngle !== null
            ? `${delta.currentAngle.toFixed(1)}° — ${delta.currentBand ?? "no threshold matched"}`
            : "—"}
        </span>
      </div>
    </div>
  );
}

// Local, uncontrolled-feeling reveal for the reopen action: a validated
// sample is meant to feel final, so "Edit this measurement" doesn't
// immediately act — it discloses an optional reason field and an explicit
// confirm step, same progressive-disclosure spirit as this file's
// hasAdjustments-gated explanatory paragraph below.
function ReopenControl({
  isSubmitting,
  onReopen,
}: {
  isSubmitting: boolean;
  onReopen: (note: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState("");

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="self-start font-technical text-xs text-border underline hover:text-accent"
      >
        Edit this measurement
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3">
      <label
        htmlFor="reopen-note"
        className="font-technical text-xs text-border"
      >
        This measurement was already validated — reopening it starts a new
        review. Reason (optional):
      </label>
      <textarea
        id="reopen-note"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        rows={2}
        className="rounded border border-border bg-background px-2 py-1 font-technical text-sm"
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => {
            onReopen(note.trim() ? note.trim() : null);
            setExpanded(false);
            setNote("");
          }}
          className="rounded-md bg-accent px-3 py-1.5 font-heading text-sm font-bold text-teal transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Confirm reopen
        </button>
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => {
            setExpanded(false);
            setNote("");
          }}
          className="rounded-md border border-border px-3 py-1.5 font-heading text-sm font-bold text-foreground transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function ValidationControls({
  validationStatus,
  validatedAt,
  hasAdjustments,
  isSubmitting,
  onValidateAdjusted,
  onAcceptMeasured,
  onResetAll,
  onReopen,
}: {
  validationStatus: ValidationStatus;
  validatedAt?: Date | string | null;
  hasAdjustments: boolean;
  isSubmitting: boolean;
  onValidateAdjusted: () => void;
  onAcceptMeasured: () => void;
  onResetAll: () => void;
  onReopen: (note: string | null) => void;
}) {
  if (validationStatus === "VALIDATED") {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface px-4 py-3">
          <span className="font-heading font-bold text-accent">
            Validated ✓
          </span>
          {validatedAt && (
            <span className="font-technical text-xs text-border">
              {new Date(validatedAt).toLocaleString()}
            </span>
          )}
        </div>
        <ReopenControl isSubmitting={isSubmitting} onReopen={onReopen} />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={!hasAdjustments || isSubmitting}
        onClick={onValidateAdjusted}
        className="rounded-md bg-accent px-4 py-2 font-heading font-bold text-teal transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Validate posture
      </button>
      <button
        type="button"
        disabled={isSubmitting}
        onClick={onAcceptMeasured}
        className="rounded-md border border-border px-4 py-2 font-heading font-bold text-foreground transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
      >
        Accept as measured
      </button>
      {hasAdjustments && (
        <button
          type="button"
          disabled={isSubmitting}
          onClick={onResetAll}
          className="font-technical text-xs text-border underline hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          Reset all
        </button>
      )}
      {hasAdjustments && (
        <p className="w-full font-technical text-xs text-border">
          "Accept as measured" confirms the original camera reading — your
          adjustments above won't be saved unless you use "Validate posture"
          instead.
        </p>
      )}
    </div>
  );
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; methodologyVersion: string; editor: PostureEditorState };

export function PostureEditor({
  postureSampleId,
  keypoints,
  cameraAngle,
  regionResults,
  validatedKeypoints,
  validationStatus,
  validatedAt,
  onValidate,
  onReopen,
}: PostureEditorProps) {
  const rawKeypoints = useMemo(
    () => keypoints as unknown as PoseLandmarks,
    [keypoints],
  );
  const rawValidatedKeypoints = useMemo(
    () =>
      validatedKeypoints
        ? (validatedKeypoints as unknown as PoseLandmarks)
        : null,
    [validatedKeypoints],
  );

  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  // Set once onValidate/onReopen resolves successfully — from then on this,
  // not the (now stale) validationStatus/validatedAt/regionResults props,
  // is the source of truth for display, until the parent re-renders with
  // fresh props of its own (a page navigation/revalidation, which this
  // local state then simply loses to since the props themselves will
  // already agree with it). Tracks BOTH directions of the validationStatus
  // state machine (validate and reopen), not just the validate-only shape
  // this used to be — see handleValidate/handleReopen below.
  const [statusOverride, setStatusOverride] = useState<
    | {
        direction: "validated";
        regionResults: Record<BodyRegion, RegionResult>;
        validatedAt: Date | string;
      }
    | { direction: "reopened"; regionResults: Record<BodyRegion, RegionResult> }
    | null
  >(null);
  const skeletonSize = useSkeletonDimensions();

  const effectiveValidationStatus: ValidationStatus =
    statusOverride?.direction === "validated"
      ? "VALIDATED"
      : statusOverride?.direction === "reopened"
        ? "PENDING_REVIEW"
        : validationStatus;
  const effectiveValidatedAt =
    statusOverride?.direction === "validated"
      ? statusOverride.validatedAt
      : validatedAt;
  const effectiveRegionResults =
    statusOverride?.direction === "validated"
      ? statusOverride.regionResults
      : regionResults;
  // The interactive (non-validated) branch's "Measured" baseline — reading
  // straight from the `regionResults` prop would show the just-superseded
  // VALIDATED posture's results for a moment after reopening, until a real
  // page navigation refreshes it (see handleReopen's own comment); this
  // swaps in the raw-capture regionResults reopenPostureSampleForEdit
  // already returned instead.
  const effectiveOriginalRegionResults =
    statusOverride?.direction === "reopened"
      ? statusOverride.regionResults
      : regionResults;
  const isValidated = effectiveValidationStatus === "VALIDATED";

  // Fetches the active rule set once (GET /api/scoring-rules, the same
  // endpoint the old simulator used) and initializes the editor session —
  // from validatedKeypoints if this sample already has them ("resume where
  // you left off"), from the raw capture otherwise. Depends on the actual
  // inputs rather than an empty array so a genuinely different sample
  // (this component keyed by postureSampleId at the call site) or a
  // freshly-validated payload re-initializes correctly; in practice none
  // of these change during one mounted session, matching the old
  // simulator's own mount-once fetch.
  useEffect(() => {
    let cancelled = false;
    setLoadState({ status: "loading" });

    fetch("/api/scoring-rules")
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(
            (body as { error?: string } | null)?.error ??
              `Request failed (${response.status})`,
          );
        }
        return (await response.json()) as {
          methodologyVersion: string;
          rules: ScoringRuleRow[];
        };
      })
      .then((data) => {
        if (cancelled) return;
        let editor = createPostureEditor(
          rawKeypoints,
          regionResults,
          data.rules,
        );
        if (rawValidatedKeypoints) {
          editor = resumeFromValidatedKeypoints(
            editor,
            rawValidatedKeypoints,
            data.rules,
          );
        }
        setLoadState({
          status: "ready",
          methodologyVersion: data.methodologyVersion,
          editor,
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadState({
          status: "error",
          message:
            err instanceof Error ? err.message : "Could not load scoring rules",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [rawKeypoints, regionResults, rawValidatedKeypoints]);

  const confidenceMap = useMemo(() => {
    const map = new Map<number, SkeletonLandmarkConfidence>();
    if (loadState.status !== "ready") return map;
    for (const landmark of loadState.editor.currentKeypoints) {
      map.set(landmark.index, landmark.confidence);
    }
    return map;
  }, [loadState]);

  if (loadState.status !== "ready") {
    return (
      <div className="flex flex-col gap-6">
        <FramingText cameraAngle={cameraAngle} />
        <div
          className="flex items-center justify-center rounded-lg border border-border bg-surface text-sm text-border"
          style={{ height: skeletonSize.height }}
        >
          {loadState.status === "loading"
            ? "Loading…"
            : `Could not load scoring rules: ${loadState.message}`}
        </div>
      </div>
    );
  }

  const editor = loadState.editor;

  const updateEditor = (next: PostureEditorState) => {
    setLoadState({
      status: "ready",
      methodologyVersion: loadState.methodologyVersion,
      editor: next,
    });
  };

  const handleJointDrag = (
    landmarkIndex: number,
    newPosition: { x: number; y: number; z: number },
  ) => {
    const mediaPipePosition = threeScenePositionToMediaPipe(newPosition);
    // Two entirely different resolutions depending on which kind of joint
    // was dragged (skeleton-3d.tsx itself doesn't distinguish them — see
    // that component's own regionForJoint, which checks JOINT_REGIONS and
    // POSITION_ONLY_REGIONS together purely for hover/halo/rigid-
    // constraint purposes): an angle-based joint resolves to a BodyRegion
    // angle via computeAngleFromDrag/applyJointDrag; a position-only one
    // (skeleton.ts's POSITION_ONLY_REGIONS) has no angle at all —
    // applyPositionDrag just translates it (and its cluster) directly.
    if (Object.hasOwn(POSITION_ONLY_REGIONS, landmarkIndex)) {
      updateEditor(applyPositionDrag(editor, landmarkIndex, mediaPipePosition));
      return;
    }
    updateEditor(applyJointDrag(editor, landmarkIndex, mediaPipePosition));
  };

  const handleAngleCommit = (region: BodyRegion, degrees: number) => {
    updateEditor(applyAngleInput(editor, region, degrees));
  };

  const handleResetRegion = (region: BodyRegion) => {
    updateEditor(resetRegion(editor, region));
  };

  const handleResetAll = () => {
    updateEditor(resetAll(editor));
  };

  // `resetToOriginal` distinguishes the two validation paths: "Accept as
  // measured" submits editor.originalKeypoints while the skeleton/region
  // panel might still be showing an in-progress, never-submitted
  // adjustment (the button's own label warns adjustments "won't be
  // saved") — resetting the editor here keeps what's displayed truthful
  // to what was actually just persisted, rather than leaving an abandoned
  // edit on screen next to a "Validated ✓" badge for the original.
  const runValidation = async (
    candidateKeypoints: SkeletonLandmark[],
    resetToOriginal: boolean,
  ) => {
    setIsSubmitting(true);
    setValidationError(null);
    try {
      const payload = buildValidatedPayload(
        rawKeypoints,
        editor.originalKeypoints,
        candidateKeypoints,
      );
      const result = await onValidate(payload);
      if (resetToOriginal) updateEditor(resetAll(editor));
      setStatusOverride({
        direction: "validated",
        regionResults: result.regionResults,
        validatedAt: result.validatedAt,
      });
    } catch (err) {
      setValidationError(
        err instanceof Error
          ? err.message
          : "Could not validate this posture sample",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reopens a VALIDATED sample and immediately rebuilds the editing session
  // from the freshly-recomputed (raw-capture) regionResults onReopen
  // returns — the same createPostureEditor + resumeFromValidatedKeypoints
  // pipeline the mount effect runs, just re-run in place instead of waiting
  // for a prop refresh. Without this, "Measured" would keep showing the
  // just-superseded validated posture (this component's own originalAngles/
  // originalBands, fixed at mount time) until a real page navigation caught
  // up — acceptable for the accordion's collapsed summary elsewhere in this
  // codebase, but not for the surface someone is about to actively re-edit.
  // Resuming from rawValidatedKeypoints (the last validated pose, still
  // present — reopenPostureSampleForEdit deliberately doesn't clear it)
  // rather than starting the edit over from the raw capture.
  const handleReopen = async (note: string | null) => {
    setIsSubmitting(true);
    setValidationError(null);
    try {
      const result = await onReopen(note);
      let nextEditor = createPostureEditor(
        rawKeypoints,
        result.regionResults,
        editor.rules,
      );
      if (rawValidatedKeypoints) {
        nextEditor = resumeFromValidatedKeypoints(
          nextEditor,
          rawValidatedKeypoints,
          editor.rules,
        );
      }
      updateEditor(nextEditor);
      setStatusOverride({
        direction: "reopened",
        regionResults: result.regionResults,
      });
    } catch (err) {
      setValidationError(
        err instanceof Error
          ? err.message
          : "Could not reopen this posture sample",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <FramingText cameraAngle={cameraAngle} />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="w-full shrink-0 lg:w-[55%]">
          <Skeleton3D
            keypoints={editor.currentKeypoints}
            confidenceMap={confidenceMap}
            regionBands={editor.currentBands}
            draggableJoints={isValidated ? [] : DRAGGABLE_JOINTS}
            onJointDrag={isValidated ? undefined : handleJointDrag}
            width={skeletonSize.width}
            height={skeletonSize.height}
          />
        </div>

        <div className="flex w-full min-w-0 flex-col gap-3 lg:w-[45%]">
          {isValidated
            ? REGION_ORDER.map((region) => (
                <ValidatedRegionRow
                  key={region}
                  region={region}
                  result={effectiveRegionResults[region]}
                />
              ))
            : REGION_ORDER.map((region) => {
                if (ANGLE_EDITABLE_REGIONS.has(region)) {
                  return (
                    <RegionRow
                      key={region}
                      idPrefix={postureSampleId}
                      region={region}
                      originalResult={effectiveOriginalRegionResults[region]}
                      delta={getRegionDelta(editor, region)}
                      rules={editor.rules}
                      onAngleCommit={(degrees) =>
                        handleAngleCommit(region, degrees)
                      }
                      onReset={() => handleResetRegion(region)}
                    />
                  );
                }
                if (POSITION_ONLY_REGION_SET.has(region)) {
                  return (
                    <PositionOnlyRegionRow
                      key={region}
                      region={region}
                      isAdjusted={editor.adjustedRegions.has(region)}
                      onReset={() => handleResetRegion(region)}
                    />
                  );
                }
                return (
                  <SharedMeasurementRegionRow key={region} region={region} />
                );
              })}
        </div>
      </div>

      <div className="sticky bottom-0 z-10 flex flex-col gap-3 border-t border-border bg-background/95 pt-4 pb-2 backdrop-blur-sm lg:static lg:bg-transparent lg:pb-0 lg:backdrop-blur-none">
        <p className="max-w-3xl text-sm text-border">
          Validation confirms this posture as the final measurement. Original
          camera detection is preserved for audit.
        </p>
        <p className="font-technical text-xs text-border">
          Scoring methodology: {loadState.methodologyVersion}
        </p>
        {validationError && (
          <p className="font-technical text-xs text-accent">
            {validationError}
          </p>
        )}
        <ValidationControls
          validationStatus={effectiveValidationStatus}
          validatedAt={effectiveValidatedAt}
          hasAdjustments={editor.adjustedRegions.size > 0}
          isSubmitting={isSubmitting}
          onValidateAdjusted={() =>
            runValidation(editor.currentKeypoints, false)
          }
          onAcceptMeasured={() => runValidation(editor.originalKeypoints, true)}
          onResetAll={handleResetAll}
          onReopen={handleReopen}
        />
      </div>
    </div>
  );
}

function FramingText({ cameraAngle }: { cameraAngle: CameraAngle }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="max-w-3xl text-sm text-border">
        Review and adjust the detected posture. Drag joints or enter angles to
        correct the measurement. Depth is estimated from a 2D capture.
      </p>
      <p className="font-technical text-xs text-border">
        Captured: {cameraAngle}
      </p>
    </div>
  );
}
