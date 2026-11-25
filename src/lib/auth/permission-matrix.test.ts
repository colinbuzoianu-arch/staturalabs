import { describe, expect, it } from "vitest";
import { PlatformRole } from "@/generated/prisma/enums";
import { MODULE_REGISTRY, type ModuleKey } from "@/lib/modules/registry";
import { hasPermission, PERMISSIONS, type Permission } from "./permissions";

// P17 §2 (SLD_P17_TENANT_ROLES_APPROVED.md) permission matrix, slice 8's
// "permission matrix test fully green".
//
// Slice 1 tested the bundles themselves. This test closes the loop the other
// way round: it is driven by the MODULE REGISTRY, so it asserts, for every
// module that actually exists and every tenant role, whether that role can
// open the module at all — which is exactly what the per-module layout guard
// (requireModuleAccess) now enforces at runtime. A module added to the
// registry without a line here fails the coverage test at the bottom, so the
// matrix cannot silently fall behind the product.
//
// "true" here means "may open the module's pages". What they may DO inside is
// the write/approve permissions, asserted separately below.

type Expectation = Partial<Record<PlatformRole, boolean>>;

// Per module: which of the five tenant roles (+ the two P10 special roles)
// may open it, straight off the §2 table.
const MODULE_ACCESS: Record<ModuleKey, Expectation> = {
  // Cockpit: admins/EHS/leader read it; the employee's start page is Meine
  // Aufgaben ("— (start page = Meine Aufgaben)").
  COCKPIT: {
    COMPANY_ADMIN: true,
    SITE_ADMIN: true,
    EHS_SPECIALIST: true,
    MANAGER: true,
    EMPLOYEE: false,
    OCCUPATIONAL_PHYSICIAN: true,
    WORKS_COUNCIL: true,
  },
  // "Meine Aufgaben / Aktivitätenkalender": every role has their own items.
  MY_TASKS: {
    COMPANY_ADMIN: true,
    SITE_ADMIN: true,
    EHS_SPECIALIST: true,
    MANAGER: true,
    EMPLOYEE: true,
    OCCUPATIONAL_PHYSICIAN: true,
    WORKS_COUNCIL: false,
  },
  CALENDAR: {
    COMPANY_ADMIN: true,
    SITE_ADMIN: true,
    EHS_SPECIALIST: true,
    MANAGER: true,
    EMPLOYEE: true,
    OCCUPATIONAL_PHYSICIAN: true,
    WORKS_COUNCIL: true,
  },
  // Gefährdungsbeurteilung: leader reads approved assessments of their units'
  // workstations; the employee has no risk surface at all.
  RISK: {
    COMPANY_ADMIN: true,
    SITE_ADMIN: true,
    EHS_SPECIALIST: true,
    MANAGER: true,
    EMPLOYEE: false,
    OCCUPATIONAL_PHYSICIAN: false,
    WORKS_COUNCIL: true,
  },
  // Umwelt: admins + EHS only ("—" for leader and employee).
  ENVIRONMENT: {
    COMPANY_ADMIN: true,
    SITE_ADMIN: true,
    EHS_SPECIALIST: true,
    MANAGER: false,
    EMPLOYEE: false,
    OCCUPATIONAL_PHYSICIAN: false,
    WORKS_COUNCIL: false,
  },
  ACTIONS: {
    COMPANY_ADMIN: true,
    SITE_ADMIN: true,
    EHS_SPECIALIST: true,
    MANAGER: true,
    EMPLOYEE: true,
    OCCUPATIONAL_PHYSICIAN: false,
    WORKS_COUNCIL: false,
  },
  INSPECTIONS: {
    COMPANY_ADMIN: true,
    SITE_ADMIN: true,
    EHS_SPECIALIST: true,
    MANAGER: true,
    EMPLOYEE: false,
    OCCUPATIONAL_PHYSICIAN: false,
    WORKS_COUNCIL: false,
  },
  INCIDENTS: {
    COMPANY_ADMIN: true,
    SITE_ADMIN: true,
    EHS_SPECIALIST: true,
    MANAGER: true,
    EMPLOYEE: true,
    OCCUPATIONAL_PHYSICIAN: true,
    WORKS_COUNCIL: true,
  },
  CHEMICALS: {
    COMPANY_ADMIN: true,
    SITE_ADMIN: true,
    EHS_SPECIALIST: true,
    MANAGER: true,
    EMPLOYEE: false,
    OCCUPATIONAL_PHYSICIAN: false,
    WORKS_COUNCIL: false,
  },
  TRAINING: {
    COMPANY_ADMIN: true,
    SITE_ADMIN: true,
    EHS_SPECIALIST: true,
    MANAGER: true,
    EMPLOYEE: true,
    OCCUPATIONAL_PHYSICIAN: false,
    WORKS_COUNCIL: false,
  },
  PEOPLE: {
    COMPANY_ADMIN: true,
    SITE_ADMIN: true,
    EHS_SPECIALIST: true,
    MANAGER: true,
    EMPLOYEE: true,
    OCCUPATIONAL_PHYSICIAN: false,
    WORKS_COUNCIL: false,
  },
  // Sicherheitsinformationen: EVERY tenant role may open the module — being
  // reachable by a safety message is not a privilege. Who may SEND is the
  // write permission below, and within which audience is audience-scope.ts.
  BROADCASTS: {
    COMPANY_ADMIN: true,
    SITE_ADMIN: true,
    EHS_SPECIALIST: true,
    MANAGER: true,
    EMPLOYEE: true,
    OCCUPATIONAL_PHYSICIAN: true,
    WORKS_COUNCIL: true,
  },
  // Rechtskataster: admins (E, A) + EHS (evaluate). "—" for leader/employee.
  LEGAL: {
    COMPANY_ADMIN: true,
    SITE_ADMIN: true,
    EHS_SPECIALIST: true,
    MANAGER: false,
    EMPLOYEE: false,
    OCCUPATIONAL_PHYSICIAN: false,
    WORKS_COUNCIL: false,
  },
  DOCUMENTS: {
    COMPANY_ADMIN: true,
    SITE_ADMIN: true,
    EHS_SPECIALIST: true,
    MANAGER: true,
    EMPLOYEE: true,
    OCCUPATIONAL_PHYSICIAN: false,
    WORKS_COUNCIL: false,
  },
  REPORTS: {
    COMPANY_ADMIN: true,
    SITE_ADMIN: true,
    EHS_SPECIALIST: true,
    MANAGER: true,
    EMPLOYEE: false,
    OCCUPATIONAL_PHYSICIAN: false,
    WORKS_COUNCIL: true,
  },
  // Stammdaten / users & roles / catalogues — admins only.
  SETTINGS: {
    COMPANY_ADMIN: true,
    SITE_ADMIN: true,
    EHS_SPECIALIST: false,
    MANAGER: false,
    EMPLOYEE: false,
    OCCUPATIONAL_PHYSICIAN: false,
    WORKS_COUNCIL: false,
  },
};

