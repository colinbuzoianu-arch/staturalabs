"use client";

import { useEffect, useMemo, useState } from "react";
import type { BodyRegion, RiskBand } from "@/generated/prisma/enums";
import { describeRegionResult } from "@/lib/capture/describe-region-result";
import type { RegionResult } from "@/lib/capture/types";
import {
  NOT_ASSESSED_COLOR,
  riskBandColors,
  riskBandRank,
  worstRiskBand,
} from "@/lib/risk/band-severity";
import { type AngleRangeRule, matchScoringRule } from "@/lib/scoring/match";

// Hand-authored, not derived from the enum string — BodyRegion itself stays
// untranslated everywhere else in this app (CLAUDE.md's i18n scope note),
// but this is presentation copy over it, same category as
// MANUAL_INPUT_LABELS. English-only for now, matching the same known gap as
// /admin's Server Action errors and the PDF reports — this component has no
// page wiring yet for i18n to attach to.
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

// Mirrors the GET /api/scoring-rules response shape (src/app/api/scoring-rules/route.ts)
// exactly — field names match ScoringRule's own columns (angleMin/angleMax)
// rather than being renamed in transit, so a fetched row satisfies
// AngleRangeRule and can be passed to matchScoringRule with no mapping
// step. No cameraAngle field: ScoringRule carries no such column — see that
// route's comment.
type ScoringRuleRow = AngleRangeRule & {
  bodyRegion: BodyRegion;
  riskBand: RiskBand;
  riskScore: number;
};

type ScoringRulesResponse = {
  methodologyVersion: string;
  rules: ScoringRuleRow[];
};

type RulesState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; methodologyVersion: string; rules: ScoringRuleRow[] };

type ScoredRegionResult = Extract<RegionResult, { status: "scored" }>;

const SLIDER_STEP_DEGREES = 0.5;
const SLIDER_PADDING_DEGREES = 5;

// Slider bounds span every threshold this region's rule set defines (a null
// angleMin/angleMax — unbounded — is excluded from the min/max, since it
// has no concrete value to bound a slider with) plus a small padding, and
// are widened to include the measured angle itself in case the rule set has
// changed since capture (see build-region-results.ts's recompute-drift
// note) and no longer covers it.
function deriveSliderRange(
  rules: ScoringRuleRow[],
  measuredDegrees: number,
): { min: number; max: number } {
  const bounds = rules
    .flatMap((rule) => [rule.angleMin, rule.angleMax])
    .filter((value): value is number => value !== null);

  const finiteMin = bounds.length > 0 ? Math.min(...bounds) : measuredDegrees;
  const finiteMax = bounds.length > 0 ? Math.max(...bounds) : measuredDegrees;

  return {
    min: Math.min(finiteMin, measuredDegrees) - SLIDER_PADDING_DEGREES,
    max: Math.max(finiteMax, measuredDegrees) + SLIDER_PADDING_DEGREES,
  };
}

function findRuleForAngle(
  rules: ScoringRuleRow[],
  angleDegrees: number,
): ScoringRuleRow | null {
  return (
    rules.find((rule) => {
      const min = rule.angleMin ?? Number.NEGATIVE_INFINITY;
      const max = rule.angleMax ?? Number.POSITIVE_INFINITY;
      return angleDegrees >= min && angleDegrees < max;
    }) ?? null
  );
}

// A CSS gradient painting each rule's band color across its own angle span
// of the slider track (proportional to [sliderMin, sliderMax]), with any
// uncovered span (a real gap in the thresholds — see TRUNK's "no rule below
// 0°" case) rendered in the neutral "not assessed" gray rather than left
// implying continuous coverage. This is what makes ELBOW's HIGH/LOW/HIGH
// non-monotonic shape and NECK's two differently-scored HIGH bands visible
// on the track itself, not just inferable from the number.
function buildTrackGradient(
  rules: ScoringRuleRow[],
  sliderMin: number,
  sliderMax: number,
): string {
  const span = sliderMax - sliderMin;
  if (span <= 0) return NOT_ASSESSED_COLOR;

  const clamp = (value: number) =>
    Math.min(sliderMax, Math.max(sliderMin, value));
  const toPercent = (value: number) => ((value - sliderMin) / span) * 100;

  const segments = rules
    .map((rule) => ({
      start: clamp(rule.angleMin ?? sliderMin),
      end: clamp(rule.angleMax ?? sliderMax),
      color: riskBandColors[rule.riskBand],
    }))
    .filter((segment) => segment.end > segment.start)
    .sort((a, b) => a.start - b.start);

  const stops: string[] = [];
  let cursor = sliderMin;
  for (const segment of segments) {
    if (segment.start > cursor) {
      stops.push(
        `${NOT_ASSESSED_COLOR} ${toPercent(cursor)}%`,
        `${NOT_ASSESSED_COLOR} ${toPercent(segment.start)}%`,
      );
    }
    stops.push(
      `${segment.color} ${toPercent(segment.start)}%`,
      `${segment.color} ${toPercent(segment.end)}%`,
    );
    cursor = segment.end;
  }
  if (cursor < sliderMax) {
    stops.push(
      `${NOT_ASSESSED_COLOR} ${toPercent(cursor)}%`,
      `${NOT_ASSESSED_COLOR} ${toPercent(sliderMax)}%`,
    );
  }

  return `linear-gradient(to right, ${stops.join(", ")})`;
}

