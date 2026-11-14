import { PlatformRole } from "@/generated/prisma/enums";
import type { PlatformUserModel } from "@/generated/prisma/models";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS, type Permission, ROLE_PERMISSIONS } from "./permissions";

// P17 §3: company-editable role bundles, with guardrails enforced HERE (in
// code), not in the UI. The system defaults are ROLE_PERMISSIONS; a company may
// override the bundle for the three tenant roles below. Everything in this file
// above the DB helpers is pure and unit-tested — the guardrails never depend on
// a request or a DB.

// Only the three tenant roles are company-editable. The admin roles, the
// occupational physician (health), and the works council (co-determination)
// are NOT: changing those is super-admin territory (§3 guardrail "no bundle can
// grant platform roles or module entitlement").
export const COMPANY_EDITABLE_ROLES: readonly PlatformRole[] = [
  PlatformRole.EHS_SPECIALIST,
  PlatformRole.MANAGER,
  PlatformRole.EMPLOYEE,
];

export function isCompanyEditableRole(role: PlatformRole): boolean {
  return COMPANY_EDITABLE_ROLES.includes(role);
}

const HEALTH: readonly Permission[] = ["health_data.read", "health_data.write"];
const SETTINGS: readonly Permission[] = ["settings.read", "settings.write"];
const APPROVE: readonly Permission[] = ["risk.approve", "legal.approve"];

// The CEILING a company may expand a role's bundle up to — the §3 guardrails as
// a positive allowlist:
//   - health_data.* is NEVER grantable to any editable role (hard ban).
//   - settings.* (catalogue/config authority) stays with the admin roles.
//   - the A column (risk.approve/legal.approve) may be extended to EHS staff
//     (the §2 example: a small site without a separate EHS manager), but NEVER
//     to the leader or employee — approval is an authority function, and their
//     ORG_UNIT/SELF scope must never gain it.
// Scope ("where") is still enforced independently (scope.ts); a permission in
// the ceiling never lets a SELF/ORG_UNIT user reach a site they can't access.
export function grantablePermissions(
  role: PlatformRole,
): ReadonlySet<Permission> {
  const banned = new Set<Permission>([...HEALTH, ...SETTINGS]);
  if (role === PlatformRole.MANAGER || role === PlatformRole.EMPLOYEE) {
    for (const p of APPROVE) banned.add(p);
  }
  return new Set(PERMISSIONS.filter((p) => !banned.has(p)));
}

export class RoleBundleGuardrailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoleBundleGuardrailError";
  }
}

// Validate a proposed bundle against the guardrails. Throws a
// RoleBundleGuardrailError (not a bare Error) so a caller can surface a clean
// message. Returns the de-duplicated, canonical permission list on success.
export function validateRoleBundle(
  role: PlatformRole,
  permissions: readonly string[],
): Permission[] {
  if (!isCompanyEditableRole(role)) {
    throw new RoleBundleGuardrailError(
      `Role ${role} is not company-editable (admin/physician/works-council bundles are super-admin only).`,
    );
  }
  const known = new Set<string>(PERMISSIONS);
  const ceiling = grantablePermissions(role);
  const out = new Set<Permission>();
  for (const raw of permissions) {
    if (!known.has(raw)) {
      throw new RoleBundleGuardrailError(`Unknown permission: ${raw}`);
    }
    const p = raw as Permission;
    if ((HEALTH as readonly string[]).includes(p)) {
      throw new RoleBundleGuardrailError(
        "Health-compartment permissions can never be added to a role bundle (§3).",
      );
    }
    if (!ceiling.has(p)) {
      throw new RoleBundleGuardrailError(
        `Permission ${p} is outside the grantable ceiling for ${role} (§3).`,
      );
    }
    out.add(p);
  }
  return [...out];
}

