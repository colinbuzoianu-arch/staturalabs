import type { TenantKind } from "@/generated/prisma/enums";

// P18 A.2/A.3: the limits that apply to a TRIAL and to nothing else.
//
// Pure + unit-tested, and read from configuration rather than hard-coded
// (sandbox-readiness rule 4: environment-driven defaults resolved in ONE
// place, never scattered `if`s). A customer tenant is never limited by any of
// these — `trialUserLimit` and `trialAiCallCap` return null off a TRIAL, and
// null means "no limit" everywhere it is used.

// How many login accounts a trial may hold (the trial admin plus colleagues).
export const TRIAL_MAX_USERS_DEFAULT = 10;
// A.3: lower AI caps than a customer — the plan's 25 SDS extractions + 50
// drafts. The metering model counts CALLS (AiUsageCounter), not call kinds, so
// the cap is their sum and the two numbers stay in the comment as the intent.
export const TRIAL_AI_CALL_CAP_DEFAULT = 75;

// Strict on purpose: the WHOLE value must be digits. parseInt is lenient
// enough to read "3.7.1" as 3, which would silently cut a trial's user limit
// to three without anyone noticing — a misconfiguration must fall back to the
// documented default, not to whatever the first characters happen to parse as.
function positiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  if (!/^\d+$/.test(raw.trim())) return fallback;
  const n = Number.parseInt(raw.trim(), 10);
  return n > 0 ? n : fallback;
}

export function trialUserLimit(
  kind: TenantKind,
  env: string | undefined = process.env.TRIAL_MAX_USERS,
): number | null {
  if (kind !== "TRIAL") return null;
  return positiveInt(env, TRIAL_MAX_USERS_DEFAULT);
}

export function trialAiCallCap(
  kind: TenantKind,
  env: string | undefined = process.env.TRIAL_AI_CALL_CAP,
): number | null {
  if (kind !== "TRIAL") return null;
  return positiveInt(env, TRIAL_AI_CALL_CAP_DEFAULT);
}

export type UserLimitCheck =
  | { ok: true }
  | { ok: false; limit: number; current: number };

// Whether one more account may be created. Fail-closed at the limit: a trial
// AT its limit cannot add another, which is what "up to 10 users" means.
export function checkTrialUserLimit(
  kind: TenantKind,
  currentUserCount: number,
  env?: string,
): UserLimitCheck {
  const limit = trialUserLimit(kind, env);
  if (limit === null) return { ok: true };
  if (currentUserCount >= limit) {
    return { ok: false, limit, current: currentUserCount };
  }
  return { ok: true };
}
