import { PlatformRole } from "@/generated/prisma/enums";
import type { PlatformUserModel } from "@/generated/prisma/models";

// Permission-based access (SLD_RESTRUCTURE_PLAN_platform-modules.md §3.3).
//
// Permissions are CODE CONSTANTS (this file). Role bundles are, per the plan,
// ultimately data-per-company with system defaults — but P1's explicit
// instruction is "migrate existing roles without changing current access", so
// this step introduces the permission VOCABULARY and a derivation layer over
// the four roles that exist today (PlatformRole), reproducing exactly the
// access they already have. The data-backed, per-company customizable role
// bundles (and the five new roles in the §3.3 table — ehs_specialist, manager,
// occupational_physician, works_council, employee) land when those roles are
// actually provisioned (People/Incidents milestones), as their own migration;
// adding them to the PlatformRole enum now would risk changing access for no
// present benefit.
//
// Deliberately NOT `import "server-only"`: hasPermission is a pure function of
// (role, permission) and is unit-tested directly, same reasoning as rbac.ts's
// pure canAccessCompany. Site/company SCOPING stays entirely in rbac.ts
// (canAccessSite/canAccessCompany) — permissions answer "what may this role
// do", scope answers "where". The two compose; neither replaces the other.

// One read + write permission per platform module, plus the health
// sub-compartment pair (ERGO_COMPLIANCE_BY_DESIGN.md §3.18(b) — health reads
// require health_data.read AND an audit event; no existing role is granted it,
// since no health data exists yet and only a future occupational_physician
// role should ever hold it).
export const PERMISSIONS = [
  "cockpit.read",
  "my-tasks.read",
  "risk.read",
  "risk.write",
  "inspections.read",
  "inspections.write",
  "incidents.read",
  "incidents.write",
  "environment.read",
  "environment.write",
  "actions.read",
  "actions.write",
  "chemicals.read",
  "chemicals.write",
  "training.read",
  "training.write",
  "people.read",
  "people.write",
  "legal.read",
  "legal.write",
  "documents.read",
  "documents.write",
  "reports.read",
  "settings.read",
  "settings.write",
  "health_data.read",
  "health_data.write",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

// Every permission EXCEPT the health sub-compartment — the default bundle for
// an administrator who runs everything but is not an occupational physician
// (§3.18(b): health data is withheld from every role by default and granted
// only to the physician role, which does not exist yet).
const ALL_EXCEPT_HEALTH: readonly Permission[] = PERMISSIONS.filter(
  (p) => p !== "health_data.read" && p !== "health_data.write",
);

// System role → permission bundle. Reproduces current access exactly:
//   - super_admin / l3_support operate the whole platform (they are redirected
//     away from the (app) surface to /admin, but at the permission layer they
//     can do everything short of reading the health compartment).
//   - company_admin / site_admin have identical CAPABILITIES today; they
//     differ only in SCOPE (which sites), which canAccessSite enforces — so
//     they share one bundle here. Module routes that don't exist yet (people,
//     training, …) 404 regardless, so granting their permissions now changes
//     no present behaviour; it just means no second migration is needed to
//     turn them on for admins once those modules are built.
export const ROLE_PERMISSIONS: Readonly<
  Record<PlatformRole, ReadonlySet<Permission>>
> = {
  [PlatformRole.SUPER_ADMIN]: new Set(ALL_EXCEPT_HEALTH),
  [PlatformRole.L3_SUPPORT]: new Set(ALL_EXCEPT_HEALTH),
  [PlatformRole.COMPANY_ADMIN]: new Set(ALL_EXCEPT_HEALTH),
  [PlatformRole.SITE_ADMIN]: new Set(ALL_EXCEPT_HEALTH),
  // P7d §B.2 bundles (what each may DO; scope answers where). No role here
  // holds health_data.* (P10) or, except admins, settings.*.
  [PlatformRole.EHS_SPECIALIST]: new Set<Permission>([
    "cockpit.read",
    "my-tasks.read",
    "risk.read",
    "risk.write",
    "inspections.read",
    "inspections.write",
    "incidents.read",
    "environment.read",
    "environment.write",
    "actions.read",
    "actions.write",
    "chemicals.read",
    "chemicals.write",
    "training.read",
    "training.write",
    "people.read",
    "people.write",
    "legal.read",
    "documents.read",
    "documents.write",
    "reports.read",
  ]),
  [PlatformRole.MANAGER]: new Set<Permission>([
    "cockpit.read",
    "my-tasks.read",
    "risk.read",
    "actions.read",
    "actions.write",
    "training.read",
    "training.write",
    "people.read",
    "documents.read",
    "reports.read",
  ]),
  [PlatformRole.EMPLOYEE]: new Set<Permission>([
    "my-tasks.read",
    "training.read",
  ]),
};

// Pure permission check. A role not present in ROLE_PERMISSIONS (e.g. a
// hand-edited DB row with an unknown value) is denied, fail-closed — same
// posture as rbac.ts's unrecognizedRole.
export function hasPermission(
  user: Pick<PlatformUserModel, "role">,
  permission: Permission,
): boolean {
  const bundle = ROLE_PERMISSIONS[user.role];
  if (!bundle) {
    console.error(
      `Unrecognized platform role, denying permission: ${String(user.role)}`,
    );
    return false;
  }
  return bundle.has(permission);
}
