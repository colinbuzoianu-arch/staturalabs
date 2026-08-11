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
// Region metadata — every BodyRegion, in display order, and which 8 are
// actually editable (computable + draggable, per JOINT_REGIONS). The other
// 9 (HIP, UPPER_ARM_*, FOREARM_*, WRIST_*, ANKLE_*) have no formula
// anywhere in this codebase yet — computeBodyAngles doesn't produce a
// reading for them and JOINT_REGIONS has no drag handle for them either,
// so they render as a permanently muted "not yet supported" row, never
// draggable, never angle-editable.
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

const EDITABLE_REGIONS = new Set<BodyRegion>(Object.values(JOINT_REGIONS));
const DRAGGABLE_JOINTS = Object.keys(JOINT_REGIONS).map(Number);

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
      className="w-16 rounded border border-border bg-background px-1.5 py-0.5 text-right font-technical text-xs"
    />
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

function UnsupportedRegionRow({ region }: { region: BodyRegion }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/50 bg-surface/50 p-3 opacity-60">
      <span className="font-heading font-bold">{REGION_LABELS[region]}</span>
      <span className="font-technical text-xs text-border">
        not yet supported
      </span>
    </div>
  );
}

function RegionRow({
  idPrefix,
  region,
  originalResult,
  delta,
  onAngleCommit,
  onReset,
}: {
  idPrefix: string;
  region: BodyRegion;
  originalResult: RegionResult;
  delta: RegionDelta;
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

      <div className="flex items-center gap-2">
        <label
          className="font-technical text-xs text-border"
          htmlFor={`${idPrefix}-angle-${region}`}
        >
          Set angle
        </label>
        <AngleNumberInput
          id={`${idPrefix}-angle-${region}`}
          value={delta.currentAngle}
          min={limits?.min}
          max={limits?.max}
          onCommit={onAngleCommit}
        />
        <span className="font-technical text-xs text-border" aria-hidden="true">
          °
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
            : REGION_ORDER.map((region) =>
                EDITABLE_REGIONS.has(region) ? (
                  <RegionRow
                    key={region}
                    idPrefix={postureSampleId}
                    region={region}
                    originalResult={effectiveOriginalRegionResults[region]}
                    delta={getRegionDelta(editor, region)}
                    onAngleCommit={(degrees) =>
                      handleAngleCommit(region, degrees)
                    }
                    onReset={() => handleResetRegion(region)}
                  />
                ) : (
                  <UnsupportedRegionRow key={region} region={region} />
                ),
              )}
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
