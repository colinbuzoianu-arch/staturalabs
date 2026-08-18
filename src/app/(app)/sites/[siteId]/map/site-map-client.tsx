"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";
import type {
  BodyRegion,
  HazardCategory,
  RiskBand,
} from "@/generated/prisma/enums";
import { getCommonDictionary } from "@/lib/i18n/dictionaries/common";
import { useLocale } from "@/lib/i18n/locale-context";
import {
  NOT_ASSESSED_COLOR,
  riskBandColors,
  worstRiskBand,
} from "@/lib/risk/band-severity";

export type SiteMapDict = {
  categoryFilterHeading: string;
  allCategoriesLabel: string;
  legendHeading: string;
  legendWorkstationShape: string;
  legendTaskShape: string;
  legendNotAssessedColor: string;
  taskPopoverWorkstationPrefix: string;
  taskPopoverBandPrefix: string;
  taskPopoverConcerningHeading: string;
  taskPopoverNoConcerning: string;
  taskPopoverViewLink: string;
  workstationPopoverBandPrefix: string;
  workstationPopoverNotAssessed: string;
  workstationPopoverNoFindingsForCategory: string;
  workstationPopoverOpenActionsPrefix: string;
  workstationPopoverViewLink: string;
  workstationPopoverTasksPlacedSuffix: string;
  workstationPopoverUnplacedBandPrefix: string;
  workstationPopoverNoUnplacedData: string;
};

type TaskPin = {
  taskId: string;
  taskName: string;
  workstationId: string;
  workstationName: string;
  x: number;
  y: number;
  overallBand: RiskBand | null;
  concerningRegions: Array<{ region: BodyRegion; band: RiskBand }>;
};

type WorkstationPin = {
  workstationId: string;
  workstationName: string;
  x: number;
  y: number;
  totalTaskCount: number;
  placedTaskCount: number;
  unplacedErgonomicBand: RiskBand | null;
  hasApprovedAssessment: boolean;
  findings: Array<{ category: HazardCategory; band: RiskBand }>;
  openActionsCount: number;
};

type PinKey = `task:${string}` | `workstation:${string}`;

const WORKSTATION_MARKER_RADIUS = 9;
const WORKSTATION_MARKER_RADIUS_MIXED = 6;
const TASK_MARKER_SIZE = 12;

function colorForBand(band: RiskBand | null): string {
  return band ? riskBandColors[band] : NOT_ASSESSED_COLOR;
}

function worstBandForCategory(
  findings: Array<{ category: HazardCategory; band: RiskBand }>,
  category: HazardCategory | null,
): RiskBand | null {
  const relevant =
    category === null
      ? findings
      : findings.filter((f) => f.category === category);
  return worstRiskBand(relevant.map((f) => f.band));
}

