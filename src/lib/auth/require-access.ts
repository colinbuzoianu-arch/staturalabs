import "server-only";

import { notFound, redirect } from "next/navigation";
import { PlatformRole } from "@/generated/prisma/enums";
import type { PlatformUserModel } from "@/generated/prisma/models";
import { getModuleDefinition, type ModuleKey } from "@/lib/modules/registry";
import { prisma } from "@/lib/prisma";
import { userCan } from "./company-role-bundle";
import { getCurrentPlatformUser } from "./current-user";
import type { Permission } from "./permissions";
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

// Write-surface equivalent of requireWorkstationAccess, used by the
// workstation assessment hub ((app)/workstations/[workstationId]) and its
// Server Actions (SLD_IMPLEMENTATION_PLAN_hazards-and-environment.md §3.3 —
// the workstation page became the primary Evaluierung entry point, which
// writes). Gated behind requireAdministrationAccess first (super_admin/
// l3_support are sent to /admin), then the same canAccessSite scoping as the
// read-only workstation view — "company_admin; site_admin within assigned
// sites", exactly what canAccessSite already grants, no new permission
// model.
export async function requireWorkstationAdministrationAccess(
  workstationId: string,
) {
  await requireAdministrationAccess();
  const result = await requireWorkstationAccess(workstationId);
  // P17 §2 (slice 8): the hub and its Server Actions WRITE an Evaluierung, so
  // risk.write is required here — a leader holds risk.read only ("R approved
  // assessments of own units' workstations") and must not be able to start or
  // edit one by opening the hub URL directly.
  await requirePermissionOrNotFound(result.user, "risk.write");
  return result;
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

// ---------------------------------------------------------------------------
// P17 §2 module gates (slice 8). Found while verifying the permission matrix:
// every module page gated on canAccessSite ALONE, so a role with site access
// but no module permission (the leader on environment/legal/settings, say)
// could open the page by typing its URL — the sidebar hid the link, nothing
// refused the request. Before P7b/P10c every role had every permission, so it
// never mattered; the narrow roles made it a real hole.
//
// These two are used from a per-module `layout.tsx`, so every page and every
// nested route under a module inherits the guard rather than each page having
// to remember it. Permission resolution goes through `userCan` (override-aware,
// §3 company-editable bundles), never the raw system default.
export async function requireModuleAccess(
  moduleKey: ModuleKey,
  siteId: string,
) {
  const { user, site } = await requireSiteAccess(siteId);
  const permission = getModuleDefinition(moduleKey).permission;
  // 404, not a redirect — same reasoning as requireSiteAccess: never confirm
  // to the wrong role that the resource exists.
  if (!(await userCan(user, permission))) notFound();
  return { user, site };
}

// The write-permission counterpart, for a surface that mutates. Pass the
// explicit permission because a module's write permission is not always
// "<module>.write" (approvals are risk.approve / legal.approve).
export async function requirePermissionOrNotFound(
  user: PlatformUserModel,
  permission: Permission,
): Promise<void> {
  if (!(await userCan(user, permission))) notFound();
}
