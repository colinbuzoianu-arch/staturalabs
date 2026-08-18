import "server-only";

import type {
  BodyRegion,
  CameraAngle,
  ManualInputType,
  PostureSampleSource,
} from "@/generated/prisma/enums";
import type { ManualInputModel } from "@/generated/prisma/models";
import type { requireTaskAccess } from "@/lib/auth/require-access";
import { buildRegionResultsForSample } from "@/lib/capture/build-region-results";
import { buildCategoryDetail } from "@/lib/capture/category-detail";
import { computeHoldTimeResult } from "@/lib/capture/hold-time-result";
import { MANUAL_INPUT_TYPES } from "@/lib/capture/manual-input";
import type { HoldTimeResult, RegionResult } from "@/lib/capture/types";
import { prisma } from "@/lib/prisma";
import {
  computeManualHandlingResult,
  type ManualHandlingResult,
} from "@/lib/scoring/manual-handling";
import { getActiveMethodologyVersion } from "@/lib/scoring/methodology-version";
import {
  computeRepetitionResult,
  type RepetitionResult,
} from "@/lib/scoring/repetition";
import type { ReportLang } from "./report-lang";

// Same shape requireTaskAccess already fetches (task + workstation + site +
// company) — reused rather than re-queried, since the report route calls
// requireTaskAccess for the access check anyway.
export type TaskWithChain = Awaited<
  ReturnType<typeof requireTaskAccess>
>["task"];

export type TaskReportSample = {
  id: string;
  capturedAt: Date;
  source: PostureSampleSource;
  cameraAngle: CameraAngle;
  regions: Partial<Record<BodyRegion, RegionResult>> | null;
  error: string | null;
  holdTime: HoldTimeResult;
  /** B11 (SLD_IMPLEMENTATION_PLAN_posture-input.md §3.4): non-null only for a category-mode MANUAL_ENTRY sample with at least one scored region — see buildCategoryDetail. Drives both the classification text in the per-region table and whether the report prints the "assessed by classification, not measurement" method sentence for this sample. */
  categoryDetail: Partial<Record<BodyRegion, string>> | null;
};

export type ManualInputGroup = {
  inputType: ManualInputType;
  rows: ManualInputModel[];
};

export type TaskReportData = {
  task: TaskWithChain;
  generatedAt: Date;
  methodologyVersion: string | null;
  methodologyError: string | null;
  samples: TaskReportSample[];
  manualInputGroups: ManualInputGroup[];
  manualHandlingResult: ManualHandlingResult;
  repetitionResult: RepetitionResult;
};

// Assembles every piece of stored data for a task's report — the full
// per-sample per-region breakdown (recomputed live from stored keypoints
// against the currently active methodology version, same approach and same
// caveat as the dashboard's task page and the internal /admin results
// view: this can legitimately differ from what was returned/persisted at
// capture time if ScoringRule or computeBodyAngles has changed since) and
// every ManualInput row, grouped by type. No summarizing, no omission —
// the report is meant to carry the same evidence the dashboard shows, not
// a digest of it.
export async function getTaskReportData(
  task: TaskWithChain,
  lang: ReportLang,
): Promise<TaskReportData> {
  const [rawSamples, manualInputs] = await Promise.all([
    prisma.postureSample.findMany({
      where: { taskId: task.id },
      orderBy: { capturedAt: "desc" },
    }),
    prisma.manualInput.findMany({
      where: { taskId: task.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  let methodologyVersion: string | null = null;
  let methodologyError: string | null = null;
  try {
    methodologyVersion = await getActiveMethodologyVersion();
  } catch (err) {
    methodologyError =
      err instanceof Error ? err.message : "No active methodology version";
  }

  const samples: TaskReportSample[] = methodologyVersion
    ? await Promise.all(
        rawSamples.map(async (sample) => {
          try {
            const { regions } = await buildRegionResultsForSample(
              sample,
              methodologyVersion,
            );
            const holdTime = await computeHoldTimeResult({
              regions,
              holdDurationSeconds: sample.holdDurationSeconds,
              methodologyVersion,
            });
            const categoryDetail = await buildCategoryDetail(
              sample.manualAngles,
              regions,
              lang,
            );
            return {
              id: sample.id,
              capturedAt: sample.capturedAt,
              source: sample.source,
              cameraAngle: sample.cameraAngle,
              regions,
              error: null,
              holdTime,
              categoryDetail,
            };
          } catch (err) {
            return {
              id: sample.id,
              capturedAt: sample.capturedAt,
              source: sample.source,
              cameraAngle: sample.cameraAngle,
              regions: null,
              error:
                err instanceof Error
                  ? err.message
                  : "Could not compute body angles",
              holdTime: null,
              categoryDetail: null,
            };
          }
        }),
      )
    : rawSamples.map((sample) => ({
        id: sample.id,
        capturedAt: sample.capturedAt,
        source: sample.source,
        cameraAngle: sample.cameraAngle,
        regions: null,
        error: null,
        holdTime: null,
        categoryDetail: null,
      }));

  // Grouped in MANUAL_INPUT_TYPES order (not creation order) so the report
  // reads the same way regardless of which order things happened to be
  // recorded in; rows within a group stay in the findMany's desc-by-
  // createdAt order.
  const manualInputGroups: ManualInputGroup[] = MANUAL_INPUT_TYPES.map(
    (inputType) => ({
      inputType,
      rows: manualInputs.filter((m) => m.inputType === inputType),
    }),
  ).filter((group) => group.rows.length > 0);

  // §7 B8: parallel sub-score, computed live the same way every other
  // read view does — never a frozen snapshot of what a past capture saw.
  const manualHandlingResult = methodologyVersion
    ? await computeManualHandlingResult({
        taskId: task.id,
        methodologyVersion,
      })
    : null;

  // B8d (SLD_NEXT_STEPS_B8b-B8f.md): same live-computed, parallel
  // sub-score discipline as manualHandlingResult above.
  const repetitionResult = methodologyVersion
    ? await computeRepetitionResult({
        taskId: task.id,
        methodologyVersion,
      })
    : null;

  return {
    task,
    generatedAt: new Date(),
    methodologyVersion,
    methodologyError,
    samples,
    manualInputGroups,
    manualHandlingResult,
    repetitionResult,
  };
}
