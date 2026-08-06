import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";
import { getFloorPlanSignedUrl } from "@/lib/storage/floor-plan";
import { FloorPlanPlacementClient } from "./floor-plan-placement-client";

export default async function FloorPlanPlacementPage({
  params,
}: {
  params: Promise<{ siteId: string; floorPlanId: string }>;
}) {
  const { siteId, floorPlanId } = await params;
  await requireSiteAdministrationAccess(siteId);

  const floorPlan = await prisma.floorPlan.findUnique({
    where: { id: floorPlanId },
  });
  if (!floorPlan || floorPlan.siteId !== siteId) notFound();

  const [imageUrl, workstations, workstationPositions, taskPositions] =
    await Promise.all([
      getFloorPlanSignedUrl(floorPlan.storagePath),
      prisma.workstation.findMany({
        where: { siteId },
        include: { tasks: { orderBy: { name: "asc" } } },
        orderBy: { name: "asc" },
      }),
      prisma.workstationPlanPosition.findMany({ where: { floorPlanId } }),
      prisma.taskPlanPosition.findMany({ where: { floorPlanId } }),
    ]);

  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).floorPlanPlacementPage;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-border">
          <Link
            href={`/administration/sites/${siteId}/floor-plans`}
            className="hover:text-accent"
          >
            {dict.breadcrumbFloorPlans}
          </Link>{" "}
          / {floorPlan.name}
        </p>
        <p className="font-technical text-xs uppercase tracking-[0.2em] text-border">
          {dict.eyebrow}
        </p>
        <h1 className="font-heading text-2xl font-bold">{floorPlan.name}</h1>
      </div>

      <FloorPlanPlacementClient
        floorPlanId={floorPlan.id}
        floorPlanName={floorPlan.name}
        imageUrl={imageUrl}
        imageWidth={floorPlan.width}
        imageHeight={floorPlan.height}
        workstations={workstations.map((workstation) => ({
          id: workstation.id,
          name: workstation.name,
          tasks: workstation.tasks.map((task) => ({
            id: task.id,
            name: task.name,
          })),
        }))}
        initialWorkstationPositions={workstationPositions.map((position) => ({
          workstationId: position.workstationId,
          x: position.x,
          y: position.y,
        }))}
        initialTaskPositions={taskPositions.map((position) => ({
          taskId: position.taskId,
          x: position.x,
          y: position.y,
        }))}
        dict={dict}
      />
    </div>
  );
}
