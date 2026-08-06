import Link from "next/link";
import type { RiskBand } from "@/generated/prisma/enums";
import { BodyRegion, PlatformRole } from "@/generated/prisma/enums";
import { requireSiteAccess } from "@/lib/auth/require-access";
import { buildRegionResults } from "@/lib/capture/build-region-results";
import { getDashboardDictionary } from "@/lib/i18n/dictionaries/dashboard";
import { getLocale } from "@/lib/i18n/get-locale";
import type { PoseLandmarks } from "@/lib/pose/angles";
import { prisma } from "@/lib/prisma";
import { worstRiskBand } from "@/lib/risk/band-severity";
import { getActiveMethodologyVersion } from "@/lib/scoring/methodology-version";
import { getFloorPlanSignedUrl } from "@/lib/storage/floor-plan";
import { SiteMapClient } from "./site-map-client";

const ALL_BODY_REGIONS = Object.values(BodyRegion);

type TaskErgonomics = {
  overallBand: RiskBand | null;
  concerningRegions: Array<{ region: BodyRegion; band: RiskBand }>;
};

export default async function SiteMapPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<{ planId?: string | string[] }>;
}) {
  const { siteId } = await params;
  const rawPlanId = (await searchParams).planId;
  const requestedPlanId = typeof rawPlanId === "string" ? rawPlanId : undefined;

  const { user, site } = await requireSiteAccess(siteId);
  const locale = await getLocale();
  const dict = getDashboardDictionary(locale).siteMapPage;
  const hazardCategoryLabels =
    getDashboardDictionary(locale).hazardCategoryLabels;

  // Same role check (app)/layout.tsx uses for showAdministrationLink — a
  // site_admin/company_admin who already passed requireSiteAccess above
  // necessarily has write access to this same site too (canAccessSite is
  // the one check both requireSiteAccess and requireSiteAdministrationAccess
  // share), so the only extra condition is the role gate.
  const hasAdministrationAccess =
    user.role === PlatformRole.COMPANY_ADMIN ||
    user.role === PlatformRole.SITE_ADMIN;

  const floorPlans = await prisma.floorPlan.findMany({
    where: { siteId },
    orderBy: { createdAt: "desc" },
  });

  if (floorPlans.length === 0) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-12">
        <Breadcrumb siteName={site.name} siteId={site.id} dict={dict} />
        <div className="flex flex-col gap-1">
          <p className="font-technical text-xs uppercase tracking-[0.2em] text-border">
            {dict.eyebrow}
          </p>
          <h1 className="font-heading text-2xl font-bold">{dict.heading}</h1>
        </div>
        <p className="text-sm text-border">{dict.empty}</p>
        {hasAdministrationAccess && (
          <Link
            href={`/administration/sites/${siteId}/floor-plans`}
            className="text-sm text-accent hover:underline"
          >
            {dict.manageFloorPlansLink}
          </Link>
        )}
      </div>
    );
  }

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

  const [workstations, openActions] = await Promise.all([
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
              riskAssessment: { workstationId: { in: relevantWorkstationIds } },
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

  // Per-task ergonomic band, computed for EVERY task under every relevant
  // workstation — not just the individually-placed ones. The mixed-case
  // workstation marker (see below) needs the same computation for a
  // workstation's *unplaced* tasks, so this is shared rather than
  // duplicated per rendering tier.
  const allTasks = workstations.flatMap((workstation) => workstation.tasks);
  const taskErgonomicsEntries = await Promise.all(
    allTasks.map(async (task): Promise<[string, TaskErgonomics]> => {
      const sample = task.postureSamples[0];
      if (!sample || !methodologyVersion) {
        return [task.id, { overallBand: null, concerningRegions: [] }];
      }
      try {
        const regions = await buildRegionResults({
          landmarks: sample.keypoints as unknown as PoseLandmarks,
          cameraAngle: sample.cameraAngle,
          methodologyVersion,
        });
        const scoredBands: RiskBand[] = [];
        const concerningRegions: Array<{ region: BodyRegion; band: RiskBand }> =
          [];
        for (const region of ALL_BODY_REGIONS) {
          const result = regions[region];
          if (result.status === "scored") {
            scoredBands.push(result.riskBand);
            if (result.riskBand === "ELEVATED" || result.riskBand === "HIGH") {
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

  const workstationPins = workstations.flatMap((workstation) => {
    // No coordinates to plot a workstation-level marker at all if the
    // admin never placed one on this plan — pins are opt-in, this is not
    // an error condition.
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

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-12">
      <Breadcrumb siteName={site.name} siteId={site.id} dict={dict} />

      <div className="flex flex-col gap-1">
        <p className="font-technical text-xs uppercase tracking-[0.2em] text-border">
          {dict.eyebrow}
        </p>
        <h1 className="font-heading text-2xl font-bold">{dict.heading}</h1>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <Link
            href={`/sites/${site.id}`}
            className="text-sm text-border hover:text-accent"
          >
            {dict.backToSite}
          </Link>
          {hasAdministrationAccess && (
            <Link
              href={`/administration/sites/${siteId}/floor-plans`}
              className="text-sm text-accent hover:underline"
            >
              {dict.manageFloorPlansLink}
            </Link>
          )}
        </div>
      </div>

      {floorPlans.length > 1 && (
        <nav className="flex flex-wrap gap-2 border-b border-border pb-4 text-sm">
          {floorPlans.map((plan) => (
            <Link
              key={plan.id}
              href={`/sites/${siteId}/map?planId=${plan.id}`}
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

      <SiteMapClient
        floorPlanName={selectedFloorPlan.name}
        imageUrl={imageUrl}
        imageWidth={selectedFloorPlan.width}
        imageHeight={selectedFloorPlan.height}
        taskPins={taskPins}
        workstationPins={workstationPins}
        dict={dict}
        hazardCategoryLabels={hazardCategoryLabels}
      />
    </div>
  );
}

function Breadcrumb({
  siteName,
  siteId,
  dict,
}: {
  siteName: string;
  siteId: string;
  dict: { breadcrumbSites: string; heading: string };
}) {
  return (
    <p className="text-sm text-border">
      <Link href="/sites" className="hover:text-accent">
        {dict.breadcrumbSites}
      </Link>{" "}
      /{" "}
      <Link href={`/sites/${siteId}`} className="hover:text-accent">
        {siteName}
      </Link>{" "}
      / {dict.heading}
    </p>
  );
}
