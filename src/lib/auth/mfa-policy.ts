import { PlatformRole } from "@/generated/prisma/enums";

// P13 §4 MFA (TOTP) — pure policy, no I/O, unit-tested. The server wrapper
// (mfa.ts) reads the live Supabase session; this file decides what that means.

// The high-privilege and health-data roles that must use a second factor once
// enforcement is on. EMPLOYEE / MANAGER / SITE_ADMIN / WORKS_COUNCIL are not
// forced (they hold no cross-tenant or health access) — MFA stays available to
// them, just not mandatory. Keep this list in step with the §3.18 role model.
export const MFA_REQUIRED_ROLES: ReadonlySet<PlatformRole> = new Set([
  PlatformRole.SUPER_ADMIN,
  PlatformRole.L3_SUPPORT,
  PlatformRole.COMPANY_ADMIN,
  PlatformRole.EHS_SPECIALIST,
  PlatformRole.OCCUPATIONAL_PHYSICIAN,
]);

export function isMfaRequiredForRole(role: PlatformRole): boolean {
  return MFA_REQUIRED_ROLES.has(role);
}

export type AalLevel = "aal1" | "aal2" | null;

// What the current session must do. Enforcement only bites when the flag is on
// AND the role requires MFA.
//   - "ok"        -> nothing to do (not enforced, not a required role, or aal2)
//   - "challenge" -> a verified factor exists but the session is aal1 (step up)
//   - "enroll"    -> no verified factor yet (first-time enrolment)
export type MfaDecision = "ok" | "enroll" | "challenge";

export function mfaDecision(input: {
  enforced: boolean;
  role: PlatformRole;
  currentAal: AalLevel;
  hasVerifiedFactor: boolean;
}): MfaDecision {
  if (!input.enforced) return "ok";
  if (!isMfaRequiredForRole(input.role)) return "ok";
  if (input.currentAal === "aal2") return "ok";
  return input.hasVerifiedFactor ? "challenge" : "enroll";
}