const TENANT_ROLES: PlatformRole[] = [
  PlatformRole.COMPANY_ADMIN,
  PlatformRole.SITE_ADMIN,
  PlatformRole.EHS_SPECIALIST,
  PlatformRole.MANAGER,
  PlatformRole.EMPLOYEE,
  PlatformRole.OCCUPATIONAL_PHYSICIAN,
  PlatformRole.WORKS_COUNCIL,
];

describe("P17 §2 module access matrix (registry-driven)", () => {
  for (const module of MODULE_REGISTRY) {
    const expectation = MODULE_ACCESS[module.key];
    describe(module.key, () => {
      for (const role of TENANT_ROLES) {
        const expected = expectation[role];
        it(`${role} ${expected ? "may" : "may not"} open ${module.key}`, () => {
          expect(hasPermission({ role }, module.permission)).toBe(expected);
        });
      }
    });
  }

  it("covers every module in the registry", () => {
    for (const module of MODULE_REGISTRY) {
      expect(
        MODULE_ACCESS[module.key],
        `no §2 expectation for module ${module.key}`,
      ).toBeDefined();
      for (const role of TENANT_ROLES) {
        expect(
          MODULE_ACCESS[module.key][role],
          `no §2 expectation for ${module.key} × ${role}`,
        ).toBeTypeOf("boolean");
      }
    }
  });
});

