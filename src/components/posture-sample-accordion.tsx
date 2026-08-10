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

export type PostureSampleAccordionItem = {
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
  /** Worst scored RiskBand across this sample's regions, or null if none scored — computed server-side (worstRiskBand) from the same `regionResults` shown when expanded, so the collapsed summary and the expanded editor can never disagree. */
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

// Accordion wrapper around one task's PostureSample history — PostureEditor
// (a full 3D skeleton + region panel) is the PRIMARY way a sample's
// results are reviewed now, not a table with a "Simulate" button hanging
// off it, but mounting one per sample unconditionally would mean N
// simultaneous WebGL scenes on a task with a long capture history. Only
// one sample is ever expanded (a fresh, fully-mounted PostureEditor) at a
// time; every other sample collapses to a single-line summary carrying
// enough to judge "does this one need attention" without opening it —
// worst band and validation status/timestamp/reviewer.
//
// The most recent sample (items[0], expected sorted desc by capturedAt —
// this component trusts the caller's order rather than re-sorting) starts
// expanded, so the editor is genuinely the first thing visible, not
// something every sample requires an extra click to reach.
export function PostureSampleAccordion({
  items,
  currentUserName,
  onValidate,
}: {
  items: readonly PostureSampleAccordionItem[];
  /** The signed-in user's own name — used only for the LOCAL "just validated" override below, so the collapsed badge can correctly say "by <you>" immediately, before the next server round-trip re-resolves it from the DB. */
  currentUserName: string;
  onValidate: (
    postureSampleId: string,
    validatedKeypoints: Json,
  ) => Promise<{
    regionResults: Record<BodyRegion, RegionResult>;
    validatedAt: Date | string;
  }>;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(
    items[0]?.id ?? null,
  );

  // PostureEditor already updates ITS OWN display the instant onValidate
  // resolves (see that component's own validationResult state) — but this
  // accordion's COLLAPSED summary is built from server-passed props, which
  // won't reflect a just-completed validation until the next page
  // navigation/revalidation. Without this, collapsing a sample right after
  // validating it would show a stale "Pending review" badge. Keyed by
  // sample id so multiple samples validated in one session (unlikely, but
  // not prevented) each get their own override.
  const [validatedOverrides, setValidatedOverrides] = useState<
    Record<string, { validatedAt: Date | string; worstBand: RiskBand | null }>
  >({});

  const handleValidate = async (
    postureSampleId: string,
    validatedKeypoints: Json,
  ) => {
    const result = await onValidate(postureSampleId, validatedKeypoints);
    const worstBand = worstBandFromRegions(result.regionResults);
    setValidatedOverrides((prev) => ({
      ...prev,
      [postureSampleId]: { validatedAt: result.validatedAt, worstBand },
    }));
    return result;
  };

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => {
        const isExpanded = item.id === expandedId;
        const override = validatedOverrides[item.id];
        const validationStatus: ValidationStatus = override
          ? "VALIDATED"
          : item.validationStatus;
        const validatedAt = override?.validatedAt ?? item.validatedAt;
        const validatedByName = override
          ? currentUserName
          : item.validatedByName;
        const worstBand = override?.worstBand ?? item.worstBand;

        return (
          <div
            key={item.id}
            className="rounded-lg border border-border bg-surface"
          >
            <button
              type="button"
              onClick={() => setExpandedId(isExpanded ? null : item.id)}
              aria-expanded={isExpanded}
              className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span
                  aria-hidden="true"
                  className={`inline-block text-border transition-transform ${isExpanded ? "rotate-90" : ""}`}
                >
                  ▶
                </span>
                <span className="font-technical text-xs text-border">
                  {item.capturedAt.toISOString()} — {item.cameraAngle}
                </span>
                <BandBadge band={worstBand} />
              </div>
              <ValidationBadge
                status={validationStatus}
                validatedAt={validatedAt}
                validatedByName={validatedByName}
              />
            </button>

            {isExpanded && (
              <div className="border-t border-border p-4">
                {item.error && (
                  <p className="mb-3 text-sm text-accent">{item.error}</p>
                )}
                {item.regionResults && (
                  <PostureEditor
                    postureSampleId={item.id}
                    keypoints={item.keypoints}
                    cameraAngle={item.cameraAngle}
                    regionResults={item.regionResults}
                    validatedKeypoints={item.validatedKeypoints}
                    validationStatus={item.validationStatus}
                    validatedAt={item.validatedAt}
                    onValidate={(validatedKeypoints) =>
                      handleValidate(item.id, validatedKeypoints)
                    }
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
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
