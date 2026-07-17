import "server-only";

import type {
  BodyRegion,
  CameraAngle,
  ManualInputType,
} from "@/generated/prisma/enums";
import type { ManualInputModel } from "@/generated/prisma/models";
import type { requireTaskAccess } from "@/lib/auth/require-access";
import { buildRegionResults } from "@/lib/capture/build-region-results";
import { MANUAL_INPUT_TYPES } from "@/lib/capture/manual-input";
import type { RegionResult } from "@/lib/capture/types";
import type { PoseLandmarks } from "@/lib/pose/angles";
import { prisma } from "@/lib/prisma";
import { getActiveMethodologyVersion } from "@/lib/scoring/methodology-version";

// Same shape requireTaskAccess already fetches (task + workstation + site +
// company) — reused rather than re-queried, since the report route calls
// requireTaskAccess for the access check anyway.
export type TaskWithChain = Awaited<
  ReturnType<typeof requireTaskAccess>
>["task"];

export type TaskReportSample = {
  id: string;
  capturedAt: Date;
  cameraAngle: CameraAngle;
  regions: Partial<Record<BodyRegion, RegionResult>> | null;
  error: string | null;
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
            const regions = await buildRegionResults({
              landmarks: sample.keypoints as unknown as PoseLandmarks,
              cameraAngle: sample.cameraAngle,
              methodologyVersion,
            });
            return {
              id: sample.id,
              capturedAt: sample.capturedAt,
              cameraAngle: sample.cameraAngle,
              regions,
              error: null,
            };
          } catch (err) {
            return {
              id: sample.id,
              capturedAt: sample.capturedAt,
              cameraAngle: sample.cameraAngle,
              regions: null,
              error:
                err instanceof Error
                  ? err.message
                  : "Could not compute body angles",
            };
          }
        }),
      )
    : rawSamples.map((sample) => ({
        id: sample.id,
        capturedAt: sample.capturedAt,
        cameraAngle: sample.cameraAngle,
        regions: null,
        error: null,
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

  return {
    task,
    generatedAt: new Date(),
    methodologyVersion,
    methodologyError,
    samples,
    manualInputGroups,
  };
}
