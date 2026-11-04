import { describe, expect, it } from "vitest";
import { PlatformRole } from "@/generated/prisma/enums";
import { hasPermission, PERMISSIONS, ROLE_PERMISSIONS } from "./permissions";

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

  it("withholds the health sub-compartment from EVERY role (§3.18(b))", () => {
    for (const role of Object.values(PlatformRole)) {
      expect(hasPermission({ role }, "health_data.read")).toBe(false);
      expect(hasPermission({ role }, "health_data.write")).toBe(false);
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
    // employee: only own training + my-tasks.
    expect(
      hasPermission({ role: PlatformRole.EMPLOYEE }, "training.read"),
    ).toBe(true);
    expect(
      hasPermission({ role: PlatformRole.EMPLOYEE }, "my-tasks.read"),
    ).toBe(true);
    expect(hasPermission({ role: PlatformRole.EMPLOYEE }, "risk.read")).toBe(
      false,
    );
    expect(hasPermission({ role: PlatformRole.EMPLOYEE }, "people.read")).toBe(
      false,
    );
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
});
