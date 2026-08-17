"use client";

import { useState } from "react";
import {
  BodyRegion,
  type CameraAngle,
  type PostureSampleSource,
  type RiskBand,
  type ValidationStatus,
} from "@/generated/prisma/enums";
import { describeRegionResult } from "@/lib/capture/describe-region-result";
import type { HoldTimeResult, RegionResult } from "@/lib/capture/types";
import {
  NOT_ASSESSED_COLOR,
  riskBandColors,
  worstRiskBand,
} from "@/lib/risk/band-severity";
import { PostureEditor } from "./posture-editor";

// Same lightweight structural stand-in for Prisma's JsonValue
// posture-editor.tsx uses — see that file's own comment for why importing
// the generated client's real Json type isn't worth it here.
type Json = unknown;

// Pending-review/validated are a workflow STATUS, not a RiskBand — there's
// no existing color constant for them (riskBandColors is specifically the
// LOW/MODERATE/ELEVATED/HIGH severity scale), so these are defined
// locally, matching this app's own convention of inline hex constants for
// this kind of status coloring (see skeleton-3d.tsx's DRAG_HIGHLIGHT_COLOR
// etc.) rather than reaching for Tailwind's semantic color utilities.
const VALIDATED_BADGE_COLOR = "#16a34a"; // green-600
const PENDING_BADGE_COLOR = "#d97706"; // amber-600
// Provenance, not a workflow status or a risk severity — its own neutral
// color so it never reads as "this is worse/better" the way amber/green
// would (ERGO_COMPLIANCE_BY_DESIGN.md §3.16: a manually entered angle and
// a camera-derived one are different kinds of evidence, not different
// quality tiers).
const MANUAL_ENTRY_BADGE_COLOR = "#475569"; // slate-600

export type PostureSampleSwitcherItem = {
  id: string;
  capturedAt: Date;
  source: PostureSampleSource;
  /** Only meaningful when source is CAMERA_MEDIAPIPE — MANUAL_ENTRY samples carry an inert placeholder here (see createPostureSample) and every render below hides it accordingly. */
  cameraAngle: CameraAngle;
  /** Null for a MANUAL_ENTRY sample — there are no keypoints to show a skeleton for. */
  keypoints: Json | null;
  /** Null when buildRegionResults threw for this sample (see `error`) — nothing to show in the editor. */
  regionResults: Record<BodyRegion, RegionResult> | null;
  error: string | null;
  validatedKeypoints: Json | null;
  validationStatus: ValidationStatus;
  validatedAt: Date | null;
  /** Resolved PlatformUser.name for validatedByUserId — not a DB-level FK (see PostureSample's own schema comment), so callers resolve it themselves via a batched lookup rather than this component doing its own query. */
  validatedByName: string | null;
  /** Worst scored RiskBand across this sample's regions, or null if none scored — computed server-side (worstRiskBand) from the same `regionResults` shown when selected, so the selector chip and the editor below it can never disagree. */
  worstBand: RiskBand | null;
  /** The hold-time sub-score (SLD_IMPLEMENTATION_PLAN_austria-first.md §6), computed server-side via computeHoldTimeResult — null when no holdDurationSeconds was recorded for this sample. Parallel to `worstBand`/`regionResults`, never blended into either. */
  holdTime: HoldTimeResult;
};

function BandBadge({ band }: { band: RiskBand | null }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 font-technical text-[11px] font-bold text-white"
      style={{
        backgroundColor: band ? riskBandColors[band] : NOT_ASSESSED_COLOR,
      }}
    >
      {band ?? "not scored"}
    </span>
  );
}