// Pure: the EFFECTIVE bundle for a role given an optional company override.
// A non-null override REPLACES the default entirely (it was guardrail-checked
// at write time, so it is trusted here); null → the system default.
export function effectiveRoleBundle(
  role: PlatformRole,
  override: readonly string[] | null,
): ReadonlySet<Permission> {
  if (override === null) return ROLE_PERMISSIONS[role] ?? new Set<Permission>();
  return new Set(override as Permission[]);
}

// ---------------------------------------------------------------------------
// DB-backed resolution (below this line everything touches prisma).
// ---------------------------------------------------------------------------

// The override permission list for one (company, role), or null if the company
// has not customized that role (→ system default).
export async function getCompanyRoleBundle(
  companyId: string,
  role: PlatformRole,
): Promise<Permission[] | null> {
  const row = await prisma.companyRoleBundle.findUnique({
    where: { companyId_role: { companyId, role } },
    select: { permissions: true },
  });
  if (!row) return null;
  return row.permissions as Permission[];
}

// All overrides for a company, keyed by role (for the editor + the super-admin
// overview). Roles without a row are absent (→ default).
export async function getCompanyRoleBundles(
  companyId: string,
): Promise<Map<PlatformRole, Permission[]>> {
  const rows = await prisma.companyRoleBundle.findMany({
    where: { companyId },
    select: { role: true, permissions: true },
  });
  return new Map(rows.map((r) => [r.role, r.permissions as Permission[]]));
}

// Override-aware effective permission check for a specific user. Used where a
// company can deliberately EXTEND authority (the approval gates). The broad,
// synchronous hasPermission() still answers module visibility from the system
// default; this is the narrower, DB-aware path for authority decisions.
export async function userCan(
  user: Pick<PlatformUserModel, "role" | "companyId">,
  permission: Permission,
): Promise<boolean> {
  const override = user.companyId
    ? await getCompanyRoleBundle(user.companyId, user.role)
    : null;
  return effectiveRoleBundle(user.role, override).has(permission);
}

// Set (upsert) a company's override for a tenant role. Guardrail-checked, then
// the before/after is written to the append-only audit log (§3 "every bundle
// change writes an AuditEvent"). Returns the canonical stored permissions.
export async function setCompanyRoleBundle(input: {
  companyId: string;
  role: PlatformRole;
  permissions: readonly string[];
  actorUserId: string;
}): Promise<Permission[]> {
  const next = validateRoleBundle(input.role, input.permissions);
  const before = await getCompanyRoleBundle(input.companyId, input.role);

  await prisma.companyRoleBundle.upsert({
    where: {
      companyId_role: { companyId: input.companyId, role: input.role },
    },
    create: {
      companyId: input.companyId,
      role: input.role,
      permissions: next,
      updatedByUserId: input.actorUserId,
    },
    update: { permissions: next, updatedByUserId: input.actorUserId },
  });

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "role_bundle.set",
    entityType: "CompanyRoleBundle",
    entityId: `${input.companyId}:${input.role}`,
    companyId: input.companyId,
    diff: {
      role: input.role,
      before: before ?? [...(ROLE_PERMISSIONS[input.role] ?? [])],
      after: next,
      wasDefault: before === null,
    },
  });
  return next;
}

// Remove a company's override (back to the system default). Audited.
export async function resetCompanyRoleBundle(input: {
  companyId: string;
  role: PlatformRole;
  actorUserId: string;
}): Promise<void> {
  const before = await getCompanyRoleBundle(input.companyId, input.role);
  if (before === null) return; // already default — nothing to do, nothing to log.

  await prisma.companyRoleBundle.delete({
    where: {
      companyId_role: { companyId: input.companyId, role: input.role },
    },
  });
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "role_bundle.reset",
    entityType: "CompanyRoleBundle",
    entityId: `${input.companyId}:${input.role}`,
    companyId: input.companyId,
    diff: {
      role: input.role,
      before,
      after: [...(ROLE_PERMISSIONS[input.role] ?? [])],
      restoredDefault: true,
    },
  });
}
