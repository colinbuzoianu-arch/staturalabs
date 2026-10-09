"use client";

import Link from "next/link";
import { type FormEvent, use, useEffect, useMemo, useState } from "react";
import { ManualInputType } from "@/generated/prisma/enums";
import { describeRegionResult } from "@/lib/capture/describe-region-result";
import { MANUAL_ENTRY_BODY_REGIONS } from "@/lib/capture/manual-angles";
import {
  describeManualInput,
  isTextManualInputType,
  MANUAL_INPUT_TYPES,
  MANUAL_INPUT_UNITS,
  validateManualInputShape,
} from "@/lib/capture/manual-input";
import type { PostureSampleResponse, RegionResult } from "@/lib/capture/types";
import { getCommonDictionary } from "@/lib/i18n/dictionaries/common";
import { getDashboardDictionary } from "@/lib/i18n/dictionaries/dashboard";
import type { Locale } from "@/lib/i18n/locale";
import { useLocale } from "@/lib/i18n/locale-context";
import { NOT_ASSESSED_COLOR, riskBandColors } from "@/lib/risk/band-severity";
import { matchScoringRule } from "@/lib/scoring/match";
import {
  derivePostureCategories,
  formatCategoryRange,
  type ScoringRuleRow,
} from "@/lib/scoring/posture-categories";

export default function CapturePage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = use(params);
  const { locale } = useLocale();
  const dict = getDashboardDictionary(locale).capturePage;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      {/* Reached from two places (the (app) dashboard's task page and the
          internal /admin task results page), so this always points back
          to the (app) dashboard task page specifically — the canonical
          home for a task, reachable by every role that can reach this
          capture page in the first place (canAccessSite covers
          super_admin too). */}
      <Link href={`/tasks/${taskId}`} className="self-start text-sm underline">
        {dict.backToTask}
      </Link>
      <h1 className="text-xl font-semibold">{dict.heading}</h1>

      {/* Manual entry is the only posture-capture path. Camera capture
          (getUserMedia, MediaPipe, the skeleton overlay/multi-person
          picker) was removed from this page in B8b
          (SLD_NEXT_STEPS_B8b-B8f.md); the camera client libs
          (mediapipe-client.ts, draw-skeleton.ts) and the camera ingest
          endpoint (POST /api/posture-samples) were then deleted entirely
          for GDPR — the product no longer captures camera/pose data at all,
          and createPostureSample refuses a CAMERA_MEDIAPIPE write.
          Historical camera samples still render read-only via
          angles.ts/buildRegionResults, which stay. B11
          (SLD_IMPLEMENTATION_PLAN_posture-input.md) made this panel's own
          entry a category pick, not a typed degree — see
          PostureCategoryPanel's own comment. */}
      <PostureCategoryPanel taskId={taskId} />

      {/*
        Independent of the manual-entry submission above — the operator
        can record a manual input before or after entering a posture
        sample, or without entering one at all in this visit. Always
        visible.
      */}
      <ManualInputPanel taskId={taskId} />
    </div>
  );
}

type CaptureDict = ReturnType<typeof getDashboardDictionary>["capturePage"];

