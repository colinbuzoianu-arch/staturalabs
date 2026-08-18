import "server-only";

import type { BodyRegion } from "@/generated/prisma/enums";
import { getCommonDictionary } from "@/lib/i18n/dictionaries/common";
import { getDashboardDictionary } from "@/lib/i18n/dictionaries/dashboard";
import type { Locale } from "@/lib/i18n/locale";
import { prisma } from "@/lib/prisma";
import {
  derivePostureCategories,
  formatCategoryRange,
} from "@/lib/scoring/posture-categories";
import { isManuallyScorableRegion } from "./build-region-results";
import type { ManualEntryBodyRegion } from "./manual-angles";
import { resolveEntryMode } from "./manual-angles";
import type { RegionResult } from "./types";

// B11 (SLD_IMPLEMENTATION_PLAN_posture-input.md §3.4): every read view that
// prints a MANUAL_ENTRY sample's per-region detail (the task page, the
// admin task results page, the PDF report) must render a category-mode
// scored region as its classification ("Bent (20–60°) — Moderate"), never
// as a bare degree number — a category pick is not a measurement
// (ERGO_COMPLIANCE_BY_DESIGN.md §3.16). This is the one place that turns a
// sample's already-computed `regions` (RegionResult, from
// buildRegionResultsForSample) back into that label, so the three call
// sites share one implementation instead of each re-deriving it.
//
// Returns null (never an empty object) whenever there's nothing
// category-specific to show — degrees-mode samples, camera samples (their
// manualAngles is an inert placeholder, resolveEntryMode still reads it
// safely), or a sample with no scored regions at all — so callers can
// treat "no categoryDetail" as "render the normal degree-based detail
// text" with a single null check.
//
// Looks each region's categories up against its OWN pinned
// methodologyVersion (RegionResult.methodologyVersion, resolved from the
// BodyRegionScore row at write time — see buildManualRegionResults) rather
// than "whatever methodology is active now," so a historical sample's
// label never drifts if the active methodology changes later — same
// pinned-version discipline as RiskAssessment.matrixVersion and the
// exposure-limit catalog elsewhere in this codebase.
export async function buildCategoryDetail(
  manualAngles: unknown,
  regions: Partial<Record<BodyRegion, RegionResult>>,
  locale: Locale,
): Promise<Partial<Record<BodyRegion, string>> | null> {
  if (
    resolveEntryMode(manualAngles as { entryMode?: unknown }) !== "category"
  ) {
    return null;
  }

  const scoredEntries = (
    Object.entries(regions) as [BodyRegion, RegionResult][]
  ).filter(
    (
      entry,
    ): entry is [BodyRegion, Extract<RegionResult, { status: "scored" }>] =>
      entry[1].status === "scored" && isManuallyScorableRegion(entry[0]),
  );
  if (scoredEntries.length === 0) return null;

  const versions = [
    ...new Set(scoredEntries.map(([, result]) => result.methodologyVersion)),
  ];
  const rules = await prisma.scoringRule.findMany({
    where: { methodologyVersion: { in: versions } },
  });

  const commonDict = getCommonDictionary(locale);
  const capturePageDict = getDashboardDictionary(locale).capturePage;

  const detail: Partial<Record<BodyRegion, string>> = {};
  for (const [region, result] of scoredEntries) {
    const regionRules = rules.filter(
      (rule) => rule.methodologyVersion === result.methodologyVersion,
    );
    const categories = derivePostureCategories(regionRules, region);
    const index = categories.findIndex(
      (category) => category.representativeDegrees === result.degrees,
    );
    const names =
      capturePageDict.postureCategoryLabels[region as ManualEntryBodyRegion];
    if (index === -1 || !names?.[index]) continue;
    const category = categories[index];
    detail[region] = capturePageDict.categoryOptionLabel(
      names[index],
      formatCategoryRange(category.ruleRange),
      commonDict.riskBandLabels[category.band],
    );
  }
  return detail;
}
