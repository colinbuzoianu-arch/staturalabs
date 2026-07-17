import Link from "next/link";
import { notFound } from "next/navigation";
import { BodyRegion } from "@/generated/prisma/enums";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { buildRegionResults } from "@/lib/capture/build-region-results";
import { describeRegionResult } from "@/lib/capture/describe-region-result";
import type { RegionResult } from "@/lib/capture/types";
import type { PoseLandmarks } from "@/lib/pose/angles";
import { prisma } from "@/lib/prisma";
import { getActiveMethodologyVersion } from "@/lib/scoring/methodology-version";

const ALL_BODY_REGIONS = Object.values(BodyRegion);

export default async function TaskResultsPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  await requireSuperAdmin();
  const { taskId } = await params;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      workstation: { include: { site: { include: { company: true } } } },
    },
  });
  if (!task) notFound();

  const samples = await prisma.postureSample.findMany({
    where: { taskId },
    orderBy: { capturedAt: "desc" },
  });

  let methodologyVersion: string | null = null;
  let methodologyError: string | null = null;
  try {
    methodologyVersion = await getActiveMethodologyVersion();
  } catch (err) {
    methodologyError =
      err instanceof Error ? err.message : "No active methodology version";
  }

  const rows = methodologyVersion
    ? await Promise.all(
        samples.map(async (sample) => {
          try {
            const regions = await buildRegionResults({
              landmarks: sample.keypoints as unknown as PoseLandmarks,
              cameraAngle: sample.cameraAngle,
              methodologyVersion,
            });
            return { sample, regions, error: null as string | null };
          } catch (err) {
            return {
              sample,
              regions: null,
              error:
                err instanceof Error
                  ? err.message
                  : "Could not compute body angles",
            };
          }
        }),
      )
    : samples.map((sample) => ({ sample, regions: null, error: null }));

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm">
        <Link href="/admin/companies" className="underline">
          Companies
        </Link>{" "}
        /{" "}
        <Link
          href={`/admin/companies/${task.workstation.site.companyId}/sites`}
          className="underline"
        >
          {task.workstation.site.company.name}
        </Link>{" "}
        /{" "}
        <Link
          href={`/admin/sites/${task.workstation.siteId}/workstations`}
          className="underline"
        >
          {task.workstation.site.name}
        </Link>{" "}
        /{" "}
        <Link
          href={`/admin/workstations/${task.workstationId}/tasks`}
          className="underline"
        >
          {task.workstation.name}
        </Link>{" "}
        / {task.name}
      </p>
      <h1 className="text-xl font-semibold">Captures: {task.name}</h1>
      <p className="flex gap-3">
        <Link href={`/tasks/${task.id}/capture`} className="underline">
          Capture a new sample
        </Link>
        {/* Plain <a>, not next/link: file download (Content-Disposition:
            attachment), not a client-side page transition — same reasoning
            as the (app) dashboard's task page. */}
        <a href={`/api/tasks/${task.id}/report`} className="underline">
          Download report
        </a>
      </p>

      {methodologyError && (
        <div className="rounded border border-red-400 bg-red-50 p-3 text-red-800 dark:bg-red-950 dark:text-red-200">
          Cannot recompute region breakdowns: {methodologyError}
        </div>
      )}

      {methodologyVersion && (
        <p className="text-xs text-zinc-500">
          Region breakdowns below are recomputed live from each sample's stored
          landmarks against the currently active methodology version (
          {methodologyVersion}) and current formulas — not necessarily identical
          to what was returned/persisted at capture time if scoring rules or
          formulas have changed since (see CLAUDE.md, "Scoring lookup" /
          build-region-results.ts).
        </p>
      )}

      {samples.length === 0 && (
        <p className="text-sm">No captures yet for this task.</p>
      )}

      {rows.map(({ sample, regions, error }) => (
        <div key={sample.id} className="rounded border p-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {sample.capturedAt.toISOString()} — cameraAngle:{" "}
            {sample.cameraAngle} — sample {sample.id}
          </p>

          {error && (
            <p className="mt-2 text-sm text-red-700 dark:text-red-400">
              Error recomputing this sample: {error}
            </p>
          )}

          {regions && (
            <table className="mt-2 w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-1 pr-4">Region</th>
                  <th className="py-1 pr-4">Status</th>
                  <th className="py-1">Detail</th>
                </tr>
              </thead>
              <tbody>
                {ALL_BODY_REGIONS.map((region) => {
                  const result: RegionResult = regions[region];
                  return (
                    <tr key={region} className="border-b last:border-0">
                      <td className="py-1 pr-4">{region}</td>
                      <td className="py-1 pr-4">{result.status}</td>
                      <td className="py-1">{describeRegionResult(result)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}