function ResultView({
  response,
  onCaptureAnother,
  dict,
  locale,
}: {
  response: PostureSampleResponse;
  onCaptureAnother: () => void;
  dict: CaptureDict;
  locale: Locale;
}) {
  const regions = Object.entries(response.regions) as [
    keyof typeof response.regions,
    RegionResult,
  ][];
  const holdTime = response.holdTime;
  const commonDict = getCommonDictionary(locale);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {dict.sampleMeta(response.postureSampleId, response.methodologyVersion)}
      </p>
      {holdTime && (
        <p className="text-sm">
          {dict.holdTimeSummary(
            holdTime.holdDurationSeconds,
            commonDict.riskBandLabels[holdTime.worstPostureBand],
          )}{" "}
          {holdTime.holdTimeBand && (
            <span className="font-bold text-red-700 dark:text-red-400">
              {dict.holdTimeEscalated(
                commonDict.riskBandLabels[holdTime.overallBand],
              )}
            </span>
          )}
        </p>
      )}
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-1 pr-4">{dict.tableRegion}</th>
            <th className="py-1 pr-4">{dict.tableStatus}</th>
            <th className="py-1">{dict.tableDetail}</th>
          </tr>
        </thead>
        <tbody>
          {regions.map(([region, result]) => (
            <tr key={region} className="border-b last:border-0">
              <td className="py-1 pr-4">
                {commonDict.bodyRegionLabels[region]}
              </td>
              <td className="py-1 pr-4">
                {commonDict.regionResultStatusLabels[result.status]}
              </td>
              <td className="py-1">{describeRegionResult(result, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        type="button"
        onClick={onCaptureAnother}
        className="self-start rounded bg-black px-4 py-2 text-white dark:bg-white dark:text-black"
      >
        {dict.captureAnother}
      </button>
    </div>
  );
}

// B11 (SLD_IMPLEMENTATION_PLAN_posture-input.md §3): the primary posture
// entry surface, replacing precise degree entry — the assessor classifies
// what they observe ("Rumpf: gebeugt") rather than typing a number nobody
// on a factory floor actually measures (§1's "false precision" framing).
// Category options per region are generated from the active methodology's
// own ScoringRule rows (derivePostureCategories,
// src/lib/scoring/posture-categories.ts) — the SAME `GET /api/scoring-
// rules` fetch this panel already made for the pre-B11 live-band preview,
// zero new endpoints. An "expert mode" toggle keeps the old precise-entry
// inputs reachable for an assessor who genuinely measured (goniometer/
// inclinometer app); both modes write through the same POST
// /api/posture-samples/manual, discriminated by `entryMode` inside the
// submitted `angles` object. Partial entry is legal in either mode — a
// region left as "Nicht beurteilt" (category mode) or blank (degree mode)
// is simply omitted from the submission, never forced to a guess.
function PostureCategoryPanel({ taskId }: { taskId: string }) {
  const { locale } = useLocale();
  const dict = getDashboardDictionary(locale).capturePage;
  const commonDict = getCommonDictionary(locale);

  const [rules, setRules] = useState<ScoringRuleRow[] | null>(null);
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [expertMode, setExpertMode] = useState(false);
  // Category mode: the SELECTED category's index within
  // derivePostureCategories' sorted output for that region, or null for
  // "Nicht beurteilt." Never defaults to a real category — an unassessed
  // region must start unassessed, not pre-guessed toward a neutral band.
  const [categoryPicks, setCategoryPicks] = useState<
    Record<string, number | null>
  >(() =>
    Object.fromEntries(
      MANUAL_ENTRY_BODY_REGIONS.map((region) => [region, null]),
    ),
  );
  // Degree mode (expert toggle): the pre-B11 raw text inputs, unchanged —
  // "" still means not assessed.
  const [degreeInputs, setDegreeInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(MANUAL_ENTRY_BODY_REGIONS.map((region) => [region, ""])),
  );
  const [holdDurationSeconds, setHoldDurationSeconds] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<PostureSampleResponse | null>(null);

  // Fetched once — the active rule set is fixed for the life of this
  // panel, so every pick/keystroke afterward resolves locally with zero
  // further round-trips.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/scoring-rules")
      .then((res) => {
        if (!res.ok) throw new Error(dict.requestFailed(res.status));
        return res.json() as Promise<{ rules: ScoringRuleRow[] }>;
      })
      .then((data) => {
        if (!cancelled) setRules(data.rules);
      })
      .catch((err) => {
        if (!cancelled) {
          setRulesError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [dict]);

  const categoriesByRegion = useMemo(() => {
    const map = new Map<string, ReturnType<typeof derivePostureCategories>>();
    for (const region of MANUAL_ENTRY_BODY_REGIONS) {
      map.set(region, derivePostureCategories(rules ?? [], region));
    }
    return map;
  }, [rules]);

  const rulesByRegion = useMemo(() => {
    const map = new Map<string, ScoringRuleRow[]>();
    for (const rule of rules ?? []) {
      const existing = map.get(rule.bodyRegion) ?? [];
      existing.push(rule);
      map.set(rule.bodyRegion, existing);
    }
    return map;
  }, [rules]);

  function degreePreview(region: string) {
    const raw = degreeInputs[region]?.trim();
    if (!raw) return null;
    const degrees = Number(raw);
    if (!Number.isFinite(degrees)) return null;
    return matchScoringRule(rulesByRegion.get(region) ?? [], degrees);
  }

  const atLeastOneEntered = expertMode
    ? MANUAL_ENTRY_BODY_REGIONS.some((region) => {
        const raw = degreeInputs[region]?.trim();
        return !!raw && Number.isFinite(Number(raw));
      })
    : MANUAL_ENTRY_BODY_REGIONS.some(
        (region) => categoryPicks[region] !== null,
      );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const angles: Record<string, number | string> = {
        entryMode: expertMode ? "degrees" : "category",
      };
      if (expertMode) {
        for (const region of MANUAL_ENTRY_BODY_REGIONS) {
          const raw = degreeInputs[region]?.trim();
          if (raw && Number.isFinite(Number(raw))) {
            angles[region] = Number(raw);
          }
        }
      } else {
        for (const region of MANUAL_ENTRY_BODY_REGIONS) {
          const index = categoryPicks[region];
          if (index === null) continue;
          const category = categoriesByRegion.get(region)?.[index];
          if (category) angles[region] = category.representativeDegrees;
        }
      }
      const res = await fetch("/api/posture-samples/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          angles,
          taskId,
          holdDurationSeconds:
            holdDurationSeconds.trim() === ""
              ? null
              : Number(holdDurationSeconds),
        }),
      });
      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        throw new Error(errorBody?.error ?? dict.requestFailed(res.status));
      }
      setResponse((await res.json()) as PostureSampleResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : dict.submitFailed);
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setResponse(null);
    setCategoryPicks(
      Object.fromEntries(
        MANUAL_ENTRY_BODY_REGIONS.map((region) => [region, null]),
      ),
    );
    setDegreeInputs(
      Object.fromEntries(
        MANUAL_ENTRY_BODY_REGIONS.map((region) => [region, ""]),
      ),
    );
    setHoldDurationSeconds("");
  }

  if (response) {
    return (
      <ResultView
        response={response}
        onCaptureAnother={reset}
        dict={{ ...dict, captureAnother: dict.manualEntryAnother }}
        locale={locale}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">{dict.postureCategoryHeading}</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {dict.postureCategoryDescription}
        </p>
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={expertMode}
            onChange={(e) => setExpertMode(e.target.checked)}
          />
          {dict.expertModeToggleLabel}
        </label>
        {expertMode && (
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            {dict.expertModeDescription}
          </p>
        )}
      </div>

      {rulesError && (
        <p className="text-sm text-red-700 dark:text-red-400">
          {dict.manualEntryRulesFailed(rulesError)}
        </p>
      )}
      {!rules && !rulesError && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {dict.manualEntryRulesLoading}
        </p>
      )}
      {error && (
        <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {MANUAL_ENTRY_BODY_REGIONS.map((region) => {
          if (expertMode) {
            const preview = degreePreview(region);
            return (
              <label key={region} className="flex flex-col gap-1 text-sm">
                {dict.angleDegreesLabel(commonDict.bodyRegionLabels[region])}
                <input
                  type="number"
                  step="any"
                  placeholder={dict.notAssessedOption}
                  value={degreeInputs[region] ?? ""}
                  onChange={(e) =>
                    setDegreeInputs((prev) => ({
                      ...prev,
                      [region]: e.target.value,
                    }))
                  }
                  className="rounded border px-2 py-1"
                />
                <span
                  className="font-technical text-xs font-bold"
                  style={{
                    color: preview
                      ? riskBandColors[preview.riskBand]
                      : NOT_ASSESSED_COLOR,
                  }}
                >
                  {preview
                    ? `${commonDict.riskBandLabels[preview.riskBand]} (${preview.riskScore})`
                    : dict.manualEntryNotScored}
                </span>
              </label>
            );
          }

          const categories = categoriesByRegion.get(region) ?? [];
          const names =
            dict.postureCategoryLabels[
              region as keyof typeof dict.postureCategoryLabels
            ] ?? [];
          const pickedIndex = categoryPicks[region];
          const picked =
            pickedIndex !== null ? categories[pickedIndex] : undefined;
          return (
            <label key={region} className="flex flex-col gap-1 text-sm">
              {commonDict.bodyRegionLabels[region]}
              <select
                value={pickedIndex === null ? "" : pickedIndex}
                onChange={(e) =>
                  setCategoryPicks((prev) => ({
                    ...prev,
                    [region]:
                      e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
                className="rounded border px-2 py-1"
              >
                <option value="">{dict.notAssessedOption}</option>
                {categories.map((category, index) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: this list's order/length is fixed for the life of the panel (derived once from the fetched rule set, not reordered/filtered as the user interacts), so the index is a stable identity here, same as it's the actual value being submitted.
                  <option key={index} value={index}>
                    {dict.categoryOptionLabel(
                      names[index] ?? "?",
                      formatCategoryRange(category.ruleRange),
                      commonDict.riskBandLabels[category.band],
                    )}
                  </option>
                ))}
              </select>
              <span
                className="font-technical text-xs font-bold"
                style={{
                  color: picked
                    ? riskBandColors[picked.band]
                    : NOT_ASSESSED_COLOR,
                }}
              >
                {picked
                  ? `${commonDict.riskBandLabels[picked.band]} (${picked.riskScore})`
                  : dict.manualEntryNotScored}
              </span>
            </label>
          );
        })}
      </div>

      <label className="flex max-w-xs flex-col gap-1 text-sm">
        {dict.holdDurationLabel}
        <input
          type="number"
          min={0}
          step="any"
          placeholder={dict.holdDurationPlaceholder}
          value={holdDurationSeconds}
          onChange={(e) => setHoldDurationSeconds(e.target.value)}
          className="rounded border px-2 py-1"
        />
      </label>

      <button
        type="submit"
        disabled={!atLeastOneEntered || submitting || !rules}
        className="self-start rounded bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {submitting ? dict.manualEntrySubmitting : dict.manualEntrySubmit}
      </button>
    </form>
  );
}

type ManualInputRecord = {
  id: string;
  inputType: ManualInputType;
  value: number | null;
  unit: string | null;
  textValue: string | null;
  notes: string | null;
};

function describeManualInputWithNotes(
  entry: ManualInputRecord,
  locale: Locale,
): string {
  const base = describeManualInput(entry, locale);
  return entry.notes ? `${base} — ${entry.notes}` : base;
}

// Creation-only, matching the read-only stance on Company/Site/Workstation
// /Task elsewhere in this dashboard pass — no editing or deleting an
// already-recorded row here. The authoritative history view is the task
// page (src/app/(app)/tasks/[taskId]/page.tsx); addedThisVisit below is
// just immediate feedback for what was just submitted, not fetched from
// the server and not persisted in this component across a reload.
function ManualInputPanel({ taskId }: { taskId: string }) {
  const { locale } = useLocale();
  const dashboardDict = getDashboardDictionary(locale);
  const dict = dashboardDict.capturePage;
  const manualInputLabels = dashboardDict.manualInputLabels;

  const [inputType, setInputType] = useState<ManualInputType>(
    ManualInputType.LOAD_WEIGHT_KG,
  );
  const [numericValue, setNumericValue] = useState("");
  const [textValue, setTextValue] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addedThisVisit, setAddedThisVisit] = useState<ManualInputRecord[]>([]);

  const isText = isTextManualInputType(inputType);
  const unit = MANUAL_INPUT_UNITS[inputType] ?? null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const parsedValue = isText ? null : Number(numericValue);
    const shape = {
      inputType,
      value: isText ? null : Number.isFinite(parsedValue) ? parsedValue : null,
      unit: isText ? null : unit,
      textValue: isText ? textValue.trim() || null : null,
    };

    const shapeError = validateManualInputShape(shape);
    if (shapeError) {
      setError(shapeError);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/manual-inputs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...shape, taskId, notes: notes.trim() || null }),
      });
      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        throw new Error(errorBody?.error ?? dict.requestFailed(res.status));
      }
      const { manualInput } = (await res.json()) as {
        manualInput: ManualInputRecord;
      };
      setAddedThisVisit((prev) => [manualInput, ...prev]);
      setNumericValue("");
      setTextValue("");
      setNotes("");
    } catch (err) {
      setError(err instanceof Error ? err.message : dict.submitFailed);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 border-t pt-6">
      <h2 className="text-lg font-semibold">{dict.manualInputsHeading}</h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {dict.manualInputsDescription}
      </p>

      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm">
          {dict.typeLabel}
          <select
            className="rounded border px-2 py-1"
            value={inputType}
            onChange={(e) => setInputType(e.target.value as ManualInputType)}
          >
            {MANUAL_INPUT_TYPES.map((type) => (
              <option key={type} value={type}>
                {manualInputLabels[type]}
              </option>
            ))}
          </select>
        </label>

        {isText ? (
          <label className="flex flex-col gap-1 text-sm">
            {dict.toolLabel}
            <input
              type="text"
              required
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              className="rounded border px-2 py-1"
            />
          </label>
        ) : (
          <label className="flex flex-col gap-1 text-sm">
            {dict.valueLabel(unit)}
            <input
              type="number"
              step="any"
              required
              value={numericValue}
              onChange={(e) => setNumericValue(e.target.value)}
              className="rounded border px-2 py-1"
            />
          </label>
        )}

        <label className="flex flex-col gap-1 text-sm">
          {dict.notesLabel}
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="rounded border px-2 py-1"
          />
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="rounded border px-4 py-2 disabled:opacity-50"
        >
          {submitting ? dict.adding : dict.add}
        </button>
      </form>

      {error && (
        <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
      )}

      {addedThisVisit.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm">
          {addedThisVisit.map((entry) => (
            <li key={entry.id} className="text-zinc-700 dark:text-zinc-300">
              {manualInputLabels[entry.inputType]}:{" "}
              {describeManualInputWithNotes(entry, locale)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
