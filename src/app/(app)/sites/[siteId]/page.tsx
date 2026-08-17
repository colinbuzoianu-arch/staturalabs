import Link from "next/link";
import type { ReactNode } from "react";
import { PresentModeNav } from "@/components/present-mode-nav";
import type { RiskBand } from "@/generated/prisma/enums";
import { BodyRegion, PlatformRole } from "@/generated/prisma/enums";
import { requireSiteAccess } from "@/lib/auth/require-access";
import { buildRegionResultsForSample } from "@/lib/capture/build-region-results";
import { getDashboardDictionary } from "@/lib/i18n/dictionaries/dashboard";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";
import { resolveSgdCountryPack } from "@/lib/report/sgd-availability";
import { riskBandRank, worstRiskBand } from "@/lib/risk/band-severity";
import { getActiveMethodologyVersion } from "@/lib/scoring/methodology-version";
import { getFloorPlanSignedUrl } from "@/lib/storage/floor-plan";
import { SiteMapClient } from "./map/site-map-client";

const ALL_BODY_REGIONS = Object.values(BodyRegion);

type TaskErgonomics = {
  overallBand: RiskBand | null;
  concerningRegions: Array<{ region: BodyRegion; band: RiskBand }>;
};

// SLD_IMPLEMENTATION_PLAN_austria-first.md §7 B6: "Promote the floor plan
// ... make it the site page's default view." The floor map (previously a
// separate, buried /sites/[siteId]/map route) is now this page's primary
// content when the site has at least one FloorPlan; the plain workstation
// grid this page always showed stays underneath — still the only way to
// reach a workstation that has no placed pin, and the whole page's content
// when there is no floor plan at all (same empty-state behavior the old
// /map route had).
export default async function SiteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<{ planId?: string | string[]; present?: string }>;
}) {
  const { siteId } = await params;
  const resolvedSearchParams = await searchParams;
  const rawPlanId = resolvedSearchParams.planId;
  const requestedPlanId = typeof rawPlanId === "string" ? rawPlanId : undefined;
  const presentMode = resolvedSearchParams.present === "1";

  const { user, site } = await requireSiteAccess(siteId);
  const locale = await getLocale();
  const dashboardDict = getDashboardDictionary(locale);
  const dict = dashboardDict.siteDetailPage;
  const mapDict = dashboardDict.siteMapPage;
  const hazardCategoryLabels = dashboardDict.hazardCategoryLabels;

  const hasAdministrationAccess =
    user.role === PlatformRole.COMPANY_ADMIN ||
    user.role === PlatformRole.SITE_ADMIN;

  const [workstations, floorPlans] = await Promise.all([
    prisma.workstation.findMany({
      where: { siteId },
      orderBy: { name: "asc" },
    }),
    prisma.floorPlan.findMany({
      where: { siteId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Present mode's "next" target (§7 B6's fixed sequence starts here): the
  // workstation with the worst latest-approved band, so a live walkthrough
  // opens on the thing most worth showing rather than an arbitrary one.
  // Falls back to the first workstation in the plain list below when there
  // is no floor plan/pin data to rank by — still a real next step, just
  // not risk-ranked.
  let nextWorkstationId: string | null = workstations[0]?.id ?? null;

  let mapContent: ReactNode = null;
  if (floorPlans.length === 0) {
    mapContent = hasAdministrationAccess ? (
      <Link
        href={`/administration/sites/${siteId}/floor-plans`}
        className="text-sm text-accent hover:underline"
      >
        {mapDict.manageFloorPlansLink}
      </Link>
    ) : null;
  } else {
    const selectedFloorPlan =
      floorPlans.find((plan) => plan.id === requestedPlanId) ?? floorPlans[0];

    const [imageUrl, workstationPlanPositions, taskPlanPositions] =
      await Promise.all([
        getFloorPlanSignedUrl(selectedFloorPlan.storagePath),
        prisma.workstationPlanPosition.findMany({
          where: { floorPlanId: selectedFloorPlan.id },
        }),
        prisma.taskPlanPosition.findMany({
          where: { floorPlanId: selectedFloorPlan.id },
          include: {
            task: {
              select: {
                id: true,
                name: true,
                workstationId: true,
                workstation: { select: { id: true, name: true } },
              },
            },
          },
        }),
      ]);

    const relevantWorkstationIds = [
      ...new Set([
        ...workstationPlanPositions.map((p) => p.workstationId),
        ...taskPlanPositions.map((p) => p.task.workstationId),
      ]),
    ];

    const [mapWorkstations, openActions] = await Promise.all([
      prisma.workstation.findMany({
        where: { id: { in: relevantWorkstationIds } },
        include: {
          tasks: {
            select: {
              id: true,
              postureSamples: { orderBy: { capturedAt: "desc" }, take: 1 },
            },
          },
          riskAssessments: {
            where: { status: "APPROVED" },
            orderBy: { assessedAt: "desc" },
            take: 1,
            include: {
              findings: {
                select: {
                  riskBand: true,
                  hazard: { select: { category: true } },
                },
              },
            },
          },
        },
      }),
      prisma.action.findMany({
        where: {
          status: { in: ["OPEN", "IN_PROGRESS"] },
          OR: [
            {
              riskFinding: {
                riskAssessment: {
                  workstationId: { in: relevantWorkstationIds },
                },
              },
            },
            {
              assessmentSession: {
                workstationId: { in: relevantWorkstationIds },
              },
            },
          ],
        },
        select: {
          riskFinding: {
            select: { riskAssessment: { select: { workstationId: true } } },
          },
          assessmentSession: { select: { workstationId: true } },
        },
      }),
    ]);

    let methodologyVersion: string | null;
    try {
      methodologyVersion = await getActiveMethodologyVersion();
    } catch {
      methodologyVersion = null;
    }

    const allTasks = mapWorkstations.flatMap(
      (workstation) => workstation.tasks,
    );
    const taskErgonomicsEntries = await Promise.all(
      allTasks.map(async (task): Promise<[string, TaskErgonomics]> => {
        const sample = task.postureSamples[0];
        if (!sample || !methodologyVersion) {
          return [task.id, { overallBand: null, concerningRegions: [] }];
        }
        try {
          const { regions } = await buildRegionResultsForSample(
            sample,
            methodologyVersion,
          );
          const scoredBands: RiskBand[] = [];
          const concerningRegions: Array<{
            region: BodyRegion;
            band: RiskBand;
          }> = [];
          for (const region of ALL_BODY_REGIONS) {
            const result = regions[region];
            if (result.status === "scored") {
              scoredBands.push(result.riskBand);
              if (
                result.riskBand === "ELEVATED" ||
                result.riskBand === "HIGH"
              ) {
                concerningRegions.push({ region, band: result.riskBand });
              }
            }
          }
          return [
            task.id,
            { overallBand: worstRiskBand(scoredBands), concerningRegions },
          ];
        } catch {
          return [task.id, { overallBand: null, concerningRegions: [] }];
        }
      }),
    );
    const taskErgonomicsById = new Map<string, TaskErgonomics>(
      taskErgonomicsEntries,
    );

    const openActionsCountByWorkstation = new Map<string, number>();
    for (const action of openActions) {
      const workstationId =
        action.riskFinding?.riskAssessment.workstationId ??
        action.assessmentSession?.workstationId ??
        null;
      if (!workstationId) continue;
      openActionsCountByWorkstation.set(
        workstationId,
        (openActionsCountByWorkstation.get(workstationId) ?? 0) + 1,
      );
    }

    const placedTaskIds = new Set(taskPlanPositions.map((p) => p.taskId));

    const taskPins = taskPlanPositions.map((position) => {
      const ergonomics = taskErgonomicsById.get(position.taskId) ?? {
        overallBand: null,
        concerningRegions: [],
      };
      return {
        taskId: position.taskId,
        taskName: position.task.name,
        workstationId: position.task.workstationId,
        workstationName: position.task.workstation.name,
        x: position.x,
        y: position.y,
        overallBand: ergonomics.overallBand,
        concerningRegions: ergonomics.concerningRegions,
      };
    });

    const workstationPositionByWorkstationId = new Map(
      workstationPlanPositions.map((p) => [p.workstationId, p]),
    );

    const workstationPins = mapWorkstations.flatMap((workstation) => {
      const position = workstationPositionByWorkstationId.get(workstation.id);
      if (!position) return [];

      const totalTaskCount = workstation.tasks.length;
      const placedTaskCount = workstation.tasks.filter((t) =>
        placedTaskIds.has(t.id),
      ).length;
      const unplacedBands = workstation.tasks
        .filter((t) => !placedTaskIds.has(t.id))
        .map((t) => taskErgonomicsById.get(t.id)?.overallBand ?? null)
        .filter((band): band is RiskBand => band !== null);

      const latestApproved = workstation.riskAssessments[0] ?? null;

      return [
        {
          workstationId: workstation.id,
          workstationName: workstation.name,
          x: position.x,
          y: position.y,
          totalTaskCount,
          placedTaskCount,
          unplacedErgonomicBand: worstRiskBand(unplacedBands),
          hasApprovedAssessment: latestApproved !== null,
          findings: latestApproved
            ? latestApproved.findings.map((f) => ({
                category: f.hazard.category,
                band: f.riskBand,
              }))
            : [],
          openActionsCount:
            openActionsCountByWorkstation.get(workstation.id) ?? 0,
        },
      ];
    });

    if (mapWorkstations.length > 0) {
      nextWorkstationId = mapWorkstations.reduce((worst, ws) => {
        const worstBand = worstRiskBand(
          (worst.riskAssessments[0]?.findings ?? []).map((f) => f.riskBand),
        );
        const wsBand = worstRiskBand(
          (ws.riskAssessments[0]?.findings ?? []).map((f) => f.riskBand),
        );
        if (wsBand === null) return worst;
        if (worstBand === null) return ws;
        return riskBandRank(wsBand) > riskBandRank(worstBand) ? ws : worst;
      }, mapWorkstations[0]).id;
    }

    mapContent = (
      <div className="flex flex-col gap-4">
        {floorPlans.length > 1 && (
          <nav className="flex flex-wrap gap-2 border-b border-border pb-4 text-sm">
            {floorPlans.map((plan) => (
              <Link
                key={plan.id}
                href={`/sites/${siteId}?planId=${plan.id}`}
                className={`rounded border px-3 py-1 transition-colors ${
                  plan.id === selectedFloorPlan.id
                    ? "border-accent bg-accent text-background"
                    : "border-border hover:border-accent"
                }`}
              >
                {plan.name}
              </Link>
            ))}
          </nav>
        )}
        {hasAdministrationAccess && (
          <Link
            href={`/administration/sites/${siteId}/floor-plans`}
            className="self-start text-sm text-accent hover:underline"
          >
            {mapDict.manageFloorPlansLink}
          </Link>
        )}
        <SiteMapClient
          floorPlanName={selectedFloorPlan.name}
          imageUrl={imageUrl}
          imageWidth={selectedFloorPlan.width}
          imageHeight={selectedFloorPlan.height}
          taskPins={taskPins}
          workstationPins={workstationPins}
          dict={mapDict}
          hazardCategoryLabels={hazardCategoryLabels}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-12">
      <Breadcrumb site={site} sitesLabel={dict.breadcrumbSites} />

      <div className="flex flex-col gap-1">
        <p className="font-technical text-xs uppercase tracking-[0.2em] text-border">
          {dict.eyebrow}
        </p>
        <h1 className="font-heading text-2xl font-bold">{site.name}</h1>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <Link
            href={`/sites/${site.id}/risk-overview`}
            className="text-sm text-accent hover:underline"
          >
            {dict.riskOverviewLink}
          </Link>
          {/* Plain <a>, not next/link: a real file download, same reasoning
              as the task/risk-assessment report links. */}
          <a
            href={`/api/sites/${site.id}/worker-briefing`}
            className="text-sm text-accent hover:underline"
          >
            {dict.workerBriefingLink}
          </a>
          {/* SGD: only rendered when the site's country has a verified
              pack with a real template (currently AT only) — the link
              itself doesn't offer a country that would 400
              (SLD_IMPLEMENTATION_PLAN_austria-first.md §7 B5). */}
          {resolveSgdCountryPack(site.country) && (
            <a
              href={`/api/sites/${site.id}/sgd`}
              className="text-sm text-accent hover:underline"
            >
              {dict.sgdLink}
            </a>
          )}
          {!presentMode && (
            <Link
              href={`/sites/${site.id}?present=1`}
              className="text-sm text-accent hover:underline"
            >
              {dict.presentModeLink}
            </Link>
          )}
        </div>
      </div>

      {presentMode && (
        <PresentModeNav
          prevHref={null}
          nextHref={
            nextWorkstationId
              ? `/workstations/${nextWorkstationId}/risk?present=1`
              : null
          }
          prevLabel=""
          nextLabel={dashboardDict.presentMode.workstationRiskLabel}
        />
      )}

      {mapContent}

      {workstations.length === 0 ? (
        <p className="text-sm text-border">{dict.empty}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workstations.map((workstation) => (
            <Link
              key={workstation.id}
              href={`/workstations/${workstation.id}`}
              className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-5 transition-colors hover:border-accent"
            >
              <span className="font-heading text-lg font-bold">
                {workstation.name}
              </span>
              {workstation.location && (
                <span className="text-sm text-border">
                  {workstation.location}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Breadcrumb({
  site,
  sitesLabel,
}: {
  site: { name: string };
  sitesLabel: string;
}) {
  return (
    <p className="text-sm text-border">
      <Link href="/sites" className="hover:text-accent">
        {sitesLabel}
      </Link>{" "}
      / {site.name}
    </p>
  );
}
