import "server-only";

import { notFound, redirect } from "next/navigation";
import { PlatformRole } from "@/generated/prisma/enums";
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

// Gate for (app)/administration — the tenant-facing write surface (see
// CLAUDE.md), distinct from /admin's requireSuperAdmin. super_admin/
// l3_support don't use this surface at all (they get everything via
// /admin already); redirect them there rather than showing an empty or
// broken write UI. Resource-level scoping (which site a given
// company_admin/site_admin may actually write to) still happens per-page
// via canAccessSite, same as the read-only dashboard.
export async function requireAdministrationAccess(): Promise<PlatformUserModel> {
  const user = await requireAuthenticatedUser();
  if (
    user.role === PlatformRole.SUPER_ADMIN ||
    user.role === PlatformRole.L3_SUPPORT
  ) {
    redirect("/admin");
  }
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

// Same site-level scoping as requireSiteAccess, but gated behind
// requireAdministrationAccess first — the write-surface equivalent, used
// by every page under (app)/administration/sites/[siteId]/**. Master-data
// write permission is exactly "company_admin; site_admin within assigned
// sites" (CLAUDE.md), which is exactly what canAccessSite already grants —
// no separate write-permission model needed on top of the read one.
export async function requireSiteAdministrationAccess(siteId: string) {
  await requireAdministrationAccess();
  return requireSiteAccess(siteId);
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
