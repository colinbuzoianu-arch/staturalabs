import "server-only";

import { randomBytes } from "node:crypto";
import { PlatformRole } from "@/generated/prisma/enums";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { invitePlatformUser } from "@/lib/auth/invite";
import { isPersonOffboarded } from "@/lib/auth/offboarding";
import { grantRole } from "@/lib/auth/role-assignment";
import { appUrl } from "@/lib/config/base-url";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/server";
import {
  ACCESS_CODE_DEFAULT_VALIDITY_DAYS,
  accessCodeExpiry,
  accessCodeUsability,
  formatAccessCode,
  generateAccessCode,
  hashAccessCode,
  syntheticEmployeeEmail,
} from "./access-code";
import { EMPLOYEE_PASSWORD_MIN_LENGTH } from "./employee-password";

// P17 §5 (SLD_P17_TENANT_ROLES_APPROVED.md): the write gates for employee
// accounts. One function per rule, same discipline as every other lib gate.
//
// Fail-closed in three places, in this order:
//   1) the tenant switch (Company.employeeAccountsEnabled, default OFF),
//   2) the person (same company, active, not anonymised, not offboarded),
//   3) the path (an e-mail invite needs an e-mail; an access code needs a
//      personnel number — neither is invented).
//
// `import "server-only"`: this touches the Supabase admin API. The pure parts
// (code generation/hashing/usability, the offboarding rule) live in
// access-code.ts / auth/offboarding.ts and are unit-tested there.

export type ProvisionSkipReason =
  | "accounts-disabled"
  | "not-found"
  | "inactive"
  | "anonymised"
  | "offboarded"
  | "already-has-account"
  | "no-identifier";

export type ProvisionOutcome =
  | { personId: string; kind: "invite"; email: string }
  | {
      personId: string;
      kind: "access-code";
      // Shown ONCE (only the hash is stored) — the printable hand-over sheet.
      code: string;
      codeFormatted: string;
      personnelNumber: string;
      expiresAt: Date;
      signInUrl: string | null;
    }
  | { personId: string; kind: "skipped"; reason: ProvisionSkipReason };

type PersonRow = {
  id: string;
  companyId: string;
  firstName: string;
  lastName: string;
  personnelNumber: string | null;
  email: string | null;
  active: boolean;
  anonymisedAt: Date | null;
  employmentEnd: Date | null;
  platformUserId: string | null;
};

async function companyAccountsEnabled(companyId: string): Promise<boolean> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { employeeAccountsEnabled: true },
  });
  return company?.employeeAccountsEnabled === true;
}

