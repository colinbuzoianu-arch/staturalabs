"use client";

import { useState } from "react";
import type {
  BodyRegion,
  CameraAngle,
  RiskBand,
  ValidationStatus,
} from "@/generated/prisma/enums";
import type { RegionResult } from "@/lib/capture/types";
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

export type PostureSampleSwitcherItem = {
  id: string;
  capturedAt: Date;
  cameraAngle: CameraAngle;
  keypoints: Json;
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
                  {item.capturedAt.toISOString()} — {item.cameraAngle}
                </span>
                <span className="flex items-center gap-1.5">
                  <BandBadge band={worstBand} />
                  {validationStatus === "VALIDATED" ? (
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

          return (
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <span className="font-technical text-xs text-border">
                  {selectedItem.capturedAt.toISOString()} —{" "}
                  {selectedItem.cameraAngle}
                </span>
                <ValidationBadge
                  status={validationStatus}
                  validatedAt={validatedAt}
                  validatedByName={validatedByName}
                />
              </div>

              {selectedItem.error && (
                <p className="mb-3 text-sm text-accent">{selectedItem.error}</p>
              )}
              {selectedItem.regionResults && (
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
              )}
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
