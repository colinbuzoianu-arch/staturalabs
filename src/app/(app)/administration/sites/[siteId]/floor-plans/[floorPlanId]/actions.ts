"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import { prisma } from "@/lib/prisma";

// Invoked directly from the placement UI's click handlers (not via a
// <form action>), so signatures take plain positional args rather than
// FormData — the values already exist as numbers/strings in client state.
function assertNormalizedPosition(x: number, y: number) {
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    x < 0 ||
    x > 1 ||
    y < 0 ||
    y > 1
  ) {
    throw new Error("Position must be normalized between 0 and 1");
  }
}

async function requireFloorPlanSite(floorPlanId: string) {
  const floorPlan = await prisma.floorPlan.findUnique({
    where: { id: floorPlanId },
    select: { siteId: true },
  });
  if (!floorPlan) notFound();
  await requireSiteAdministrationAccess(floorPlan.siteId);
  return floorPlan.siteId;
}

function revalidateFloorPlanPage(siteId: string, floorPlanId: string) {
  revalidatePath(`/administration/sites/${siteId}/floor-plans/${floorPlanId}`);
}

export async function placeWorkstation(
  floorPlanId: string,
  workstationId: string,
  x: number,
  y: number,
) {
  const siteId = await requireFloorPlanSite(floorPlanId);

  const workstation = await prisma.workstation.findUnique({
    where: { id: workstationId },
    select: { siteId: true },
  });
  if (!workstation || workstation.siteId !== siteId) notFound();

  assertNormalizedPosition(x, y);

  await prisma.workstationPlanPosition.upsert({
    where: { floorPlanId_workstationId: { floorPlanId, workstationId } },
    update: { x, y },
    create: { floorPlanId, workstationId, x, y },
  });

  revalidateFloorPlanPage(siteId, floorPlanId);
}

export async function removeWorkstationPosition(
  floorPlanId: string,
  workstationId: string,
) {
  const siteId = await requireFloorPlanSite(floorPlanId);

  await prisma.workstationPlanPosition.deleteMany({
    where: { floorPlanId, workstationId },
  });

  revalidateFloorPlanPage(siteId, floorPlanId);
}

export async function placeTask(
  floorPlanId: string,
  taskId: string,
  x: number,
  y: number,
) {
  const siteId = await requireFloorPlanSite(floorPlanId);

  // Same site-scoping discipline as everywhere else: a task from another
  // site must not be placeable on this plan just because its id was known.
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { workstation: { select: { siteId: true } } },
  });
  if (!task || task.workstation.siteId !== siteId) notFound();

  assertNormalizedPosition(x, y);

  await prisma.taskPlanPosition.upsert({
    where: { floorPlanId_taskId: { floorPlanId, taskId } },
    update: { x, y },
    create: { floorPlanId, taskId, x, y },
  });

  revalidateFloorPlanPage(siteId, floorPlanId);
}

export async function removeTaskPosition(floorPlanId: string, taskId: string) {
  const siteId = await requireFloorPlanSite(floorPlanId);

  await prisma.taskPlanPosition.deleteMany({ where: { floorPlanId, taskId } });

  revalidateFloorPlanPage(siteId, floorPlanId);
}