export function SiteMapClient({
  floorPlanName,
  imageUrl,
  imageWidth,
  imageHeight,
  taskPins,
  workstationPins,
  dict,
  hazardCategoryLabels,
}: {
  floorPlanName: string;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  taskPins: TaskPin[];
  workstationPins: WorkstationPin[];
  dict: SiteMapDict;
  hazardCategoryLabels: Record<HazardCategory, string>;
}) {
  const { locale } = useLocale();
  const commonDict = getCommonDictionary(locale);
  const [selectedCategory, setSelectedCategory] =
    useState<HazardCategory | null>(null);
  const [hoveredKey, setHoveredKey] = useState<PinKey | null>(null);
  const [selectedKey, setSelectedKey] = useState<PinKey | null>(null);
  const activeKey = hoveredKey ?? selectedKey;

  // BodyRegion carries no HazardCategory of its own anywhere in this
  // schema — a task's band comes entirely from posture/ergonomic scoring,
  // which has no per-category breakdown to re-derive from. So task-level
  // pins (and the mixed-case workstation marker, which is the same
  // ergonomic computation over a task subset) only make sense for the
  // "all categories" and "ERGONOMIC_MSD" views; any other category filter
  // hides them and falls back to the workstation-level RiskFinding-based
  // aggregate for every pinned workstation instead (see below).
  const isErgonomicView =
    selectedCategory === null || selectedCategory === "ERGONOMIC_MSD";

  const visibleTaskPins = isErgonomicView ? taskPins : [];

  const visibleWorkstationPins: Array<{
    pin: WorkstationPin;
    variant: "full" | "mixed";
    band: RiskBand | null;
  }> = workstationPins.flatMap(
    (
      pin,
    ): Array<{
      pin: WorkstationPin;
      variant: "full" | "mixed";
      band: RiskBand | null;
    }> => {
      if (isErgonomicView) {
        if (pin.placedTaskCount === 0) {
          return [
            {
              pin,
              variant: "full" as const,
              band: worstBandForCategory(pin.findings, selectedCategory),
            },
          ];
        }
        if (pin.placedTaskCount < pin.totalTaskCount) {
          return [
            { pin, variant: "mixed" as const, band: pin.unplacedErgonomicBand },
          ];
        }
        // Every task at this workstation is individually pinned — the
        // workstation-level marker would just restate the same tasks'
        // ergonomic risk a second time, so it's dropped entirely here.
        return [];
      }
      // Non-ergonomic category: task data is irrelevant (see comment above),
      // so always show the full RiskAssessment-based aggregate regardless of
      // placement tier — otherwise a fully-task-pinned workstation would
      // vanish from e.g. the Noise filter even if it has real noise findings.
      return [
        {
          pin,
          variant: "full" as const,
          band: worstBandForCategory(pin.findings, selectedCategory),
        },
      ];
    },
  );

  const activeTaskPin = taskPins.find((p) => activeKey === `task:${p.taskId}`);
  const activeWorkstationEntry = visibleWorkstationPins.find(
    (entry) => activeKey === `workstation:${entry.pin.workstationId}`,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h2 className="font-heading text-sm font-bold text-border">
          {dict.categoryFilterHeading}
        </h2>
        <div className="flex flex-wrap gap-2 text-sm">
          <CategoryChip
            label={dict.allCategoriesLabel}
            active={selectedCategory === null}
            onClick={() => setSelectedCategory(null)}
          />
          {(Object.keys(hazardCategoryLabels) as HazardCategory[]).map(
            (category) => (
              <CategoryChip
                key={category}
                label={hazardCategoryLabels[category]}
                active={selectedCategory === category}
                onClick={() => setSelectedCategory(category)}
              />
            ),
          )}
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* biome-ignore lint/a11y/noStaticElementInteractions: this click only clears the active popover selection — every real action (opening a pin's popover, following its link) is already reachable via the buttons/links inside the markers and popover below. */}
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: same reasoning — deselection has no separate keyboard-only affordance to add here. */}
        <div
          className="relative w-full max-w-4xl overflow-hidden rounded-lg border border-border"
          style={{ aspectRatio: `${imageWidth} / ${imageHeight}` }}
          onClick={() => setSelectedKey(null)}
        >
          {/* biome-ignore lint/performance/noImgElement: signed URL is per-request/short-lived, not a static asset for Next's image optimizer to cache */}
          <img
            src={imageUrl}
            alt={floorPlanName}
            className="pointer-events-none block h-full w-full object-fill"
            draggable={false}
          />

          {/* No viewBox — see the floor-plan placement page's identical
              overlay for why: percentage cx/cy/x/y resolve independently
              per axis against the SVG's own rendered size, so circles stay
              circular and text stays undistorted regardless of the image's
              aspect ratio. */}
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            aria-hidden="true"
          >
            {visibleWorkstationPins.map(({ pin, variant, band }) => {
              const key: PinKey = `workstation:${pin.workstationId}`;
              const dimmed = variant === "mixed";
              // §7 B6: "unassessed workstations visually distinct (not
              // just uncoloured — an unassessed workstation is a finding
              // in itself under §4 ASchG)." A bare gray fill (same as any
              // other band) reads as just another color in the legend;
              // this needs to visually interrupt the pattern, not blend
              // into it — larger, dashed, coral-stroked, same treatment
              // this app already uses for an over-limit measurement.
              const isUnassessed = !dimmed && band === null;
              return (
                // biome-ignore lint/a11y/noStaticElementInteractions: decorative heatmap marker on a visual overlay — same tradeoff as the floor-plan placement page's task markers. The workstation it represents is always reachable via the "view workstation risk" link inside the popover this opens.
                <circle
                  key={key}
                  cx={`${pin.x * 100}%`}
                  cy={`${pin.y * 100}%`}
                  r={
                    dimmed
                      ? WORKSTATION_MARKER_RADIUS_MIXED
                      : isUnassessed
                        ? WORKSTATION_MARKER_RADIUS + 3
                        : WORKSTATION_MARKER_RADIUS
                  }
                  fill={colorForBand(band)}
                  opacity={dimmed ? 0.55 : 1}
                  stroke={isUnassessed ? "var(--accent)" : "var(--background)"}
                  strokeWidth={isUnassessed ? 2.5 : 1.5}
                  strokeDasharray={isUnassessed ? "3 2" : undefined}
                  className="pointer-events-auto cursor-pointer"
                  onMouseEnter={() => setHoveredKey(key)}
                  onMouseLeave={() =>
                    setHoveredKey((current) =>
                      current === key ? null : current,
                    )
                  }
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedKey((current) => (current === key ? null : key));
                  }}
                />
              );
            })}

            {visibleTaskPins.map((pin) => {
              const key: PinKey = `task:${pin.taskId}`;
              return (
                // biome-ignore lint/a11y/noStaticElementInteractions: decorative heatmap marker — the task it represents is always reachable via the "view task" link inside the popover this opens.
                <rect
                  key={key}
                  x={`${pin.x * 100}%`}
                  y={`${pin.y * 100}%`}
                  width={TASK_MARKER_SIZE}
                  height={TASK_MARKER_SIZE}
                  transform={`translate(${-TASK_MARKER_SIZE / 2}, ${-TASK_MARKER_SIZE / 2})`}
                  fill={colorForBand(pin.overallBand)}
                  stroke="var(--background)"
                  strokeWidth={1.5}
                  className="pointer-events-auto cursor-pointer"
                  onMouseEnter={() => setHoveredKey(key)}
                  onMouseLeave={() =>
                    setHoveredKey((current) =>
                      current === key ? null : current,
                    )
                  }
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedKey((current) => (current === key ? null : key));
                  }}
                />
              );
            })}

            {/* Optional future enhancement, skipped for v1: when task-level
                pins exist for a workstation, that workstation's own
                WorkstationPlanPosition (if any) could render here as a
                subtle, low-opacity, no-fill label — just the name — so the
                admin sees the spatial grouping without a colored marker
                competing with the task pins. Left out to keep this pass's
                rendering logic (already three tiers: full/mixed/hidden) from
                growing a fourth "label-only" variant. */}
          </svg>

          {activeTaskPin && (
            <PopoverCard x={activeTaskPin.x} y={activeTaskPin.y}>
              <p className="font-semibold">{activeTaskPin.taskName}</p>
              <p className="text-border">
                {dict.taskPopoverWorkstationPrefix}{" "}
                {activeTaskPin.workstationName}
              </p>
              <p>
                {dict.taskPopoverBandPrefix}{" "}
                {activeTaskPin.overallBand
                  ? commonDict.riskBandLabels[activeTaskPin.overallBand]
                  : dict.workstationPopoverNotAssessed}
              </p>
              <p className="mt-1 font-semibold">
                {dict.taskPopoverConcerningHeading}
              </p>
              {activeTaskPin.concerningRegions.length === 0 ? (
                <p className="text-border">{dict.taskPopoverNoConcerning}</p>
              ) : (
                <ul className="list-inside list-disc">
                  {activeTaskPin.concerningRegions.map((region) => (
                    <li key={region.region}>
                      {commonDict.bodyRegionLabels[region.region]}:{" "}
                      {commonDict.riskBandLabels[region.band]}
                    </li>
                  ))}
                </ul>
              )}
              <Link
                href={`/tasks/${activeTaskPin.taskId}`}
                className="mt-1 inline-block underline hover:text-accent"
              >
                {dict.taskPopoverViewLink}
              </Link>
            </PopoverCard>
          )}

          {activeWorkstationEntry && (
            <PopoverCard
              x={activeWorkstationEntry.pin.x}
              y={activeWorkstationEntry.pin.y}
            >
              <p className="font-semibold">
                {activeWorkstationEntry.pin.workstationName}
              </p>
              {activeWorkstationEntry.variant === "full" ? (
                <>
                  <p>
                    {dict.workstationPopoverBandPrefix}{" "}
                    {activeWorkstationEntry.band
                      ? commonDict.riskBandLabels[activeWorkstationEntry.band]
                      : activeWorkstationEntry.pin.hasApprovedAssessment
                        ? dict.workstationPopoverNoFindingsForCategory
                        : dict.workstationPopoverNotAssessed}
                  </p>
                  <p>
                    {dict.workstationPopoverOpenActionsPrefix}{" "}
                    {activeWorkstationEntry.pin.openActionsCount}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-border">
                    {activeWorkstationEntry.pin.placedTaskCount}/
                    {activeWorkstationEntry.pin.totalTaskCount}{" "}
                    {dict.workstationPopoverTasksPlacedSuffix}
                  </p>
                  <p>
                    {dict.workstationPopoverUnplacedBandPrefix}{" "}
                    {activeWorkstationEntry.band
                      ? commonDict.riskBandLabels[activeWorkstationEntry.band]
                      : dict.workstationPopoverNoUnplacedData}
                  </p>
                </>
              )}
              <Link
                href={`/workstations/${activeWorkstationEntry.pin.workstationId}/risk`}
                className="mt-1 inline-block underline hover:text-accent"
              >
                {dict.workstationPopoverViewLink}
              </Link>
            </PopoverCard>
          )}
        </div>

        <div className="flex w-full max-w-xs flex-col gap-3 text-sm">
          <h2 className="font-heading text-lg font-bold">
            {dict.legendHeading}
          </h2>

          <div className="flex items-center gap-2">
            <svg width={16} height={16} aria-hidden="true">
              <circle cx={8} cy={8} r={6} fill="currentColor" />
            </svg>
            <span>{dict.legendWorkstationShape}</span>
          </div>
          <div className="flex items-center gap-2">
            <svg width={16} height={16} aria-hidden="true">
              <rect x={3} y={3} width={10} height={10} fill="currentColor" />
            </svg>
            <span>{dict.legendTaskShape}</span>
          </div>

          <div className="flex flex-col gap-1">
            {(Object.entries(riskBandColors) as Array<[RiskBand, string]>).map(
              ([band, color]) => (
                <div key={band} className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span>{commonDict.riskBandLabels[band]}</span>
                </div>
              ),
            )}
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: NOT_ASSESSED_COLOR }}
              />
              <span>{dict.legendNotAssessedColor}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1 transition-colors ${
        active
          ? "border-accent bg-accent text-background"
          : "border-border hover:border-accent"
      }`}
    >
      {label}
    </button>
  );
}

function PopoverCard({
  x,
  y,
  children,
}: {
  x: number;
  y: number;
  children: ReactNode;
}) {
  return (
    <div
      className="absolute z-10 w-56 rounded-lg border border-border bg-surface p-3 text-xs shadow-lg"
      style={{
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        transform: "translate(16px, -50%)",
      }}
    >
      {children}
    </div>
  );
}
