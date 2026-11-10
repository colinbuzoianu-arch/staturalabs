import { describe, expect, it } from "vitest";
import { PlatformRole } from "@/generated/prisma/enums";
import {
  isMfaRequiredForRole,
  MFA_REQUIRED_ROLES,
  mfaDecision,
} from "./mfa-policy";

describe("mfa-policy", () => {
  it("requires MFA for the high-privilege and health roles", () => {
    expect(isMfaRequiredForRole(PlatformRole.SUPER_ADMIN)).toBe(true);
    expect(isMfaRequiredForRole(PlatformRole.L3_SUPPORT)).toBe(true);
    expect(isMfaRequiredForRole(PlatformRole.COMPANY_ADMIN)).toBe(true);
    expect(isMfaRequiredForRole(PlatformRole.EHS_SPECIALIST)).toBe(true);
    expect(isMfaRequiredForRole(PlatformRole.OCCUPATIONAL_PHYSICIAN)).toBe(
      true,
    );
  });

  it("does not force MFA on the lower-privilege roles", () => {
    expect(isMfaRequiredForRole(PlatformRole.SITE_ADMIN)).toBe(false);
    expect(isMfaRequiredForRole(PlatformRole.MANAGER)).toBe(false);
    expect(isMfaRequiredForRole(PlatformRole.EMPLOYEE)).toBe(false);
    expect(isMfaRequiredForRole(PlatformRole.WORKS_COUNCIL)).toBe(false);
  });

  it("never steps up when enforcement is off, whatever the role/state", () => {
    expect(
      mfaDecision({
        enforced: false,
        role: PlatformRole.SUPER_ADMIN,
        currentAal: "aal1",
        hasVerifiedFactor: false,
      }),
    ).toBe("ok");
  });

  it("never steps up a non-required role even when enforced", () => {
    expect(
      mfaDecision({
        enforced: true,
        role: PlatformRole.EMPLOYEE,
        currentAal: "aal1",
        hasVerifiedFactor: false,
      }),
    ).toBe("ok");
  });

  it("is satisfied once the session is aal2", () => {
    expect(
      mfaDecision({
        enforced: true,
        role: PlatformRole.COMPANY_ADMIN,
        currentAal: "aal2",
        hasVerifiedFactor: true,
      }),
    ).toBe("ok");
  });

  it("challenges a required role that has a factor but only aal1", () => {
    expect(
      mfaDecision({
        enforced: true,
        role: PlatformRole.OCCUPATIONAL_PHYSICIAN,
        currentAal: "aal1",
        hasVerifiedFactor: true,
      }),
    ).toBe("challenge");
  });

  it("enrols a required role with no verified factor", () => {
    expect(
      mfaDecision({
        enforced: true,
        role: PlatformRole.SUPER_ADMIN,
        currentAal: null,
        hasVerifiedFactor: false,
      }),
    ).toBe("enroll");
  });

  it("keeps the required-role set stable", () => {
    expect(MFA_REQUIRED_ROLES.size).toBe(5);
  });
});
