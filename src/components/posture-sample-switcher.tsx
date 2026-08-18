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
import { getCommonDictionary } from "@/lib/i18n/dictionaries/common";
import { useLocale } from "@/lib/i18n/locale-context";
import { NOT_ASSESSED_COLOR, riskBandColors } from "@/lib/risk/band-severity";

// Same lightweight structural stand-in for Prisma's JsonValue
// posture-editor.tsx uses — see that file's own comment for why importing
// the generated client's real Json type isn't worth it here.
type Json = unknown;

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
  /** Only meaningful when source is CAMERA_MEDIAPIPE — retained on the type so both callers can keep passing the raw PostureSample row through without reshaping it, even though this component (B8b — SLD_NEXT_STEPS_B8b-B8f.md) no longer renders a skeleton from it. */
  keypoints: Json | null;
  /** Null when buildRegionResults threw for this sample (see `error`) — nothing to show. */
  regionResults: Record<BodyRegion, RegionResult> | null;
  error: string | null;
  validatedKeypoints: Json | null;
  validationStatus: ValidationStatus;
  validatedAt: Date | null;
  /** Resolved PlatformUser.name for validatedByUserId — not a DB-level FK (see PostureSample's own schema comment), so callers resolve it themselves via a batched lookup rather than this component doing its own query. */
  validatedByName: string | null;
  /** Worst scored RiskBand across this sample's regions, or null if none scored — computed server-side (worstRiskBand) from the same `regionResults` shown when selected, so the selector chip and the table below it can never disagree. */
  worstBand: RiskBand | null;
  /** The hold-time sub-score (SLD_IMPLEMENTATION_PLAN_austria-first.md §6), computed server-side via computeHoldTimeResult — null when no holdDurationSeconds was recorded for this sample. Parallel to `worstBand`/`regionResults`, never blended into either. */
  holdTime: HoldTimeResult;
};

// Every label in this file (badges, table headers, hold-time phrasing)
// reads from `dict`/`commonDict`, threaded down from the top-level
// PostureSampleSwitcher's own useLocale() call rather than each of these
// sub-components calling useLocale() itself — one hook call for the whole
// tree, same as the rest of this app's client components.
type CommonDict = ReturnType<typeof getCommonDictionary>;

function BandBadge({
  band,
  commonDict,
}: {
  band: RiskBand | null;
  commonDict: CommonDict;
}) {
  return (
    <span
      className="rounded-full px-2 py-0.5 font-technical text-[11px] font-bold text-white"
      style={{
        backgroundColor: band ? riskBandColors[band] : NOT_ASSESSED_COLOR,
      }}
    >
      {band
        ? commonDict.riskBandLabels[band]
        : commonDict.postureSampleSwitcher.notScored}
    </span>
  );
}

