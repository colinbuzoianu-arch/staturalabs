import { describe, expect, it } from "vitest";
import { PlatformRole } from "@/generated/prisma/enums";
import {
  hasPermission,
  PERMISSIONS,
  type Permission,
  permissionsForRoles,
  ROLE_PERMISSIONS,
} from "./permissions";

describe("permissions", () => {
  it("defines a bundle for every PlatformRole", () => {
    for (const role of Object.values(PlatformRole)) {
      expect(ROLE_PERMISSIONS[role]).toBeInstanceOf(Set);
    }
  });

  const ADMIN_ROLES = [
    PlatformRole.SUPER_ADMIN,
    PlatformRole.L3_SUPPORT,
    PlatformRole.COMPANY_ADMIN,
    PlatformRole.SITE_ADMIN,
  ];

  it("grants the four admin roles every non-health permission (unchanged)", () => {
    for (const role of ADMIN_ROLES) {
      expect(hasPermission({ role }, "risk.read")).toBe(true);
      expect(hasPermission({ role }, "settings.write")).toBe(true);
    }
  });

  it("grants the health sub-compartment ONLY to the occupational physician (§3.18(b), P10c)", () => {
    for (const role of Object.values(PlatformRole)) {
      const expected = role === PlatformRole.OCCUPATIONAL_PHYSICIAN;
      expect(hasPermission({ role }, "health_data.read")).toBe(expected);
      expect(hasPermission({ role }, "health_data.write")).toBe(expected);
    }
  });

  it("gives the three P7d roles their scoped bundles (no settings, no health)", () => {
    // ehs_specialist: broad EHS write, but not settings.
    expect(
      hasPermission({ role: PlatformRole.EHS_SPECIALIST }, "training.write"),
    ).toBe(true);
    expect(
      hasPermission({ role: PlatformRole.EHS_SPECIALIST }, "people.write"),
    ).toBe(true);
    expect(
      hasPermission({ role: PlatformRole.EHS_SPECIALIST }, "settings.write"),
    ).toBe(false);
    // manager: read assessments, run training, not edit assessments or settings.
    expect(
      hasPermission({ role: PlatformRole.MANAGER }, "training.write"),
    ).toBe(true);
    expect(hasPermission({ role: PlatformRole.MANAGER }, "risk.read")).toBe(
      true,
    );
    expect(hasPermission({ role: PlatformRole.MANAGER }, "risk.write")).toBe(
      false,
    );
    expect(
      hasPermission({ role: PlatformRole.MANAGER }, "settings.write"),
    ).toBe(false);
    // employee (P17 §2, scope = SELF): own training/my-tasks, reports events,
    // own actions, own person record, documents published to them — but never
    // the site-wide EHS modules (risk/chemicals/settings), which the SCOPE
    // layer (canAccessSite false for a SELF user) would block regardless.
    expect(
      hasPermission({ role: PlatformRole.EMPLOYEE }, "training.read"),
    ).toBe(true);
    expect(
      hasPermission({ role: PlatformRole.EMPLOYEE }, "my-tasks.read"),
    ).toBe(true);
    expect(
      hasPermission({ role: PlatformRole.EMPLOYEE }, "incidents.write"),
    ).toBe(true);
    expect(hasPermission({ role: PlatformRole.EMPLOYEE }, "people.read")).toBe(
      true,
    );
    expect(hasPermission({ role: PlatformRole.EMPLOYEE }, "risk.read")).toBe(
      false,
    );
    expect(
      hasPermission({ role: PlatformRole.EMPLOYEE }, "chemicals.read"),
    ).toBe(false);
    expect(
      hasPermission({ role: PlatformRole.EMPLOYEE }, "settings.read"),
    ).toBe(false);
  });

  it("gives the two P10c roles their bundles (physician = health only, works council = read-only, no health)", () => {
    // Occupational physician: health + incidents.read, but no risk/people write.
    expect(
      hasPermission(
        { role: PlatformRole.OCCUPATIONAL_PHYSICIAN },
        "health_data.write",
      ),
    ).toBe(true);
    expect(
      hasPermission(
        { role: PlatformRole.OCCUPATIONAL_PHYSICIAN },
        "incidents.read",
      ),
    ).toBe(true);
    expect(
      hasPermission(
        { role: PlatformRole.OCCUPATIONAL_PHYSICIAN },
        "risk.write",
      ),
    ).toBe(false);
    // Works council: read-only co-determination, no health, no write.
    expect(
      hasPermission({ role: PlatformRole.WORKS_COUNCIL }, "incidents.read"),
    ).toBe(true);
    expect(
      hasPermission({ role: PlatformRole.WORKS_COUNCIL }, "health_data.read"),
    ).toBe(false);
    expect(
      hasPermission({ role: PlatformRole.WORKS_COUNCIL }, "incidents.write"),
    ).toBe(false);
    // EHS specialist now records events (P10c grant).
    expect(
      hasPermission({ role: PlatformRole.EHS_SPECIALIST }, "incidents.write"),
    ).toBe(true);
  });

  it("denies an unrecognized role fail-closed", () => {
    expect(
      hasPermission({ role: "NONSENSE" as PlatformRole }, "risk.read"),
    ).toBe(false);
  });

  it("every non-health permission is granted by the admin bundle", () => {
    const companyAdmin = ROLE_PERMISSIONS[PlatformRole.COMPANY_ADMIN];
    for (const p of PERMISSIONS) {
      if (p === "health_data.read" || p === "health_data.write") {
        expect(companyAdmin.has(p)).toBe(false);
      } else {
        expect(companyAdmin.has(p)).toBe(true);
      }
    }
  });

  // P17 §2 — the full default permission matrix, encoded EXACTLY. Every role's
  // bundle is pinned to the precise permission set §2 prescribes, so a future
  // edit that silently widens or narrows a role is a failing test, not a quiet
  // access change. (Scope — which sites/units — is answered separately by
  // scope.ts/rbac.ts; this asserts only "what".)
  const ALL_EXCEPT_HEALTH_LIST: Permission[] = PERMISSIONS.filter(
    (p) => p !== "health_data.read" && p !== "health_data.write",
  );

  const EXPECTED_MATRIX: Record<PlatformRole, Permission[]> = {
    [PlatformRole.SUPER_ADMIN]: ALL_EXCEPT_HEALTH_LIST,
    [PlatformRole.L3_SUPPORT]: ALL_EXCEPT_HEALTH_LIST,
    [PlatformRole.COMPANY_ADMIN]: ALL_EXCEPT_HEALTH_LIST,
    [PlatformRole.SITE_ADMIN]: ALL_EXCEPT_HEALTH_LIST,
    [PlatformRole.EHS_SPECIALIST]: [
      "cockpit.read",
      "my-tasks.read",
      "calendar.read",
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
    ],
    [PlatformRole.MANAGER]: [
      "cockpit.read",
      "my-tasks.read",
      "calendar.read",
      "risk.read",
      "inspections.read",
      "incidents.read",
      "incidents.write",
      "actions.read",
      "actions.write",
      "chemicals.read",
      "training.read",
      "training.write",
      "people.read",
      "documents.read",
      "reports.read",
    ],
    [PlatformRole.EMPLOYEE]: [
      "my-tasks.read",
      "calendar.read",
      "training.read",
      "incidents.read",
      "incidents.write",
      "actions.read",
      "actions.write",
      "documents.read",
      "people.read",
    ],
    [PlatformRole.OCCUPATIONAL_PHYSICIAN]: [
      "cockpit.read",
      "my-tasks.read",
      "calendar.read",
      "incidents.read",
      "health_data.read",
      "health_data.write",
    ],
    [PlatformRole.WORKS_COUNCIL]: [
      "cockpit.read",
      "calendar.read",
      "risk.read",
      "incidents.read",
      "reports.read",
    ],
  };

  it.each(Object.values(PlatformRole))(
    "role %s holds exactly its §2 default bundle",
    (role) => {
      const expected = [...EXPECTED_MATRIX[role]].sort();
      const actual = [...ROLE_PERMISSIONS[role]].sort();
      expect(actual).toStrictEqual(expected);
    },
  );

  // module × role × in/out, read-side, driven straight off the matrix: for
  // every platform module, a role either holds `${module}.read` or it doesn't,
  // and that must match §2 exactly (health handled by its own test above).
  const MODULES = [
    "cockpit",
    "my-tasks",
    "calendar",
    "risk",
    "inspections",
    "incidents",
    "environment",
    "actions",
    "chemicals",
    "training",
    "people",
    "legal",
    "documents",
    "reports",
    "settings",
  ] as const;

  it.each(Object.values(PlatformRole))(
    "module read-access for %s matches the §2 matrix",
    (role) => {
      const granted = new Set(EXPECTED_MATRIX[role]);
      for (const m of MODULES) {
        const perm = `${m}.read` as Permission;
        expect(hasPermission({ role }, perm)).toBe(granted.has(perm));
      }
    },
  );

  // P17 §2 overlapping roles: a user who holds several RoleAssignments (one
  // role each) has the UNION of the bundles. Scope stays per-assignment.
  it("unions permissions across overlapping roles", () => {
    const union = permissionsForRoles([
      PlatformRole.MANAGER,
      PlatformRole.EHS_SPECIALIST,
    ]);
    // MANAGER lacks risk.write; EHS_SPECIALIST has it → union has it.
    expect(union.has("risk.write")).toBe(true);
    // EHS_SPECIALIST has environment.write; MANAGER lacks it → union has it.
    expect(union.has("environment.write")).toBe(true);
    // Neither holds settings.* or health → union must not either.
    expect(union.has("settings.write")).toBe(false);
    expect(union.has("health_data.read")).toBe(false);
    // The union equals the strict superset bundle (EHS ⊇ MANAGER here).
    const ehs = ROLE_PERMISSIONS[PlatformRole.EHS_SPECIALIST];
    expect([...union].sort()).toStrictEqual([...ehs].sort());
  });

  it("a union including an admin role grants every non-health permission", () => {
    const union = permissionsForRoles([
      PlatformRole.EMPLOYEE,
      PlatformRole.COMPANY_ADMIN,
    ]);
    for (const p of ALL_EXCEPT_HEALTH_LIST) expect(union.has(p)).toBe(true);
    expect(union.has("health_data.read")).toBe(false);
  });

  it("an empty / unknown role union contributes nothing (fail-closed)", () => {
    expect(permissionsForRoles([]).size).toBe(0);
    expect(permissionsForRoles(["NONSENSE" as PlatformRole]).size).toBe(0);
  });
});