function ValidationBadge({
  status,
  validatedAt,
  validatedByName,
}: {
  status: ValidationStatus;
  validatedAt: Date | string | null;
  validatedByName: string | null;
}) {
  if (status === "VALIDATED") {
    return (
      <span
        className="flex flex-wrap items-center gap-1.5 rounded-full px-2.5 py-1 font-technical text-[11px] font-bold text-white"
        style={{ backgroundColor: VALIDATED_BADGE_COLOR }}
      >
        Validated ✓
        {validatedAt && (
          <span className="font-normal opacity-90">
            {new Date(validatedAt).toLocaleString()}
          </span>
        )}
        {validatedByName && (
          <span className="font-normal opacity-90">by {validatedByName}</span>
        )}
      </span>
    );
  }
  return (
    <span
      className="rounded-full px-2.5 py-1 font-technical text-[11px] font-bold text-white"
      style={{ backgroundColor: PENDING_BADGE_COLOR }}
    >
      Pending review
    </span>
  );
}

// Manual entry has no keypoints, so it never goes through the
// validate/reopen workflow the badge above describes (see the source
// guard in validatePostureSample/reopenPostureSampleForEdit) — showing
// "Pending review" on a sample with nothing to review would read as a
// stuck workflow rather than what it actually is. This badge replaces
// ValidationBadge for a MANUAL_ENTRY sample, in both the chip strip and
// the detail header, so the two badges are never shown side by side.
function ManualEntryBadge({ small }: { small?: boolean }) {
  return (
    <span
      className={
        small
          ? "rounded-full px-1.5 py-0.5 font-technical text-[10px] font-bold text-white"
          : "rounded-full px-2.5 py-1 font-technical text-[11px] font-bold text-white"
      }
      style={{ backgroundColor: MANUAL_ENTRY_BADGE_COLOR }}
    >
      Manual entry
    </span>
  );
}

// Hold-time sub-score (§6) — a parallel result to the posture bands
// above it, never blended in. Only rendered when a hold duration was
// actually recorded; silent otherwise, since most samples won't have one.
function HoldTimeInfo({ holdTime }: { holdTime: HoldTimeResult }) {
  if (!holdTime) return null;
  const escalated = holdTime.holdTimeBand !== null;
  return (
    <p className="mb-3 flex flex-wrap items-center gap-2 font-technical text-xs">
      <span className="text-border">
        Held {holdTime.holdDurationSeconds}s — posture{" "}
        {holdTime.worstPostureBand}
      </span>
      {escalated && (
        <span
          className="rounded-full px-2 py-0.5 font-bold text-white"
          style={{ backgroundColor: riskBandColors.HIGH }}
        >
          hold time exceeds safe duration — {holdTime.overallBand}
        </span>
      )}
    </p>
  );
}

