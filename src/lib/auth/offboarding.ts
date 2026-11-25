import { recordAuditEvent } from "@/lib/audit/audit-event";
import { prisma } from "@/lib/prisma";

// P17 §5 (SLD_P17_TENANT_ROLES_APPROVED.md) offboarding: "when a person gets an
// end date or is deactivated, their account is disabled automatically on that
// date."
//
// Two halves, deliberately:
//   1) `isPersonOffboarded` — the pure rule, enforced on EVERY authenticated
//      request in getCurrentPlatformUser. That is what makes it automatic
//      without a scheduler: the moment the end date passes, the next request
//      from that account is treated as not-a-platform-user, exactly like the
//      P13 §2.4 disable. No cron can be late.
//   2) `disableOffboardedAccounts` — the batch that makes the state VISIBLE
//      (sets PlatformUser.disabledAt + audits it), so a leaver shows as
//      disabled in the users list and the super-admin overview rather than
//      only failing to sign in. Run from the people-accounts page; a scheduled
//      run is deferred (no job runner in this deployment yet — recorded).
//
// A person on legalHold is still offboarded: the hold protects their RECORDS
// from deletion (P7d §C.4), it is not a reason to keep a login alive.
// No `import "server-only"` — the pure rule is unit-tested directly.

export type OffboardingPerson = {
  active: boolean;
  employmentEnd: Date | null;
  anonymisedAt: Date | null;
};

export function isPersonOffboarded(
  person: OffboardingPerson,
  now: Date,
): boolean {
  if (person.anonymisedAt) return true;
  if (!person.active) return true;
  // The end date is a last DAY of employment: the account stays usable through
  // that day and is closed once it has passed.
  if (person.employmentEnd) {
    const endOfDay = new Date(person.employmentEnd);
    endOfDay.setHours(23, 59, 59, 999);
    return now.getTime() > endOfDay.getTime();
  }
  return false;
}

export type OffboardingResult = {
  checked: number;
  disabled: { platformUserId: string; personId: string }[];
};

// Sets disabledAt on the login accounts of offboarded persons in one company.
// Idempotent: an already-disabled account is skipped. Never re-enables anyone —
// re-activation is a deliberate admin act, not a side effect of a batch.
export async function disableOffboardedAccounts(input: {
  companyId: string;
  actorUserId: string;
  now?: Date;
}): Promise<OffboardingResult> {
  const now = input.now ?? new Date();
  const linked = await prisma.person.findMany({
    where: { companyId: input.companyId, platformUserId: { not: null } },
    select: {
      id: true,
      platformUserId: true,
      active: true,
      employmentEnd: true,
      anonymisedAt: true,
    },
  });

  const result: OffboardingResult = { checked: linked.length, disabled: [] };
  for (const person of linked) {
    if (!person.platformUserId) continue;
    if (!isPersonOffboarded(person, now)) continue;
    const account = await prisma.platformUser.findUnique({
      where: { id: person.platformUserId },
      select: { id: true, disabledAt: true, companyId: true },
    });
    // Belt and braces: never touch an account outside this company.
    if (!account || account.companyId !== input.companyId) continue;
    if (account.disabledAt) continue;

    await prisma.platformUser.update({
      where: { id: account.id },
      data: { disabledAt: now, disabledByUserId: input.actorUserId },
    });
    // Any outstanding access code for a leaver is worthless — revoke it so it
    // cannot be redeemed from a printed sheet after they have left.
    await prisma.employeeAccessCode.updateMany({
      where: { personId: person.id, usedAt: null, revokedAt: null },
      data: { revokedAt: now },
    });
    await recordAuditEvent({
      actorUserId: input.actorUserId,
      action: "employee_account.offboard_disable",
      entityType: "PlatformUser",
      entityId: account.id,
      companyId: input.companyId,
      diff: { personId: person.id },
    });
    result.disabled.push({ platformUserId: account.id, personId: person.id });
  }
  return result;
}