// Provision (or, for an access-code person who already has an account,
// re-issue a code for) ONE person. The caller authorizes the actor — the page
// gates on requireSiteAdministrationAccess + company scope.
export async function provisionEmployeeAccount(input: {
  companyId: string;
  personId: string;
  actorUserId: string;
  now?: Date;
  validityDays?: number;
}): Promise<ProvisionOutcome> {
  const now = input.now ?? new Date();
  const skip = (reason: ProvisionSkipReason): ProvisionOutcome => ({
    personId: input.personId,
    kind: "skipped",
    reason,
  });

  if (!(await companyAccountsEnabled(input.companyId))) {
    return skip("accounts-disabled");
  }

  const person: PersonRow | null = await prisma.person.findUnique({
    where: { id: input.personId },
    select: {
      id: true,
      companyId: true,
      firstName: true,
      lastName: true,
      personnelNumber: true,
      email: true,
      active: true,
      anonymisedAt: true,
      employmentEnd: true,
      platformUserId: true,
    },
  });

  if (!person || person.companyId !== input.companyId) return skip("not-found");
  if (person.anonymisedAt) return skip("anonymised");
  if (!person.active) return skip("inactive");
  if (
    isPersonOffboarded(
      {
        active: person.active,
        employmentEnd: person.employmentEnd,
        anonymisedAt: person.anonymisedAt,
      },
      now,
    )
  ) {
    return skip("offboarded");
  }

  // Already linked: an access-code person can get a FRESH code (lost sheet,
  // expired code) — that is the one legitimate repeat. An e-mail person's
  // invite is Supabase's to re-send, so we never create a second account.
  if (person.platformUserId) {
    if (person.email) return skip("already-has-account");
    if (!person.personnelNumber) return skip("already-has-account");
    return issueAccessCode({
      person,
      platformUserId: person.platformUserId,
      actorUserId: input.actorUserId,
      now,
      validityDays: input.validityDays,
    });
  }

  const name = `${person.firstName} ${person.lastName}`.trim();

  if (person.email) {
    const account = await invitePlatformUser({
      email: person.email,
      name,
      role: PlatformRole.EMPLOYEE,
      companyId: input.companyId,
    });
    await linkAndGrant({
      person,
      platformUserId: account.id,
      actorUserId: input.actorUserId,
    });
    await recordAuditEvent({
      actorUserId: input.actorUserId,
      action: "employee_account.invite",
      entityType: "PlatformUser",
      entityId: account.id,
      companyId: input.companyId,
      diff: { personId: person.id, path: "email-invite" },
    });
    return { personId: person.id, kind: "invite", email: person.email };
  }

  if (!person.personnelNumber) return skip("no-identifier");

  // No e-mail: create the auth account directly with a random, never-disclosed
  // password on a synthetic .invalid address, then hand over a one-time code.
  // The person replaces the password on the claim screen; until they do, the
  // account has no credential anyone knows.
  const email = syntheticEmployeeEmail(input.companyId, person.personnelNumber);
  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: randomBytes(24).toString("base64url"),
    email_confirm: true,
    user_metadata: { role: PlatformRole.EMPLOYEE, companyId: input.companyId },
  });
  if (error || !data.user) {
    throw new Error(
      `Failed to create employee account: ${error?.message ?? "no user returned"}`,
    );
  }
  try {
    await prisma.platformUser.create({
      data: {
        id: data.user.id,
        email,
        name,
        role: PlatformRole.EMPLOYEE,
        companyId: input.companyId,
      },
    });
  } catch (err) {
    // Same compensation as invitePlatformUser: never leave an auth account
    // with no platform grant it can resolve to.
    await supabase.auth.admin.deleteUser(data.user.id);
    throw err;
  }
  await linkAndGrant({
    person,
    platformUserId: data.user.id,
    actorUserId: input.actorUserId,
  });
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "employee_account.create",
    entityType: "PlatformUser",
    entityId: data.user.id,
    companyId: input.companyId,
    diff: { personId: person.id, path: "access-code" },
  });
  return issueAccessCode({
    person,
    platformUserId: data.user.id,
    actorUserId: input.actorUserId,
    now,
    validityDays: input.validityDays,
  });
}

async function linkAndGrant(input: {
  person: PersonRow;
  platformUserId: string;
  actorUserId: string;
}): Promise<void> {
  await prisma.person.update({
    where: { id: input.person.id },
    data: { platformUserId: input.platformUserId },
  });
  // The employee role is SELF-scoped by definition (§1) — the scope helper
  // then resolves "their own records only".
  await grantRole({
    platformUserId: input.platformUserId,
    role: PlatformRole.EMPLOYEE,
    scopeType: "SELF",
    scopeId: null,
    grantedByUserId: input.actorUserId,
    companyId: input.person.companyId,
  });
}

async function issueAccessCode(input: {
  person: PersonRow;
  platformUserId: string;
  actorUserId: string;
  now: Date;
  validityDays?: number;
}): Promise<ProvisionOutcome> {
  const personnelNumber = input.person.personnelNumber;
  if (!personnelNumber) {
    return {
      personId: input.person.id,
      kind: "skipped",
      reason: "no-identifier",
    };
  }
  // Supersede any outstanding code first: exactly one code can be live per
  // person, so an older printed sheet stops working the moment a new one is
  // handed out.
  await prisma.employeeAccessCode.updateMany({
    where: { personId: input.person.id, usedAt: null, revokedAt: null },
    data: { revokedAt: input.now },
  });

  const code = generateAccessCode();
  const expiresAt = accessCodeExpiry(
    input.now,
    input.validityDays ?? ACCESS_CODE_DEFAULT_VALIDITY_DAYS,
  );
  const row = await prisma.employeeAccessCode.create({
    data: {
      companyId: input.person.companyId,
      personId: input.person.id,
      platformUserId: input.platformUserId,
      codeHash: hashAccessCode(code),
      expiresAt,
      createdByUserId: input.actorUserId,
    },
  });
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "employee_account.access_code_issued",
    entityType: "EmployeeAccessCode",
    entityId: row.id,
    companyId: input.person.companyId,
    // The code itself is never audited — only that one was issued.
    diff: { personId: input.person.id, expiresAt: expiresAt.toISOString() },
  });
  return {
    personId: input.person.id,
    kind: "access-code",
    code,
    codeFormatted: formatAccessCode(code),
    personnelNumber,
    expiresAt,
    signInUrl: appUrl("/login"),
  };
}

