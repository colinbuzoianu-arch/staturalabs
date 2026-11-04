import "server-only";

import type {
  PlatformUserModel,
  RoleAssignmentModel,
} from "@/generated/prisma/models";
import { prisma } from "@/lib/prisma";

// P7d §B (SLD_P7B_DEFERRALS_RESOLVED.md): the one place that resolves a user's
// effective SCOPE from their RoleAssignment rows — used for the three new
// roles (ehs_specialist / manager / employee). The four legacy roles keep
// their original logic in rbac.ts unchanged (the equivalence test proves it);
// this module only adds the new-role resolution + the org-unit descendant
// walk the manager view (A) and the employee self-scope need.

export async function activeRoleAssignments(
  userId: string,
): Promise<RoleAssignmentModel[]> {
  return prisma.roleAssignment.findMany({
    where: { platformUserId: userId, revokedAt: null },
  });
}

// Site access for a user via their RoleAssignment rows:
// - COMPANY scope → any site of the user's company.
// - SITE scope → that exact site.
// - ORG_UNIT scope → the scoped org unit's own site (org units carry siteId).
// - SELF → no site browsing.
export async function canAccessSiteByAssignments(
  user: PlatformUserModel,
  siteId: string,
): Promise<boolean> {
  const assignments = await activeRoleAssignments(user.id);
  if (assignments.length === 0) return false;

  if (assignments.some((a) => a.scopeType === "SITE" && a.scopeId === siteId)) {
    return true;
  }

  if (assignments.some((a) => a.scopeType === "COMPANY")) {
    if (!user.companyId) return false;
    const site = await prisma.site.findUnique({
      where: { id: siteId },
      select: { companyId: true },
    });
    if (site?.companyId === user.companyId) return true;
  }

  const orgUnitScopeIds = assignments
    .filter((a) => a.scopeType === "ORG_UNIT" && a.scopeId)
    .map((a) => a.scopeId as string);
  if (orgUnitScopeIds.length > 0) {
    const orgUnits = await prisma.orgUnit.findMany({
      where: { id: { in: orgUnitScopeIds } },
      select: { siteId: true },
    });
    if (orgUnits.some((o) => o.siteId === siteId)) return true;
  }

  return false;
}

// The org-unit ids a user is scoped to, expanded to include descendants
// (ORG_UNIT scope inherits down the tree, §A.2). Returns null when the user
// has company-wide scope (meaning "all org units" — no filter needed). Used by
// the manager instruction-matrix view.
export async function accessibleOrgUnitIds(
  user: PlatformUserModel,
): Promise<Set<string> | null> {
  const assignments = await activeRoleAssignments(user.id);
  if (assignments.some((a) => a.scopeType === "COMPANY")) return null;

  const roots = assignments
    .filter((a) => a.scopeType === "ORG_UNIT" && a.scopeId)
    .map((a) => a.scopeId as string);
  if (roots.length === 0) return new Set();

  // Expand to descendants: load all org units for the roots' site(s) and walk
  // parentId. Small trees; one query.
  const rootRows = await prisma.orgUnit.findMany({
    where: { id: { in: roots } },
    select: { siteId: true },
  });
  const siteIds = [...new Set(rootRows.map((r) => r.siteId))];
  const all = await prisma.orgUnit.findMany({
    where: { siteId: { in: siteIds } },
    select: { id: true, parentId: true },
  });
  const childrenByParent = new Map<string, string[]>();
  for (const ou of all) {
    if (!ou.parentId) continue;
    const list = childrenByParent.get(ou.parentId) ?? [];
    list.push(ou.id);
    childrenByParent.set(ou.parentId, list);
  }
  const result = new Set<string>();
  const stack = [...roots];
  while (stack.length > 0) {
    const id = stack.pop() as string;
    if (result.has(id)) continue;
    result.add(id);
    for (const child of childrenByParent.get(id) ?? []) stack.push(child);
  }
  return result;
}

// The Person a self-scoped (employee) user is linked to, if any (§B.2).
export async function selfPersonId(
  user: PlatformUserModel,
): Promise<string | null> {
  const person = await prisma.person.findFirst({
    where: { platformUserId: user.id },
    select: { id: true },
  });
  return person?.id ?? null;
}