type Simulation = {
  region: BodyRegion;
  label: string;
  originalDegrees: number;
  originalBand: RiskBand;
  originalScore: number;
  regionRules: ScoringRuleRow[];
  sliderMin: number;
  sliderMax: number;
  sliderValue: number;
} & (
  | { ok: true; band: RiskBand | null; score: number | null }
  | { ok: false; error: string }
);

// Describes, in words, where the slider would need to cross back for the
// band to flip relative to the measured value — derived from the boundary
// of the *original* matched rule nearest the slider's current position, not
// a fixed lookup, so it reads correctly no matter which direction the
// slider moved or which rule (of a non-monotonic set) is currently active.
function describeTransition(sim: Simulation): string | null {
  if (!sim.ok || sim.band === null || sim.band === sim.originalBand) {
    return null;
  }

  const direction =
    riskBandRank(sim.band) < riskBandRank(sim.originalBand)
      ? "improves"
      : "worsens";
  const originalRule = findRuleForAngle(sim.regionRules, sim.originalDegrees);
  if (!originalRule) return `${direction} at this angle`;

  if (sim.sliderValue < sim.originalDegrees && originalRule.angleMin !== null) {
    return `${direction} at ≤ ${originalRule.angleMin.toFixed(1)}°`;
  }
  if (sim.sliderValue > sim.originalDegrees && originalRule.angleMax !== null) {
    return `${direction} at ≥ ${originalRule.angleMax.toFixed(1)}°`;
  }
  return `${direction} at this angle`;
}

function BandPill({ band }: { band: RiskBand | null }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 font-technical text-xs font-bold text-white"
      style={{
        backgroundColor: band ? riskBandColors[band] : NOT_ASSESSED_COLOR,
      }}
    >
      {band ?? "no match"}
    </span>
  );
}

