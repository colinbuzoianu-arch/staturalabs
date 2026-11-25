import type { TenantKind } from "@/generated/prisma/enums";

// P18 A.1: the ONE place that answers "does this tenant count?".
//
// A trial is a prospect's time-limited copy of the demo data. It must never
// inflate a customer count, a platform statistic or (later) a billing run —
// and the founder's own DEMO tenant must not either. Scattering
// `tenantKind !== "TRIAL"` through pages is exactly how one of them ends up
// forgotten, so every caller goes through these.
//
// Pure, no DB, no `server-only`: unit-tested directly, and importable from a
// client component if a badge ever needs it.

// Tenants that represent real, paying business. This is the filter for counts,
// statistics and any future billing logic.
export function countsAsCustomer(kind: TenantKind): boolean {
  return kind === "CUSTOMER";
}

// Prisma `where` fragment for the same rule, so a query cannot drift from the
// predicate above.
export const CUSTOMER_TENANT_WHERE = { tenantKind: "CUSTOMER" } as const;

export type TrialState =
  | "not-a-trial"
  | "active"
  | "expiring-soon"
  | "locked"
  | "converted";

// Days before expiry at which a trial counts as "läuft bald ab" in the founder
// overview. The e-mail reminders (A.4) have their own two lead times; this is
// only the list badge.
export const TRIAL_EXPIRING_SOON_DAYS = 7;

export type TrialFields = {
  tenantKind: TenantKind;
  trialExpiresAt: Date | null;
  trialLockedAt: Date | null;
  trialConvertedAt: Date | null;
};

// The single state machine the overview badge, the tenant band and the sign-in
// lock all read. Fail-safe ordering: converted and locked win over any date
// arithmetic, and a TRIAL with no expiry is treated as active rather than
// locked — a missing date must never lock a prospect out by accident.
export function trialState(company: TrialFields, now: Date): TrialState {
  if (company.tenantKind !== "TRIAL") {
    // A converted trial is a CUSTOMER that still carries its conversion stamp.
    return company.trialConvertedAt ? "converted" : "not-a-trial";
  }
  if (company.trialConvertedAt) return "converted";
  if (company.trialLockedAt) return "locked";
  if (!company.trialExpiresAt) return "active";
  const msLeft = company.trialExpiresAt.getTime() - now.getTime();
  if (msLeft <= 0) return "locked";
  if (msLeft <= TRIAL_EXPIRING_SOON_DAYS * 86_400_000) return "expiring-soon";
  return "active";
}

// Whole days left, rounded up (the band says "bis TT.MM.JJJJ", the reminder
// logic needs the number). Null when there is no expiry to count to.
export function trialDaysLeft(
  expiresAt: Date | null,
  now: Date,
): number | null {
  if (!expiresAt) return null;
  return Math.ceil((expiresAt.getTime() - now.getTime()) / 86_400_000);
}

// A locked trial's data is kept this long before the deletion proposal (A.4).
export const TRIAL_GRACE_DAYS = 30;

// Has a locked trial's grace period run out, i.e. may its deletion be
// PROPOSED? Fail-closed: no lock stamp means no proposal, ever.
export function graceExpired(
  lockedAt: Date | null,
  now: Date,
  graceDays: number = TRIAL_GRACE_DAYS,
): boolean {
  if (!lockedAt) return false;
  return now.getTime() >= lockedAt.getTime() + graceDays * 86_400_000;
}