// The write/approve half of the §2 table — the distinctions the module guard
// alone cannot make (a leader READS risk, never writes it).
describe("P17 §2 write and approve authority (system defaults)", () => {
  const cases: [PlatformRole, Permission, boolean][] = [
    // Approval default is the site admin's; EHS staff submit only. A company
    // may extend risk.approve/legal.approve to EHS staff by editing the
    // bundle (§3) — that is an override, never a default, so it is false here.
    [PlatformRole.SITE_ADMIN, "risk.approve", true],
    [PlatformRole.COMPANY_ADMIN, "risk.approve", true],
    [PlatformRole.EHS_SPECIALIST, "risk.approve", false],
    [PlatformRole.EHS_SPECIALIST, "risk.write", true],
    [PlatformRole.SITE_ADMIN, "legal.approve", true],
    [PlatformRole.EHS_SPECIALIST, "legal.approve", false],
    [PlatformRole.EHS_SPECIALIST, "legal.write", true],
    // Leader: organises training (E own units), updates/proposes actions,
    // reports events — but never writes risk, people, environment, chemicals,
    // legal or settings.
    [PlatformRole.MANAGER, "training.write", true],
    [PlatformRole.MANAGER, "actions.write", true],
    [PlatformRole.MANAGER, "incidents.write", true],
    [PlatformRole.MANAGER, "risk.write", false],
    [PlatformRole.MANAGER, "risk.approve", false],
    [PlatformRole.MANAGER, "people.write", false],
    [PlatformRole.MANAGER, "chemicals.write", false],
    [PlatformRole.MANAGER, "inspections.write", false],
    [PlatformRole.MANAGER, "documents.write", false],
    [PlatformRole.MANAGER, "settings.write", false],
    // Sicherheitsinformationen: the leader sends to their own units (the
    // audience guard narrows it), EHS and the admins send freely, and the
    // employee / works council / physician receive but never send.
    [PlatformRole.MANAGER, "broadcasts.write", true],
    [PlatformRole.EHS_SPECIALIST, "broadcasts.write", true],
    [PlatformRole.SITE_ADMIN, "broadcasts.write", true],
    [PlatformRole.EMPLOYEE, "broadcasts.write", false],
    [PlatformRole.WORKS_COUNCIL, "broadcasts.write", false],
    [PlatformRole.OCCUPATIONAL_PHYSICIAN, "broadcasts.write", false],
    // Employee: reports events, updates their own actions, reads their own
    // training — no organising, no people writes.
    [PlatformRole.EMPLOYEE, "incidents.write", true],
    [PlatformRole.EMPLOYEE, "actions.write", true],
    [PlatformRole.EMPLOYEE, "training.write", false],
    [PlatformRole.EMPLOYEE, "people.write", false],
    [PlatformRole.EMPLOYEE, "documents.write", false],
    // Works council: read-only co-determination surface.
    [PlatformRole.WORKS_COUNCIL, "incidents.write", false],
    [PlatformRole.WORKS_COUNCIL, "risk.write", false],
  ];
  for (const [role, permission, expected] of cases) {
    it(`${role} ${expected ? "has" : "lacks"} ${permission}`, () => {
      expect(hasPermission({ role }, permission)).toBe(expected);
    });
  }
});

// §3 guardrail restated as a matrix assertion: the health sub-compartment is
// withheld from every role by default except the occupational physician
// (ERGO §3.18(b)).
describe("health sub-compartment is physician-only by default", () => {
  for (const role of TENANT_ROLES) {
    const expected = role === PlatformRole.OCCUPATIONAL_PHYSICIAN;
    it(`${role} ${expected ? "holds" : "does not hold"} health_data.*`, () => {
      expect(hasPermission({ role }, "health_data.read")).toBe(expected);
      expect(hasPermission({ role }, "health_data.write")).toBe(expected);
    });
  }
});

describe("permission vocabulary", () => {
  it("every module's permission is a real permission", () => {
    for (const module of MODULE_REGISTRY) {
      expect(PERMISSIONS as readonly string[]).toContain(module.permission);
    }
  });
});
