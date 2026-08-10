import Link from "next/link";
import { BodyRegion } from "@/generated/prisma/enums";
import { requireWorkstationAccess } from "@/lib/auth/require-access";
import { buildRegionResults } from "@/lib/capture/build-region-results";
import { getDashboardDictionary } from "@/lib/i18n/dictionaries/dashboard";
import { getLocale } from "@/lib/i18n/get-locale";
import type { PoseLandmarks } from "@/lib/pose/angles";
import { prisma } from "@/lib/prisma";
import { worstRiskBand } from "@/lib/risk/band-severity";
import { getActiveMethodologyVersion } from "@/lib/scoring/methodology-version";

const ALL_BODY_REGIONS = Object.values(BodyRegion);

// The workstation combined view (SLD_IMPLEMENTATION_PLAN_demo-loop.md M6,
// demo step 6): "what is the risk here" in one place — the latest approved
// risk assessment's findings (any HazardCategory, not just ergonomic),
// ergonomic scores reusing buildRegionResults() rather than re-deriving
// scoring logic, open actions, and the risk-band trend across assessments.
// Read-only, same access model as every other page in this tree
// (requireWorkstationAccess) — this is an analysis view, not the write
// surface at (app)/administration.
export default async function WorkstationRiskPage({
  params,
}: {
  params: Promise<{ workstationId: string }>;
}) {
  const { workstationId } = await params;
  const { workstation } = await requireWorkstationAccess(workstationId);
  const locale = await getLocale();
  const dict = getDashboardDictionary(locale).workstationRiskPage;
  const hazardCategoryLabels =
    getDashboardDictionary(locale).hazardCategoryLabels;
  const actionStatusLabels = getDashboardDictionary(locale).actionStatusLabels;

  const [latestApproved, allAssessments, tasks, actions] = await Promise.all([
    prisma.riskAssessment.findFirst({
      where: { workstationId, status: "APPROVED" },
      orderBy: { assessedAt: "desc" },
      include: {
        findings: { include: { hazard: true, measurements: true } },
      },
    }),
    prisma.riskAssessment.findMany({
      where: { workstationId },
      include: { findings: { select: { riskBand: true } } },
      orderBy: { assessedAt: "asc" },
    }),
    prisma.task.findMany({
      where: { workstationId },
      orderBy: { name: "asc" },
      include: {
        postureSamples: { orderBy: { capturedAt: "desc" }, take: 1 },
      },
    }),
    prisma.action.findMany({
      where: {
        status: { notIn: ["VERIFIED", "CANCELLED"] },
        OR: [
          { riskFinding: { riskAssessment: { workstationId } } },
          { assessmentSession: { workstationId } },
        ],
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  let methodologyVersion: string | null = null;
  try {
    methodologyVersion = await getActiveMethodologyVersion();
  } catch {
    methodologyVersion = null;
  }

  const taskRows = await Promise.all(
    tasks.map(async (task) => {
      const sample = task.postureSamples[0];
      if (!sample || !methodologyVersion) {
        return { task, sample: null, concerningCount: null as number | null };
      }
      try {
        const { regions } = await buildRegionResults({
          keypoints: sample.keypoints as unknown as PoseLandmarks,
          validatedKeypoints:
            sample.validatedKeypoints as unknown as PoseLandmarks | null,
          validationStatus: sample.validationStatus,
          cameraAngle: sample.cameraAngle,
          methodologyVersion,
        });
        const concerningCount = ALL_BODY_REGIONS.filter((region) => {
          const result = regions[region];
          return (
            result.status === "scored" &&
            (result.riskBand === "ELEVATED" || result.riskBand === "HIGH")
          );
        }).length;
        return { task, sample, concerningCount };
      } catch {
        return { task, sample, concerningCount: null as number | null };
      }
    }),
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-12">
      <p className="text-sm text-border">
        <Link href="/sites" className="hover:text-accent">
          {dict.breadcrumbSites}
        </Link>{" "}
        /{" "}
        <Link
          href={`/sites/${workstation.siteId}`}
          className="hover:text-accent"
        >
          {workstation.site.name}
        </Link>{" "}
        /{" "}
        <Link
          href={`/workstations/${workstation.id}`}
          className="hover:text-accent"
        >
          {workstation.name}
        </Link>{" "}
        / {dict.breadcrumbLabel}
      </p>

      <div className="flex flex-col gap-1">
        <p className="font-technical text-xs uppercase tracking-[0.2em] text-border">
          {dict.eyebrow}
        </p>
        <h1 className="font-heading text-2xl font-bold">{workstation.name}</h1>
        <Link
          href={`/workstations/${workstation.id}`}
          className="text-sm text-border hover:text-accent"
        >
          {dict.backToWorkstation}
        </Link>
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-heading text-lg font-bold">
            {dict.latestAssessmentHeading}
          </h2>
          {latestApproved && (
            <Link
              href={`/administration/risk-assessments/${latestApproved.id}`}
              className="text-sm underline hover:text-accent"
            >
              {dict.viewLink}
            </Link>
          )}
        </div>

        {!latestApproved ? (
          <p className="text-sm text-border">{dict.noApprovedAssessment}</p>
        ) : (
          <>
            <p className="text-sm text-border">
              {dict.assessedAtLabel} {latestApproved.assessedAt.toISOString()}
            </p>

            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-1 pr-4">{dict.colCategory}</th>
                  <th className="py-1 pr-4">{dict.colHazard}</th>
                  <th className="py-1 pr-4">{dict.colBand}</th>
                  <th className="py-1 pr-4">{dict.colScore}</th>
                  <th className="py-1">{dict.colControls}</th>
                </tr>
              </thead>
              <tbody>
                {latestApproved.findings.map((finding) => {
                  const overLimitMeasurements = finding.measurements.filter(
                    (m) => m.limitValue !== null && m.value > m.limitValue,
                  );
                  return (
                    <tr
                      key={finding.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="py-1 pr-4">
                        {hazardCategoryLabels[finding.hazard.category]}
                      </td>
                      <td className="py-1 pr-4">{finding.hazard.name}</td>
                      <td className="py-1 pr-4">{finding.riskBand}</td>
                      <td className="py-1 pr-4">{finding.riskScore}</td>
                      <td className="py-1">
                        {finding.existingControls ?? ""}
                        {finding.measurements.length > 0 && (
                          <p className="text-xs text-border">
                            {dict.measurementsLabel}{" "}
                            {finding.measurements
                              .map(
                                (m) =>
                                  `${m.value} ${m.unit}${m.limitValue !== null ? ` (${m.limitValue} ${m.unit})` : ""}`,
                              )
                              .join(", ")}
                            {overLimitMeasurements.length > 0 &&
                              ` — ${overLimitMeasurements.length} ${dict.overLimit}`}
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-bold">
          {dict.ergonomicHeading}
        </h2>
        <p className="text-sm text-border">{dict.ergonomicDescription}</p>

        {taskRows.length === 0 ? (
          <p className="text-sm text-border">{dict.ergonomicEmpty}</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="py-1 pr-4">{dict.colTask}</th>
                <th className="py-1 pr-4">{dict.colCapturedAt}</th>
                <th className="py-1">{dict.colBand}</th>
              </tr>
            </thead>
            <tbody>
              {taskRows.map(({ task, sample, concerningCount }) => (
                <tr
                  key={task.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="py-1 pr-4">
                    <Link
                      href={`/tasks/${task.id}`}
                      className="underline hover:text-accent"
                    >
                      {task.name}
                    </Link>
                  </td>
                  <td className="py-1 pr-4">
                    {sample ? sample.capturedAt.toISOString() : dict.noSamples}
                  </td>
                  <td className="py-1">
                    {concerningCount !== null
                      ? concerningCount > 0
                        ? dict.concerningRegions(concerningCount)
                        : dict.noConcerningRegions
                      : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-bold">
          {dict.openActionsHeading}
        </h2>
        {actions.length === 0 ? (
          <p className="text-sm text-border">{dict.openActionsEmpty}</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="py-1 pr-4">{dict.colTitle}</th>
                <th className="py-1 pr-4">{dict.colStatus}</th>
                <th className="py-1">{dict.colDue}</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((action) => (
                <tr
                  key={action.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="py-1 pr-4">
                    <Link
                      href={`/administration/actions/${action.id}`}
                      className="underline hover:text-accent"
                    >
                      {action.title}
                    </Link>
                  </td>
                  <td className="py-1 pr-4">
                    {actionStatusLabels[action.status]}
                  </td>
                  <td className="py-1">
                    {action.dueDate
                      ? action.dueDate.toISOString().slice(0, 10)
                      : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-bold">
          {dict.bandTrendHeading}
        </h2>
        {allAssessments.length === 0 ? (
          <p className="text-sm text-border">{dict.bandTrendEmpty}</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="py-1 pr-4">{dict.colAssessedAt}</th>
                <th className="py-1 pr-4">{dict.colStatus}</th>
                <th className="py-1">{dict.colOverallBand}</th>
              </tr>
            </thead>
            <tbody>
              {allAssessments.map((assessment) => (
                <tr
                  key={assessment.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="py-1 pr-4">
                    {assessment.assessedAt.toISOString()}
                  </td>
                  <td className="py-1 pr-4">{assessment.status}</td>
                  <td className="py-1">
                    {worstRiskBand(
                      assessment.findings.map((f) => f.riskBand),
                    ) ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