// §5 bulk provisioning: "select persons and create employee accounts in one
// step (e-mail invite where an e-mail exists, access-code sheet otherwise)".
// Sequential on purpose — each row hits the Supabase admin API, and a partial
// result with per-person outcomes is more useful than an all-or-nothing batch.
export async function provisionEmployeeAccounts(input: {
  companyId: string;
  personIds: readonly string[];
  actorUserId: string;
  now?: Date;
}): Promise<ProvisionOutcome[]> {
  const out: ProvisionOutcome[] = [];
  for (const personId of input.personIds) {
    out.push(
      await provisionEmployeeAccount({
        companyId: input.companyId,
        personId,
        actorUserId: input.actorUserId,
        now: input.now,
      }),
    );
  }
  return out;
}

export type RedeemResult =
  | { ok: true; email: string }
  | { ok: false; reason: "invalid" | "weak-password" };

// The unauthenticated half: personnel number + one-time code → the employee
// sets their own password. The CODE is the credential, so the lookup is by its
// hash (unique) and the personnel number is then checked against the person it
// belongs to — which also disambiguates personnel numbers across tenants
// without asking an employee which company they work for.
//
// Every failure but a too-short password returns the same generic "invalid",
// so this endpoint cannot be used to probe which personnel numbers or codes
// exist.
export async function redeemAccessCode(input: {
  personnelNumber: string;
  code: string;
  newPassword: string;
  now?: Date;
}): Promise<RedeemResult> {
  const now = input.now ?? new Date();
  if (input.newPassword.length < EMPLOYEE_PASSWORD_MIN_LENGTH) {
    return { ok: false, reason: "weak-password" };
  }

  const row = await prisma.employeeAccessCode.findUnique({
    where: { codeHash: hashAccessCode(input.code) },
    select: {
      id: true,
      companyId: true,
      personId: true,
      platformUserId: true,
      expiresAt: true,
      usedAt: true,
      revokedAt: true,
      person: {
        select: {
          personnelNumber: true,
          active: true,
          anonymisedAt: true,
          employmentEnd: true,
        },
      },
    },
  });
  if (!row) return { ok: false, reason: "invalid" };
  if (!accessCodeUsability(row, now).usable) {
    return { ok: false, reason: "invalid" };
  }

  const typed = input.personnelNumber.trim().toUpperCase();
  const actual = row.person.personnelNumber?.trim().toUpperCase() ?? null;
  if (!actual || actual !== typed) return { ok: false, reason: "invalid" };

  if (
    isPersonOffboarded(
      {
        active: row.person.active,
        employmentEnd: row.person.employmentEnd,
        anonymisedAt: row.person.anonymisedAt,
      },
      now,
    )
  ) {
    return { ok: false, reason: "invalid" };
  }

  // The tenant switch is re-checked here too: turning employee accounts off
  // must stop an already-printed sheet from being redeemed.
  if (!(await companyAccountsEnabled(row.companyId))) {
    return { ok: false, reason: "invalid" };
  }

  const account = await prisma.platformUser.findUnique({
    where: { id: row.platformUserId },
    select: { id: true, email: true, disabledAt: true, companyId: true },
  });
  if (!account || account.disabledAt || account.companyId !== row.companyId) {
    return { ok: false, reason: "invalid" };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.auth.admin.updateUserById(account.id, {
    password: input.newPassword,
  });
  if (error) return { ok: false, reason: "invalid" };

  await prisma.employeeAccessCode.update({
    where: { id: row.id },
    data: { usedAt: now },
  });
  await recordAuditEvent({
    // The redeemer is the employee's own account — not an admin acting on them.
    actorUserId: account.id,
    action: "employee_account.access_code_redeemed",
    entityType: "EmployeeAccessCode",
    entityId: row.id,
    companyId: row.companyId,
    diff: { personId: row.personId },
  });
  return { ok: true, email: account.email };
}