function ScoredRegionRow({
  sim,
  onChange,
  onReset,
}: {
  sim: Simulation;
  onChange: (degrees: number) => void;
  onReset: () => void;
}) {
  const gradient = useMemo(
    () => buildTrackGradient(sim.regionRules, sim.sliderMin, sim.sliderMax),
    [sim.regionRules, sim.sliderMin, sim.sliderMax],
  );
  const measuredPercent =
    ((sim.originalDegrees - sim.sliderMin) / (sim.sliderMax - sim.sliderMin)) *
    100;
  const transition = describeTransition(sim);
  const changed = Math.abs(sim.sliderValue - sim.originalDegrees) > 0.001;

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-heading font-bold">{sim.label}</span>
          <span className="font-technical text-xs text-border">
            measured {sim.originalDegrees.toFixed(1)}°
          </span>
          <BandPill band={sim.originalBand} />
        </div>

        {sim.ok ? (
          <div className="flex items-center gap-2">
            {changed && (
              <>
                <span aria-hidden="true" className="text-border">
                  →
                </span>
                <BandPill band={sim.band} />
              </>
            )}
            {changed && (
              <button
                type="button"
                onClick={onReset}
                className="font-technical text-xs text-border underline hover:text-accent"
              >
                reset
              </button>
            )}
          </div>
        ) : (
          <span className="font-technical text-xs text-accent">
            {sim.error}
          </span>
        )}
      </div>

      {sim.ok && (
        <>
          <div className="relative mt-4 flex h-6 items-center">
            <div
              className="pointer-events-none absolute inset-x-0 h-2 rounded-full"
              style={{ background: gradient }}
            />
            {/* Marks where the actual measured angle sits on the track, independent of the slider's current position. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute h-4 w-0.5 -translate-x-1/2 bg-foreground/70"
              style={{ left: `${measuredPercent}%` }}
            />
            <input
              type="range"
              aria-label={`${sim.label} angle`}
              min={sim.sliderMin}
              max={sim.sliderMax}
              step={SLIDER_STEP_DEGREES}
              value={sim.sliderValue}
              onChange={(event) => onChange(Number(event.target.value))}
              className="relative w-full cursor-pointer appearance-none bg-transparent [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-foreground [&::-moz-range-thumb]:shadow [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:-mt-1.5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-foreground [&::-webkit-slider-thumb]:shadow"
            />
          </div>
          <div className="mt-1 flex items-center justify-between font-technical text-xs text-border">
            <span>
              {sim.sliderValue.toFixed(1)}° →{" "}
              {sim.band ?? "no threshold matched"}
              {sim.score !== null && ` (score ${sim.score})`}
            </span>
            {transition && <span>{transition}</span>}
          </div>
        </>
      )}
    </div>
  );
}

function StatusRow({
  region,
  result,
}: {
  region: BodyRegion;
  result: RegionResult;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 opacity-50">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-heading font-bold">{REGION_LABELS[region]}</span>
        <span
          className="rounded-full px-2 py-0.5 font-technical text-xs font-bold text-white"
          style={{ backgroundColor: NOT_ASSESSED_COLOR }}
        >
          {result.status}
        </span>
      </div>
      <p className="mt-1 font-technical text-xs text-border">
        {describeRegionResult(result)} — no measured angle to simulate from.
      </p>
    </div>
  );
}

function SummaryPanel({ simulations }: { simulations: Simulation[] }) {
  let improved = 0;
  let worsened = 0;
  let unchanged = 0;
  let unmatched = 0;
  const currentBands: RiskBand[] = [];
  const simulatedBands: RiskBand[] = [];

  for (const sim of simulations) {
    currentBands.push(sim.originalBand);
    if (!sim.ok || sim.band === null) {
      unmatched += 1;
      // A region whose simulated angle matches nothing is a real gap in
      // the thresholds, not a stand-in for "unchanged" — it's excluded
      // from the worst-band comparison below rather than defaulting to
      // the original band, same "never substitute a default" discipline
      // matchScoringRule itself follows.
      continue;
    }
    simulatedBands.push(sim.band);
    const rankDiff = riskBandRank(sim.band) - riskBandRank(sim.originalBand);
    if (rankDiff < 0) improved += 1;
    else if (rankDiff > 0) worsened += 1;
    else unchanged += 1;
  }

  const worstNow = worstRiskBand(currentBands);
  const worstSimulated = worstRiskBand(simulatedBands);

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap gap-6">
        <Stat label="Improved" value={improved} />
        <Stat label="Unchanged" value={unchanged} />
        <Stat label="Worsened" value={worsened} />
        <div className="flex flex-col gap-1">
          <span className="font-technical text-xs uppercase tracking-[0.15em] text-border">
            Worst band
          </span>
          <div className="flex items-center gap-2">
            <BandPill band={worstNow} />
            <span aria-hidden="true" className="text-border">
              →
            </span>
            <BandPill band={worstSimulated} />
          </div>
        </div>
      </div>
      {unmatched > 0 && (
        <p className="mt-3 font-technical text-xs text-accent">
          {unmatched} region{unmatched === 1 ? "" : "s"} currently at an angle
          with no matching threshold — excluded from the worst-band comparison
          above.
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-technical text-xs uppercase tracking-[0.15em] text-border">
        {label}
      </span>
      <span className="font-heading text-xl font-bold">{value}</span>
    </div>
  );
}

// Client-side re-scoring of a captured sample's angles against
// slider-adjusted values, using the exact same pure matchScoringRule the
// server uses (src/lib/scoring/match.ts) — never a re-implementation of the
// matching logic. Fetches the active rule set once on mount
// (GET /api/scoring-rules) and does every subsequent slider computation
// locally: zero server round-trips per slider change, and this component
// never POSTs or mutates anything — it has exactly one fetch, and it's a
// GET.
//
// This is a hypothetical-angle tool, not a physical-intervention predictor
// (§3.4/§3.6): the framing note below is load-bearing product copy, not
// optional UX polish, and is rendered unconditionally alongside the
// methodology version so a viewer never sees simulated numbers without it.
export function WhatIfSimulator({
  regionResults,
}: {
  regionResults: Record<BodyRegion, RegionResult>;
}) {
  const [rulesState, setRulesState] = useState<RulesState>({
    status: "loading",
  });

  useEffect(() => {
    let cancelled = false;

    fetch("/api/scoring-rules")
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(
            (body as { error?: string } | null)?.error ??
              `Request failed (${response.status})`,
          );
        }
        return (await response.json()) as ScoringRulesResponse;
      })
      .then((data) => {
        if (!cancelled) {
          setRulesState({
            status: "ready",
            methodologyVersion: data.methodologyVersion,
            rules: data.rules,
          });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setRulesState({
            status: "error",
            message:
              err instanceof Error
                ? err.message
                : "Could not load scoring rules",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Small, fixed-size (17 BodyRegion values) — recomputing on every render
  // rather than memoizing isn't worth the extra dependency bookkeeping.
  const entries = Object.entries(regionResults) as [BodyRegion, RegionResult][];
  const scoredEntries = entries.filter(
    (entry): entry is [BodyRegion, ScoredRegionResult] =>
      entry[1].status === "scored",
  );

  const [sliderValues, setSliderValues] = useState<
    Partial<Record<BodyRegion, number>>
  >(() =>
    Object.fromEntries(
      scoredEntries.map(([region, result]) => [region, result.degrees]),
    ),
  );

  const simulations: Simulation[] =
    rulesState.status !== "ready"
      ? []
      : scoredEntries.map(([region, result]) => {
          const regionRules = rulesState.rules.filter(
            (rule) => rule.bodyRegion === region,
          );
          const { min, max } = deriveSliderRange(regionRules, result.degrees);
          const sliderValue = sliderValues[region] ?? result.degrees;

          const base = {
            region,
            label: REGION_LABELS[region],
            originalDegrees: result.degrees,
            originalBand: result.riskBand,
            originalScore: result.riskScore,
            regionRules,
            sliderMin: min,
            sliderMax: max,
            sliderValue,
          };

          try {
            const matched = matchScoringRule(regionRules, sliderValue);
            return {
              ...base,
              ok: true as const,
              band: matched?.riskBand ?? null,
              score: matched?.riskScore ?? null,
            };
          } catch (err) {
            return {
              ...base,
              ok: false as const,
              error:
                err instanceof Error ? err.message : "Ambiguous rule match",
            };
          }
        });

  const nonScoredEntries = entries.filter(
    ([, result]) => result.status !== "scored",
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-border bg-surface p-4 text-sm">
        <p>
          This simulates how the score changes at different posture angles. It
          does not predict the effect of a physical intervention (e.g. raising a
          table). Results are hypothetical — no data is saved.
        </p>
        <p className="mt-2 font-technical text-xs text-border">
          Scoring methodology:{" "}
          {rulesState.status === "ready"
            ? rulesState.methodologyVersion
            : rulesState.status === "error"
              ? "unavailable"
              : "loading…"}
        </p>
      </div>

      {rulesState.status === "error" && (
        <div className="rounded-lg border border-accent p-3 text-sm text-accent">
          Could not load scoring rules: {rulesState.message}
        </div>
      )}

      {scoredEntries.length > 0 && rulesState.status === "ready" && (
        <SummaryPanel simulations={simulations} />
      )}

      <div className="flex flex-col gap-3">
        {scoredEntries.map(([region, result]) => {
          if (rulesState.status === "loading") {
            return (
              <div
                key={region}
                className="rounded-lg border border-border bg-surface p-4"
              >
                <div className="flex items-center gap-2">
                  <span className="font-heading font-bold">
                    {REGION_LABELS[region]}
                  </span>
                  <span className="font-technical text-xs text-border">
                    measured {result.degrees.toFixed(1)}°
                  </span>
                </div>
                <p className="mt-2 font-technical text-xs text-border">
                  Loading interactive range…
                </p>
              </div>
            );
          }

          if (rulesState.status === "error") {
            return (
              <div
                key={region}
                className="rounded-lg border border-border bg-surface p-4 opacity-60"
              >
                <div className="flex items-center gap-2">
                  <span className="font-heading font-bold">
                    {REGION_LABELS[region]}
                  </span>
                  <span className="font-technical text-xs text-border">
                    measured {result.degrees.toFixed(1)}°
                  </span>
                  <BandPill band={result.riskBand} />
                </div>
              </div>
            );
          }

          const sim = simulations.find((s) => s.region === region);
          if (!sim) return null;

          return (
            <ScoredRegionRow
              key={region}
              sim={sim}
              onChange={(degrees) =>
                setSliderValues((prev) => ({ ...prev, [region]: degrees }))
              }
              onReset={() =>
                setSliderValues((prev) => ({
                  ...prev,
                  [region]: result.degrees,
                }))
              }
            />
          );
        })}

        {nonScoredEntries.map(([region, result]) => (
          <StatusRow key={region} region={region} result={result} />
        ))}
      </div>
    </div>
  );
}
