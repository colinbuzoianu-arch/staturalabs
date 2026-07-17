import "server-only";

import { notFound, redirect } from "next/navigation";
import type { PlatformUserModel } from "@/generated/prisma/models";
import { prisma } from "@/lib/prisma";
import { getCurrentPlatformUser } from "./current-user";
import { canAccessSite } from "./rbac";

// Base gate for the read-only company_admin/site_admin dashboard: any signed
// -in platform user may proceed past here, resource-level scoping happens
// in the functions below via canAccessSite.
export async function requireAuthenticatedUser(): Promise<PlatformUserModel> {
  const user = await getCurrentPlatformUser();
  if (!user) redirect("/login");
  return user;
}

// 404s (never redirects) on a missing or inaccessible resource, so a
// company_admin probing another company's siteId by hand can't distinguish
// "doesn't exist" from "exists but you can't see it" — same reasoning as
// requireSuperAdmin not confirming /admin's existence to the wrong role.
export async function requireSiteAccess(siteId: string) {
  const user = await requireAuthenticatedUser();
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: { company: true },
  });
  if (!site) notFound();
  if (!(await canAccessSite(user, siteId))) notFound();
  return { user, site };
}

export async function requireWorkstationAccess(workstationId: string) {
  const user = await requireAuthenticatedUser();
  const workstation = await prisma.workstation.findUnique({
    where: { id: workstationId },
    include: { site: { include: { company: true } } },
  });
  if (!workstation) notFound();
  if (!(await canAccessSite(user, workstation.siteId))) notFound();
  return { user, workstation };
}

export async function requireTaskAccess(taskId: string) {
  const user = await requireAuthenticatedUser();
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      workstation: { include: { site: { include: { company: true } } } },
    },
  });
  if (!task) notFound();
  if (!(await canAccessSite(user, task.workstation.siteId))) notFound();
  return { user, task };
}
