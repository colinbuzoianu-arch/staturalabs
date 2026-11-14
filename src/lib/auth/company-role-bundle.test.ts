import { describe, expect, it } from "vitest";
import { PlatformRole } from "@/generated/prisma/enums";
import {
  COMPANY_EDITABLE_ROLES,
  effectiveRoleBundle,
  grantablePermissions,
  isCompanyEditableRole,
  RoleBundleGuardrailError,
  validateRoleBundle,
} from "./company-role-bundle";
import { ROLE_PERMISSIONS } from "./permissions";

describe("company-role-bundle guardrails (pure)", () => {
  it("only the three tenant roles are company-editable", () => {
    expect([...COMPANY_EDITABLE_ROLES].sort()).toStrictEqual(
      [
        PlatformRole.EHS_SPECIALIST,
        PlatformRole.EMPLOYEE,
        PlatformRole.MANAGER,
      ].sort(),
    );
    expect(isCompanyEditableRole(PlatformRole.COMPANY_ADMIN)).toBe(false);
    expect(isCompanyEditableRole(PlatformRole.OCCUPATIONAL_PHYSICIAN)).toBe(
      false,
    );
    expect(isCompanyEditableRole(PlatformRole.EHS_SPECIALIST)).toBe(true);
  });

  it("never lets health data into any grantable ceiling", () => {
    for (const role of COMPANY_EDITABLE_ROLES) {
      const ceiling = grantablePermissions(role);
      expect(ceiling.has("health_data.read")).toBe(false);
      expect(ceiling.has("health_data.write")).toBe(false);
      expect(ceiling.has("settings.read")).toBe(false);
      expect(ceiling.has("settings.write")).toBe(false);
    }
  });

  it("lets EHS staff be extended with the A column, but never leader/employee", () => {
    const ehs = grantablePermissions(PlatformRole.EHS_SPECIALIST);
    expect(ehs.has("risk.approve")).toBe(true);
    expect(ehs.has("legal.approve")).toBe(true);
    for (const role of [PlatformRole.MANAGER, PlatformRole.EMPLOYEE]) {
      const c = grantablePermissions(role);
      expect(c.has("risk.approve")).toBe(false);
      expect(c.has("legal.approve")).toBe(false);
    }
  });

  it("accepts extending EHS with risk.approve (the §2 headline case)", () => {
    const base = [...ROLE_PERMISSIONS[PlatformRole.EHS_SPECIALIST]];
    const out = validateRoleBundle(PlatformRole.EHS_SPECIALIST, [
      ...base,
      "risk.approve",
      "legal.approve",
    ]);
    expect(out).toContain("risk.approve");
    expect(out).toContain("legal.approve");
  });

  it("de-duplicates and returns a canonical list", () => {
    const out = validateRoleBundle(PlatformRole.EMPLOYEE, [
      "my-tasks.read",
      "my-tasks.read",
      "calendar.read",
    ]);
    expect(out.sort()).toStrictEqual(["calendar.read", "my-tasks.read"]);
  });

  it("rejects a non-editable role", () => {
    expect(() =>
      validateRoleBundle(PlatformRole.COMPANY_ADMIN, ["risk.read"]),
    ).toThrow(RoleBundleGuardrailError);
    expect(() =>
      validateRoleBundle(PlatformRole.OCCUPATIONAL_PHYSICIAN, ["cockpit.read"]),
    ).toThrow(/not company-editable/);
  });

  it("rejects an unknown permission", () => {
    expect(() =>
      validateRoleBundle(PlatformRole.MANAGER, ["risk.superpower"]),
    ).toThrow(/Unknown permission/);
  });

  it("rejects adding health data (hard ban, even to EHS)", () => {
    expect(() =>
      validateRoleBundle(PlatformRole.EHS_SPECIALIST, [
        "cockpit.read",
        "health_data.read",
      ]),
    ).toThrow(RoleBundleGuardrailError);
  });

  it("rejects granting the A column to a leader or employee", () => {
    expect(() =>
      validateRoleBundle(PlatformRole.MANAGER, [
        "cockpit.read",
        "risk.approve",
      ]),
    ).toThrow(/outside the grantable ceiling/);
    expect(() =>
      validateRoleBundle(PlatformRole.EMPLOYEE, [
        "my-tasks.read",
        "legal.approve",
      ]),
    ).toThrow(/outside the grantable ceiling/);
  });

  it("rejects granting settings.* to any editable role", () => {
    expect(() =>
      validateRoleBundle(PlatformRole.EHS_SPECIALIST, [
        "cockpit.read",
        "settings.write",
      ]),
    ).toThrow(/outside the grantable ceiling/);
  });

  it("effectiveRoleBundle: null override = the system default", () => {
    const def = effectiveRoleBundle(PlatformRole.MANAGER, null);
    expect([...def].sort()).toStrictEqual(
      [...ROLE_PERMISSIONS[PlatformRole.MANAGER]].sort(),
    );
  });

  it("effectiveRoleBundle: a non-null override replaces the default", () => {
    const eff = effectiveRoleBundle(PlatformRole.EHS_SPECIALIST, [
      "cockpit.read",
      "risk.approve",
    ]);
    expect([...eff].sort()).toStrictEqual(["cockpit.read", "risk.approve"]);
    // the default's other permissions are gone — an override is a full set.
    expect(eff.has("risk.read")).toBe(false);
  });
});
