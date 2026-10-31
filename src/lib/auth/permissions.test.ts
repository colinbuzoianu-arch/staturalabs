import { describe, expect, it } from "vitest";
import { PlatformRole } from "@/generated/prisma/enums";
import { hasPermission, PERMISSIONS, ROLE_PERMISSIONS } from "./permissions";

describe("permissions", () => {
  it("defines a bundle for every PlatformRole", () => {
    for (const role of Object.values(PlatformRole)) {
      expect(ROLE_PERMISSIONS[role]).toBeInstanceOf(Set);
    }
  });

  it("grants admins every non-health permission and withholds health from all roles", () => {
    for (const role of Object.values(PlatformRole)) {
      expect(hasPermission({ role }, "risk.read")).toBe(true);
      expect(hasPermission({ role }, "settings.write")).toBe(true);
      // Health sub-compartment is withheld from every existing role
      // (ERGO_COMPLIANCE_BY_DESIGN.md §3.18(b)).
      expect(hasPermission({ role }, "health_data.read")).toBe(false);
      expect(hasPermission({ role }, "health_data.write")).toBe(false);
    }
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