// Fallback for a MANUAL_ENTRY sample, which has no keypoints and
// therefore nothing for PostureEditor (frozen — see
// SLD_POSTURE_EDITOR_FIDELITY_PLAN.md) to render a skeleton from. Same
// region/status/detail shape the capture page's own immediate result
// view and the PDF report use (describeRegionResult), just as a plain
// table — no scoring decision depends on how this looks, only that the
// numbers are there.
function ManualRegionTable({
  regionResults,
}: {
  regionResults: Record<BodyRegion, RegionResult>;
}) {
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-border">
          <th className="py-1 pr-4 font-technical text-xs text-border">
            Region
          </th>
          <th className="py-1 pr-4 font-technical text-xs text-border">
            Status
          </th>
          <th className="py-1 font-technical text-xs text-border">Detail</th>
        </tr>
      </thead>
      <tbody>
        {Object.values(BodyRegion).map((region) => {
          const result = regionResults[region];
          if (!result || result.status === "not-yet-supported") return null;
          return (
            <tr key={region} className="border-b border-border last:border-0">
              <td className="py-1 pr-4 font-technical text-xs">{region}</td>
              <td className="py-1 pr-4 font-technical text-xs">
                {result.status}
              </td>
              <td className="py-1 font-technical text-xs">
                {describeRegionResult(result)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// Switcher for one task/workstation's PostureSample history — replaces the
// earlier accordion (posture-sample-accordion.tsx, deleted): that design
// technically let you click a different sample's header to view it, but
// "one collapsible row expands into a full editor" reads as browsing a
// list of records, not as switching between readings of the SAME location.
// This makes that the whole interaction: a compact selector strip (one
// chip per sample) always visible above exactly ONE mounted PostureEditor,
// so clicking a different chip is unambiguously "show me that
// measurement's skeleton and numbers instead" — never "everything
// collapses to nothing," which the old expand/collapse-to-null toggle
// could do on a stray click.
//
// Only one PostureEditor is ever mounted (not one per sample) — same
// reasoning the old accordion gave: N simultaneous WebGL scenes on a task
// with a long capture history would be wasteful. `key={selectedItem.id}`
// on the mounted PostureEditor below forces a full remount on every
// switch, so a sample's local editing/validation state (drag adjustments,
// the just-validated/just-reopened override) never leaks into the next
// sample selected — the same clean reset the old accordion got for free
// from literally unmounting between an expand/collapse.
//
// The most recent sample (items[0], expected sorted desc by capturedAt —
// this component trusts the caller's order rather than re-sorting) is
// selected by default, so the editor is genuinely the first thing visible,
// not something every sample requires an extra click to reach.
export function PostureSampleSwitcher({
  items,
  currentUserName,
  onValidate,
  onReopen,
}: {
  items: readonly PostureSampleSwitcherItem[];
  /** The signed-in user's own name — used only for the LOCAL "just validated" override below, so the selector chip can correctly say "by <you>" immediately, before the next server round-trip re-resolves it from the DB. */
  currentUserName: string;
  onValidate: (
    postureSampleId: string,
    validatedKeypoints: Json,
  ) => Promise<{
    regionResults: Record<BodyRegion, RegionResult>;
    validatedAt: Date | string;
  }>;
  onReopen: (
    postureSampleId: string,
    note: string | null,
  ) => Promise<{
    regionResults: Record<BodyRegion, RegionResult>;
  }>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    items[0]?.id ?? null,
  );

  // PostureEditor already updates ITS OWN display the instant onValidate/
  // onReopen resolves (see that component's own statusOverride state) —
  // but this switcher's SELECTOR CHIPS are built from server-passed props,
  // which won't reflect a just-completed validate/reopen until the next
  // page navigation/revalidation. Without this, switching away from a
  // sample right after acting on it would show a stale chip. Keyed by
  // sample id so multiple samples acted on in one session each get their
  // own override; one map for both directions since a sample only ever has
  // one current override at a time.
  const [overrides, setOverrides] = useState<
    Record<
      string,
      | {
          status: "VALIDATED";
          validatedAt: Date | string;
          worstBand: RiskBand | null;
        }
      | { status: "PENDING_REVIEW"; worstBand: RiskBand | null }
    >
  >({});

  const handleValidate = async (
    postureSampleId: string,
    validatedKeypoints: Json,
  ) => {
    const result = await onValidate(postureSampleId, validatedKeypoints);
    const worstBand = worstBandFromRegions(result.regionResults);
    setOverrides((prev) => ({
      ...prev,
      [postureSampleId]: {
        status: "VALIDATED",
        validatedAt: result.validatedAt,
        worstBand,
      },
    }));
    return result;
  };

  const handleReopen = async (postureSampleId: string, note: string | null) => {
    const result = await onReopen(postureSampleId, note);
    const worstBand = worstBandFromRegions(result.regionResults);
    setOverrides((prev) => ({
      ...prev,
      [postureSampleId]: { status: "PENDING_REVIEW", worstBand },
    }));
    return result;
  };

  const selectedItem =
    items.find((item) => item.id === selectedId) ?? items[0] ?? null;

  return (
    <div className="flex flex-col gap-4">
      {items.length > 1 && (
        <div
          role="tablist"
          aria-label="Posture samples"
          className="flex flex-wrap gap-2"
        >
          {items.map((item) => {
            const isSelected = item.id === selectedItem?.id;
            const override = overrides[item.id];
            const validationStatus: ValidationStatus =
              override?.status ?? item.validationStatus;
            const worstBand = override ? override.worstBand : item.worstBand;

            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setSelectedId(item.id)}
                className={`flex flex-col items-start gap-1.5 rounded-lg border px-3 py-2 text-left transition-colors ${
                  isSelected
                    ? "border-accent bg-accent/10"
                    : "border-border bg-surface hover:border-accent/50"
                }`}
              >
                <span className="font-technical text-xs text-border">
                  {item.capturedAt.toISOString()}
                  {item.source === "CAMERA_MEDIAPIPE" &&
                    ` — ${item.cameraAngle}`}
                </span>
                <span className="flex items-center gap-1.5">
                  <BandBadge band={worstBand} />
                  {item.source !== "CAMERA_MEDIAPIPE" ? (
                    <ManualEntryBadge small />
                  ) : validationStatus === "VALIDATED" ? (
                    <span
                      className="rounded-full px-1.5 py-0.5 font-technical text-[10px] font-bold text-white"
                      style={{ backgroundColor: VALIDATED_BADGE_COLOR }}
                    >
                      Validated ✓
                    </span>
                  ) : (
                    <span
                      className="rounded-full px-1.5 py-0.5 font-technical text-[10px] font-bold text-white"
                      style={{ backgroundColor: PENDING_BADGE_COLOR }}
                    >
                      Pending
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {selectedItem &&
        (() => {
          const override = overrides[selectedItem.id];
          const validationStatus: ValidationStatus =
            override?.status ?? selectedItem.validationStatus;
          const validatedAt =
            override?.status === "VALIDATED"
              ? override.validatedAt
              : selectedItem.validatedAt;
          const validatedByName =
            override?.status === "VALIDATED"
              ? currentUserName
              : selectedItem.validatedByName;

          const isManual = selectedItem.source !== "CAMERA_MEDIAPIPE";

          return (
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <span className="font-technical text-xs text-border">
                  {selectedItem.capturedAt.toISOString()}
                  {!isManual && ` — ${selectedItem.cameraAngle}`}
                </span>
                {isManual ? (
                  <ManualEntryBadge />
                ) : (
                  <ValidationBadge
                    status={validationStatus}
                    validatedAt={validatedAt}
                    validatedByName={validatedByName}
                  />
                )}
              </div>

              {selectedItem.error && (
                <p className="mb-3 text-sm text-accent">{selectedItem.error}</p>
              )}
              <HoldTimeInfo holdTime={selectedItem.holdTime} />
              {selectedItem.regionResults &&
                (isManual ? (
                  // No keypoints to hand PostureEditor (frozen — see
                  // SLD_POSTURE_EDITOR_FIDELITY_PLAN.md) — a plain region
                  // table instead, same data, no skeleton.
                  <ManualRegionTable
                    regionResults={selectedItem.regionResults}
                  />
                ) : (
                  <PostureEditor
                    key={selectedItem.id}
                    postureSampleId={selectedItem.id}
                    keypoints={selectedItem.keypoints}
                    cameraAngle={selectedItem.cameraAngle}
                    regionResults={selectedItem.regionResults}
                    validatedKeypoints={selectedItem.validatedKeypoints}
                    validationStatus={selectedItem.validationStatus}
                    validatedAt={selectedItem.validatedAt}
                    onValidate={(validatedKeypoints) =>
                      handleValidate(selectedItem.id, validatedKeypoints)
                    }
                    onReopen={(note) => handleReopen(selectedItem.id, note)}
                  />
                ))}
            </div>
          );
        })()}
    </div>
  );
}

function worstBandFromRegions(
  regions: Record<BodyRegion, RegionResult>,
): RiskBand | null {
  const bands = Object.values(regions).flatMap((result) =>
    result.status === "scored" ? [result.riskBand] : [],
  );
  return worstRiskBand(bands);
}
