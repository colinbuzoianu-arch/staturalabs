import "server-only";

import type { PlatformUserModel } from "@/generated/prisma/models";
import { createClient } from "@/lib/supabase/server";
import { type AalLevel, mfaDecision } from "./mfa-policy";

// P13 §4 MFA (TOTP) server wrapper. Flag-gated like RLS (SLD_P13_MFA_ROLLOUT.md):
// off until the Supabase project's MFA setting is enabled on staging and the
// enrolment flow is exercised with a real authenticator app. When off, every
// decision is "ok" and nothing changes.
export function isMfaEnforced(): boolean {
  return process.env.MFA_ENFORCED === "true";
}

// Reads the live session's assurance level and whether a verified TOTP factor
// exists. Best-effort: on any Supabase error it reports aal1 / no factor, so a
// required role is sent to enrol rather than silently let through (fail-closed).
async function getSessionMfaState(): Promise<{
  currentAal: AalLevel;
  hasVerifiedFactor: boolean;
}> {
  const supabase = await createClient();
  try {
    const { data: aal } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const hasVerifiedFactor = (factors?.totp ?? []).some(
      (f) => f.status === "verified",
    );
    const currentAal = (aal?.currentLevel as AalLevel) ?? null;
    return { currentAal, hasVerifiedFactor };
  } catch {
    return { currentAal: "aal1", hasVerifiedFactor: false };
  }
}

// The one gate the authenticated shells call. Returns the remediation path when
// the session must enrol or step up, or null when nothing is required. The MFA
// page itself lives OUTSIDE the (app) group (at /security/mfa) so redirecting
// here never loops.
export async function mfaRedirectTarget(
  user: PlatformUserModel,
): Promise<string | null> {
  if (!isMfaEnforced()) return null;
  const { currentAal, hasVerifiedFactor } = await getSessionMfaState();
  const decision = mfaDecision({
    enforced: true,
    role: user.role,
    currentAal,
    hasVerifiedFactor,
  });
  return decision === "ok" ? null : "/security/mfa";
}
