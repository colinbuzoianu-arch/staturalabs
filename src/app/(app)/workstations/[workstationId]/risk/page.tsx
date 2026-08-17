import Link from "next/link";
import { PresentModeNav } from "@/components/present-mode-nav";
import { BodyRegion } from "@/generated/prisma/enums";
import { requireWorkstationAccess } from "@/lib/auth/require-access";
import { buildRegionResultsForSample } from "@/lib/capture/build-region-results";
import { getDashboardDictionary } from "@/lib/i18n/dictionaries/dashboard";
import { getLocale } from "@/lib/i18n/get-locale";
import { isPresentMode } from "@/lib/present-mode";
import { prisma } from "@/lib/prisma";
import { resolveSgdCountryPack } from "@/lib/report/sgd-availability";
import { worstRiskBand } from "@/lib/risk/band-severity";
import { exposureThresholdStatus } from "@/lib/risk/exposure-threshold-status";
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
  searchParams,
}: {
  params: Promise<{ workstationId: string }>;
  searchParams: Promise<{ present?: string; step?: string; from?: string }>;
}) {
  const { workstationId } = await params;
  const { present, step, from } = await searchParams;
  const presentMode = isPresentMode(present);
  // "verify" marks this as the sequence's second visit to this same
  // route — reached from the action detail page, framed as "verification
  // history" (§7 B6's 5th stop) rather than the first, default visit
  // reached from the site map. Same page, different position in the
  // fixed sequence, so its present-mode next target differs (see below).
  const isVerifyStep = step === "verify";
  const { workstation } = await requireWorkstationAccess(workstationId);
  const locale = await getLocale();
  const dashboardDict = getDashboardDictionary(locale);
  const dict = dashboardDict.workstationRiskPage;
  const hazardCategoryLabels = dashboardDict.hazardCategoryLabels;
  const actionStatusLabels = dashboardDict.actionStatusLabels;
  const verificationOutcomeLabels = dashboardDict.verificationOutcomeLabels;

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

  // §7 B6 "make the verification loop legible": the action(s) that were
  // verified against one of these assessments — i.e. what CAUSED the band
  // to move between the "before" and "after" rows below. A small,
  // targeted query (not a new data path — it reads the pre-existing
  // Action.verificationAssessmentId FK), scoped to this page rather than
  // reused elsewhere, since only this trend view needs the causal link
  // named between two specific assessments.
  const verifyingActions = await prisma.action.findMany({
    where: {
      verificationAssessmentId: { in: allAssessments.map((a) => a.id) },
    },
    select: {
      id: true,
      title: true,
      verificationOutcome: true,
      verificationAssessmentId: true,
    },
  });
  const verifyingActionByAssessmentId = new Map(
    verifyingActions
      .filter((a): a is typeof a & { verificationAssessmentId: string } =>
        Boolean(a.verificationAssessmentId),
      )
      .map((a) => [a.verificationAssessmentId, a]),
  );

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
        const { regions } = await buildRegionResultsForSample(
          sample,
          methodologyVersion,
        );
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

  // §7 B6 present-mode sequence: prev retraces where this page's own
  // "next" links came from (site map by default, action detail when
  // revisited as "verification history"); next depends on which visit
  // this is — the default visit goes to the latest approved assessment
  // (threading the first qualifying open action's id forward, so the
  // assessment-detail page can link to it without a new query of its
  // own), the "verify" revisit goes to the SGD instead of looping back.
  const currentHref = `/workstations/${workstationId}/risk?present=1${isVerifyStep ? "&step=verify" : ""}`;
  const presentPrevHref =
    from ?? (isVerifyStep ? null : `/sites/${workstation.siteId}?present=1`);
  const presentNextHref = isVerifyStep
    ? resolveSgdCountryPack(workstation.site.country)
      ? `/api/workstations/${workstation.id}/sgd`
      : null
    : latestApproved
      ? `/administration/risk-assessments/${latestApproved.id}?present=1&workstationId=${workstation.id}${actions[0] ? `&actionId=${actions[0].id}` : ""}&from=${encodeURIComponent(currentHref)}`
      : null;

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
        {/* Per-workstation SGD scope (SLD_IMPLEMENTATION_PLAN_austria-
            first.md §7 B5) — only rendered when the site's country has a
            verified pack with a real template, same gate as the site-wide
            link on the site page. */}
        {resolveSgdCountryPack(workstation.site.country) && (
          <a
            href={`/api/workstations/${workstation.id}/sgd`}
            className="text-sm text-accent hover:underline"
          >
            {dict.sgdLink}
          </a>
        )}
      </div>

      {presentMode && (
        <PresentModeNav
          prevHref={presentPrevHref}
          nextHref={presentNextHref}
          prevLabel={
            isVerifyStep
              ? dashboardDict.presentMode.actionLabel
              : dashboardDict.presentMode.siteMapLabel
          }
          nextLabel={
            isVerifyStep
              ? dashboardDict.presentMode.sgdLabel
              : dashboardDict.presentMode.assessmentLabel
          }
        />
      )}

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
                  const statuses = finding.measurements.map((m) =>
                    exposureThresholdStatus(m),
                  );
                  const overLimitCount = statuses.filter(
                    (s) => s === "over-limit-value",
                  ).length;
                  const overActionCount = statuses.filter(
                    (s) => s === "over-action-value",
                  ).length;
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
                              .map((m) => {
                                const parts = [`${m.value} ${m.unit}`];
                                if (m.actionValue !== null) {
                                  parts.push(
                                    `action ${m.actionValue} ${m.unit}`,
                                  );
                                }
                                if (m.limitValue !== null) {
                                  parts.push(`limit ${m.limitValue} ${m.unit}`);
                                }
                                return parts.join(", ");
                              })
                              .join(" · ")}
                            {overLimitCount > 0 &&
                              ` — ${overLimitCount} ${dict.overLimit}`}
                            {overActionCount > 0 &&
                              ` — ${overActionCount} ${dict.overActionValue}`}
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
          // §7 B6 "make the verification loop legible": a vertical
          // before → after timeline rather than a plain table, so the
          // action that moved the band between two assessments is named
          // in the connector between them — not just implied by two
          // adjacent rows a reader has to correlate themselves.
          <ol className="flex flex-col">
            {allAssessments.map((assessment, index) => {
              const verifyingAction = verifyingActionByAssessmentId.get(
                assessment.id,
              );
              return (
                <li key={assessment.id} className="flex flex-col">
                  {index > 0 && (
                    <div className="flex items-center gap-2 py-1 pl-2 text-xs text-border">
                      <span aria-hidden="true">↓</span>
                      {verifyingAction ? (
                        <Link
                          href={`/administration/actions/${verifyingAction.id}`}
                          className="text-accent underline hover:no-underline"
                        >
                          {dict.verifiedByPrefix} {verifyingAction.title}
                          {verifyingAction.verificationOutcome &&
                            ` (${verificationOutcomeLabels[verifyingAction.verificationOutcome]})`}
                        </Link>
                      ) : null}
                    </div>
                  )}
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border py-2">
                    <span className="text-border">
                      {assessment.assessedAt.toISOString()}
                    </span>
                    <span className="text-border">{assessment.status}</span>
                    <span className="font-semibold">
                      {worstRiskBand(
                        assessment.findings.map((f) => f.riskBand),
                      ) ?? ""}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
