import Link from "next/link";
import { PostureSampleSimulatorToggle } from "@/components/posture-sample-simulator-toggle";
import { SimulatorCoordinator } from "@/components/simulator-coordinator";
import { BodyRegion } from "@/generated/prisma/enums";
import { requireTaskAccess } from "@/lib/auth/require-access";
import { buildRegionResults } from "@/lib/capture/build-region-results";
import { describeRegionResult } from "@/lib/capture/describe-region-result";
import { describeManualInput } from "@/lib/capture/manual-input";
import type { RegionResult } from "@/lib/capture/types";
import { getDashboardDictionary } from "@/lib/i18n/dictionaries/dashboard";
import { getLocale } from "@/lib/i18n/get-locale";
import type { PoseLandmarks } from "@/lib/pose/angles";
import { prisma } from "@/lib/prisma";
import { getActiveMethodologyVersion } from "@/lib/scoring/methodology-version";

const ALL_BODY_REGIONS = Object.values(BodyRegion);

// A task's assessment history: the AssessmentSessions it was covered by,
// and every raw PostureSample captured for it, each with the full
// per-region breakdown — detailed enough to replace ad-hoc diagnostics
// (same recompute-from-stored-keypoints approach as the internal /admin
// results view, see build-region-results.ts). Never shows anything
// identity-related: PostureSample carries none, by design (ERGO_COMPLIANCE
// _BY_DESIGN.md §3.1/§3.2), and nothing here invents a place to show it.
//
// BodyRegion/CameraAngle/RegionResult-status values and
// describeRegionResult()/describeManualInput()'s generated text are
// deliberately NOT translated — see CLAUDE.md i18n notes: those are
// technical identifiers that are also what the DB/API/PDF report show
// verbatim, so a parallel translated vocabulary would just be confusing.
export default async function TaskHistoryPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const { task } = await requireTaskAccess(taskId);

  const [sessions, samples, manualInputs] = await Promise.all([
    prisma.assessmentSession.findMany({
      where: { tasks: { some: { taskId } } },
      orderBy: { startedAt: "desc" },
    }),
    prisma.postureSample.findMany({
      where: { taskId },
      orderBy: { capturedAt: "desc" },
    }),
    prisma.manualInput.findMany({
      where: { taskId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const locale = await getLocale();
  const dashboardDict = getDashboardDictionary(locale);
  const dict = dashboardDict.taskPage;
  const manualInputLabels = dashboardDict.manualInputLabels;

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
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-12">
      <Breadcrumb
        site={task.workstation.site}
        workstation={task.workstation}
        taskName={task.name}
        sitesLabel={dict.breadcrumbSites}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="font-technical text-xs uppercase tracking-[0.2em] text-border">
            {dict.eyebrow}
          </p>
          <h1 className="font-heading text-2xl font-bold">{task.name}</h1>
          {task.description && (
            <p className="text-sm text-border">{task.description}</p>
          )}
        </div>

        <div className="flex gap-3">
          {/* Plain <a>, not next/link: this is a file download (the route
              responds with Content-Disposition: attachment), not a
              client-side page transition. */}
          <a
            href={`/api/tasks/${task.id}/report`}
            className="rounded-md border border-border px-4 py-2 font-heading font-bold text-foreground transition-colors hover:border-accent hover:text-accent"
          >
            {dict.downloadReport}
          </a>
          <Link
            href={`/tasks/${task.id}/capture`}
            className="rounded-md bg-accent px-4 py-2 font-heading font-bold text-teal transition-opacity hover:opacity-90"
          >
            {dict.captureSample}
          </Link>
        </div>
      </div>

      {sessions.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-lg font-bold">
            {dict.assessmentSessions}
          </h2>
          <ul className="flex flex-col gap-2">
            {sessions.map((session) => (
              <li
                key={session.id}
                className="rounded-lg border border-border bg-surface p-4 text-sm"
              >
                <span className="font-technical">
                  {session.startedAt.toISOString()}
                  {session.endedAt
                    ? ` → ${session.endedAt.toISOString()}`
                    : ` ${dict.ongoing}`}
                </span>
                {session.notes && (
                  <p className="mt-1 text-border">{session.notes}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-bold">
          {dict.manualInputsHeading}
        </h2>
        <p className="text-sm text-border">{dict.manualInputsDescription}</p>

        {manualInputs.length === 0 && (
          <p className="text-sm text-border">{dict.manualInputsEmpty}</p>
        )}

        {manualInputs.length > 0 && (
          <ul className="flex flex-col gap-2">
            {manualInputs.map((entry) => (
              <li
                key={entry.id}
                className="rounded-lg border border-border bg-surface p-4 text-sm"
              >
                <span className="font-heading font-bold">
                  {manualInputLabels[entry.inputType]}
                </span>{" "}
                <span className="font-technical">
                  {describeManualInput(entry)}
                </span>
                {entry.notes && (
                  <p className="mt-1 text-border">{entry.notes}</p>
                )}
                <p className="mt-1 font-technical text-xs text-border">
                  {entry.createdAt.toISOString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-bold">
          {dict.postureSamplesHeading}
        </h2>

        {methodologyError && (
          <div className="rounded-lg border border-accent p-3 text-sm text-accent">
            {dict.cannotRecompute(methodologyError)}
          </div>
        )}

        {samples.length === 0 && (
          <p className="text-sm text-border">{dict.postureSamplesEmpty}</p>
        )}

        <SimulatorCoordinator>
          {rows.map(({ sample, regions, error }) => (
            <div
              key={sample.id}
              className="rounded-lg border border-border bg-surface p-5"
            >
              <p className="font-technical text-xs text-border">
                {sample.capturedAt.toISOString()} — {dict.cameraAngleField}{" "}
                {sample.cameraAngle}
              </p>

              {error && (
                <p className="mt-2 text-sm text-accent">
                  {dict.recomputeError(error)}
                </p>
              )}

              {regions && (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[480px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-border">
                        <th className="py-1 pr-4 font-normal">
                          {dict.tableRegion}
                        </th>
                        <th className="py-1 pr-4 font-normal">
                          {dict.tableStatus}
                        </th>
                        <th className="py-1 font-normal">{dict.tableDetail}</th>
                      </tr>
                    </thead>
                    <tbody className="font-technical">
                      {ALL_BODY_REGIONS.map((region) => {
                        const result: RegionResult = regions[region];
                        return (
                          <tr
                            key={region}
                            className="border-b border-border/40 last:border-0"
                          >
                            <td className="py-1 pr-4">{region}</td>
                            <td className="py-1 pr-4">{result.status}</td>
                            <td className="py-1">
                              {describeRegionResult(result)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {regions && (
                <PostureSampleSimulatorToggle
                  sampleId={sample.id}
                  regionResults={regions}
                />
              )}
            </div>
          ))}
        </SimulatorCoordinator>
      </section>
    </div>
  );
}

function Breadcrumb({
  site,
  workstation,
  taskName,
  sitesLabel,
}: {
  site: { id: string; name: string };
  workstation: { id: string; name: string };
  taskName: string;
  sitesLabel: string;
}) {
  return (
    <p className="text-sm text-border">
      <Link href="/sites" className="hover:text-accent">
        {sitesLabel}
      </Link>{" "}
      /{" "}
      <Link href={`/sites/${site.id}`} className="hover:text-accent">
        {site.name}
      </Link>{" "}
      /{" "}
      <Link
        href={`/workstations/${workstation.id}`}
        className="hover:text-accent"
      >
        {workstation.name}
      </Link>{" "}
      / {taskName}
    </p>
  );
}