// Read-only display of a camera sample's review status — B8b (see
// SLD_NEXT_STEPS_B8b-B8f.md) dropped the interactive validate/reopen
// controls along with PostureEditor (frozen, skeleton-only UI — see
// SLD_POSTURE_EDITOR_FIDELITY_PLAN.md), so a historical camera sample's
// Pending/Validated status is still visible here, just not actionable from
// this view anymore.
function ValidationBadge({
  status,
  validatedAt,
  validatedByName,
  commonDict,
}: {
  status: ValidationStatus;
  validatedAt: Date | string | null;
  validatedByName: string | null;
  commonDict: CommonDict;
}) {
  const dict = commonDict.postureSampleSwitcher;
  if (status === "VALIDATED") {
    return (
      <span
        className="flex flex-wrap items-center gap-1.5 rounded-full px-2.5 py-1 font-technical text-[11px] font-bold text-white"
        style={{ backgroundColor: VALIDATED_BADGE_COLOR }}
      >
        {dict.validatedBadge}
        {validatedAt && (
          <span className="font-normal opacity-90">
            {new Date(validatedAt).toLocaleString()}
          </span>
        )}
        {validatedByName && (
          <span className="font-normal opacity-90">
            {dict.validatedBySuffix(validatedByName)}
          </span>
        )}
      </span>
    );
  }
  return (
    <span
      className="rounded-full px-2.5 py-1 font-technical text-[11px] font-bold text-white"
      style={{ backgroundColor: PENDING_BADGE_COLOR }}
    >
      {dict.pendingBadge}
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
function ManualEntryBadge({
  small,
  commonDict,
}: {
  small?: boolean;
  commonDict: CommonDict;
}) {
  return (
    <span
      className={
        small
          ? "rounded-full px-1.5 py-0.5 font-technical text-[10px] font-bold text-white"
          : "rounded-full px-2.5 py-1 font-technical text-[11px] font-bold text-white"
      }
      style={{ backgroundColor: MANUAL_ENTRY_BADGE_COLOR }}
    >
      {commonDict.postureSampleSwitcher.manualEntryBadge}
    </span>
  );
}

// Hold-time sub-score (§6) — a parallel result to the posture bands
// above it, never blended in. Only rendered when a hold duration was
// actually recorded; silent otherwise, since most samples won't have one.
function HoldTimeInfo({
  holdTime,
  commonDict,
}: {
  holdTime: HoldTimeResult;
  commonDict: CommonDict;
}) {
  if (!holdTime) return null;
  const dict = commonDict.postureSampleSwitcher;
  const escalated = holdTime.holdTimeBand !== null;
  return (
    <p className="mb-3 flex flex-wrap items-center gap-2 font-technical text-xs">
      <span className="text-border">
        {dict.holdTimeSummary(
          holdTime.holdDurationSeconds,
          commonDict.riskBandLabels[holdTime.worstPostureBand],
        )}
      </span>
      {escalated && (
        <span
          className="rounded-full px-2 py-0.5 font-bold text-white"
          style={{ backgroundColor: riskBandColors.HIGH }}
        >
          {dict.holdTimeEscalated(
            commonDict.riskBandLabels[holdTime.overallBand],
          )}
        </span>
      )}
    </p>
  );
}

// Plain per-region table — same region/status/detail shape the capture
// page's manual-entry result view and the PDF report use
// (describeRegionResult). As of B8b (SLD_NEXT_STEPS_B8b-B8f.md), used for
// every sample regardless of source: PostureEditor (frozen — see
// SLD_POSTURE_EDITOR_FIDELITY_PLAN.md) is no longer mounted here at all,
// camera or manual, since no scoring decision depends on how the skeleton
// looks — bands and numbers carry the methodology.
function ManualRegionTable({
  regionResults,
  locale,
  commonDict,
}: {
  regionResults: Record<BodyRegion, RegionResult>;
  locale: ReturnType<typeof useLocale>["locale"];
  commonDict: CommonDict;
}) {
  const dict = commonDict.postureSampleSwitcher;
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-border">
          <th className="py-1 pr-4 font-technical text-xs text-border">
            {dict.tableRegion}
          </th>
          <th className="py-1 pr-4 font-technical text-xs text-border">
            {dict.tableStatus}
          </th>
          <th className="py-1 font-technical text-xs text-border">
            {dict.tableDetail}
          </th>
        </tr>
      </thead>
      <tbody>
        {Object.values(BodyRegion).map((region) => {
          const result = regionResults[region];
          if (!result || result.status === "not-yet-supported") return null;
          return (
            <tr key={region} className="border-b border-border last:border-0">
              <td className="py-1 pr-4 font-technical text-xs">
                {commonDict.bodyRegionLabels[region]}
              </td>
              <td className="py-1 pr-4 font-technical text-xs">
                {commonDict.regionResultStatusLabels[result.status]}
              </td>
              <td className="py-1 font-technical text-xs">
                {describeRegionResult(result, locale)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// Switcher for one task/workstation's PostureSample history — a compact
// selector strip (one chip per sample) above exactly ONE region table, so
// clicking a different chip is unambiguously "show me that measurement's
// numbers instead."
//
// The most recent sample (items[0], expected sorted desc by capturedAt —
// this component trusts the caller's order rather than re-sorting) is
// selected by default, so the table is genuinely the first thing visible,
// not something every sample requires an extra click to reach.
export function PostureSampleSwitcher({
  items,
}: {
  items: readonly PostureSampleSwitcherItem[];
}) {
  const { locale } = useLocale();
  const commonDict = getCommonDictionary(locale);
  const dict = commonDict.postureSampleSwitcher;

  const [selectedId, setSelectedId] = useState<string | null>(
    items[0]?.id ?? null,
  );

  const selectedItem =
    items.find((item) => item.id === selectedId) ?? items[0] ?? null;

  return (
    <div className="flex flex-col gap-4">
      {items.length > 1 && (
        <div
          role="tablist"
          aria-label={dict.tablistLabel}
          className="flex flex-wrap gap-2"
        >
          {items.map((item) => {
            const isSelected = item.id === selectedItem?.id;

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
                    ` — ${commonDict.cameraAngleLabels[item.cameraAngle]}`}
                </span>
                <span className="flex items-center gap-1.5">
                  <BandBadge band={item.worstBand} commonDict={commonDict} />
                  {item.source !== "CAMERA_MEDIAPIPE" ? (
                    <ManualEntryBadge small commonDict={commonDict} />
                  ) : item.validationStatus === "VALIDATED" ? (
                    <span
                      className="rounded-full px-1.5 py-0.5 font-technical text-[10px] font-bold text-white"
                      style={{ backgroundColor: VALIDATED_BADGE_COLOR }}
                    >
                      {dict.validatedBadge}
                    </span>
                  ) : (
                    <span
                      className="rounded-full px-1.5 py-0.5 font-technical text-[10px] font-bold text-white"
                      style={{ backgroundColor: PENDING_BADGE_COLOR }}
                    >
                      {dict.pendingBadgeShort}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {selectedItem && (
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <span className="font-technical text-xs text-border">
              {selectedItem.capturedAt.toISOString()}
              {selectedItem.source === "CAMERA_MEDIAPIPE" &&
                ` — ${commonDict.cameraAngleLabels[selectedItem.cameraAngle]}`}
            </span>
            {selectedItem.source !== "CAMERA_MEDIAPIPE" ? (
              <ManualEntryBadge commonDict={commonDict} />
            ) : (
              <ValidationBadge
                status={selectedItem.validationStatus}
                validatedAt={selectedItem.validatedAt}
                validatedByName={selectedItem.validatedByName}
                commonDict={commonDict}
              />
            )}
          </div>

          {selectedItem.error && (
            <p className="mb-3 text-sm text-accent">{selectedItem.error}</p>
          )}
          <HoldTimeInfo
            holdTime={selectedItem.holdTime}
            commonDict={commonDict}
          />
          {selectedItem.regionResults && (
            <ManualRegionTable
              regionResults={selectedItem.regionResults}
              locale={locale}
              commonDict={commonDict}
            />
          )}
        </div>
      )}
    </div>
  );
}
