import "server-only";

import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";
import type { CountryCode, PlatformRole } from "@/generated/prisma/enums";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { invitePlatformUser } from "@/lib/auth/invite";
import { MODULE_REGISTRY } from "@/lib/modules/registry";
import { prisma } from "@/lib/prisma";
import { checkTrialUserLimit, trialAiCallCap } from "./trial-limits";

// P18 A.2: creating a prospect trial. One gate, super_admin-only (every /admin
// page and Server Action is behind requireSuperAdmin), fully audited.
//
// A trial is a REAL tenant of the production app — real login, real e-mails,
// real PDFs, all roles — with three differences: a time limit, lower AI caps,
// and a band saying what it is. Nothing about the app is stubbed for it.

const execFileAsync = promisify(execFile);

export const TRIAL_DEFAULT_DURATION_DAYS = 30;
// A.2: only AT and DE. CH stays off — its country pack is not verified, so a
// trial there would show honest gaps everywhere and sell nothing.
export const TRIAL_COUNTRIES: readonly CountryCode[] = ["AT", "DE"];

// The six chemistry engines, set to PREVIEW for a trial (A.2) exactly as the
// demo tenant has them: visible as a checking aid, never authoritative.
const ENGINE_KEYS = [
  "clp.mixtureCalculation",
  "mixture.physicalEstimates",
  "wgk.mixtureCalculation",
  "storage.lagerklasseSuggestion",
  "transport.classification",
  "sds.authoring",
] as const;

export class TrialGateError extends Error {}

export type CreateTrialInput = {
  companyName: string;
  contactEmail: string;
  contactName?: string | null;
  country: CountryCode;
  durationDays?: number;
  // "Mit Demo-Daten" (true) or "Leer" (false → the tenant starts in the P13
  // onboarding wizard).
  withDemoData: boolean;
  notes?: string | null;
  actorUserId: string;
  now?: Date;
};

export type CreateTrialResult = {
  companyId: string;
  siteId: string | null;
  expiresAt: Date;
  seeded: boolean;
  seedError: string | null;
  // A failed invite does NOT roll the tenant back (a typo'd address must not
  // destroy a tenant the founder may still want): it is reported, and the
  // existing invite form on the tenant page is where it gets retried.
  inviteError: string | null;
  adminUserId: string | null;
};

export async function createTrial(
  input: CreateTrialInput,
): Promise<CreateTrialResult> {
  const now = input.now ?? new Date();
  const name = input.companyName.trim();
  const email = input.contactEmail.trim();
  if (name.length === 0) throw new TrialGateError("company-name-required");
  if (!email.includes("@")) throw new TrialGateError("contact-email-required");
  if (!TRIAL_COUNTRIES.includes(input.country)) {
    throw new TrialGateError("unsupported-country");
  }
  const durationDays = input.durationDays ?? TRIAL_DEFAULT_DURATION_DAYS;
  if (!Number.isFinite(durationDays) || durationDays <= 0) {
    throw new TrialGateError("invalid-duration");
  }
  const expiresAt = new Date(now.getTime() + durationDays * 86_400_000);

  const company = await prisma.company.create({
    data: {
      name,
      tenantKind: "TRIAL",
      homeCountry: input.country,
      defaultLocale: "de",
      trialExpiresAt: expiresAt,
      trialContactEmail: email,
      trialCreatedByUserId: input.actorUserId,
      trialNotes: input.notes?.trim() || null,
      trialSeeded: input.withDemoData,
      // A.2: employee accounts stay off until the prospect decides to try
      // them — the same default a real customer gets.
    },
  });

  // A.2: ALL modules entitled by default — read from the registry, not from
  // the super-admin's DefaultEntitlementModule template. The template is the
  // founder's deliberate choice for a new CUSTOMER (today: three modules), and
  // applying it to a trial would silently hide most of the product from the
  // prospect it is meant to sell. Reading the registry also means a module
  // added later is in the next trial without anyone remembering this line.
  // The founder adjusts afterwards in the existing module matrix.
  const entitled = MODULE_REGISTRY.filter((m) => m.requiresEntitlement);
  await prisma.companyModule.createMany({
    data: entitled.map((m) => ({
      companyId: company.id,
      moduleKey: m.key,
      enabledByUserId: input.actorUserId,
    })),
    skipDuplicates: true,
  });

  // Engines on PREVIEW.
  for (const engineKey of ENGINE_KEYS) {
    await prisma.engineFlagSetting.upsert({
      where: { engineKey_companyId: { engineKey, companyId: company.id } },
      create: {
        companyId: company.id,
        engineKey,
        state: "PREVIEW",
        setByUserId: input.actorUserId,
      },
      update: { state: "PREVIEW", setByUserId: input.actorUserId },
    });
  }

  // Lower AI caps (A.3). Manual entry always works, so a reached cap pauses AI
  // rather than blocking the trial.
  const callCap = trialAiCallCap("TRIAL");
  if (callCap !== null) {
    await prisma.aiUsageCap.upsert({
      where: { companyId: company.id },
      create: {
        companyId: company.id,
        monthlyCallCap: callCap,
        updatedByUserId: input.actorUserId,
      },
      update: { monthlyCallCap: callCap, updatedByUserId: input.actorUserId },
    });
  }

  // The contact becomes the trial's first Administrator, through the one invite
  // path (Supabase invite e-mail + PlatformUser row). Done BEFORE seeding
  // because the sample Evaluierung is stamped with a real assessor — the
  // tenant's own admin — rather than with nobody or with the founder.
  let adminUserId: string | null = null;
  let inviteError: string | null = null;
  try {
    const admin = await invitePlatformUser({
      email,
      name: input.contactName?.trim() || email,
      role: "COMPANY_ADMIN",
      companyId: company.id,
    });
    adminUserId = admin.id;
  } catch (error) {
    inviteError = error instanceof Error ? error.message : String(error);
    console.error(`[trial] invite failed for ${company.id}: ${inviteError}`);
  }

  let siteId: string | null = null;
  let seedError: string | null = null;
  if (input.withDemoData && adminUserId === null) {
    // No administrator, no assessor: the fixture would have to invent one.
    seedError = "no-administrator-to-attribute-sample-data-to";
  } else if (input.withDemoData && adminUserId) {
    // Shell out to the SAME script a human would run, rather than
    // reimplementing the fixture inside the app — one source of truth for what
    // "trial demo data" means, the same call shape /admin/demo-reset uses.
    try {
      await execFileAsync(
        process.execPath,
        [
          join(process.cwd(), "scripts", "seed-trial-fixture.mjs"),
          "--company-id",
          company.id,
          "--country",
          input.country,
          "--assessor",
          adminUserId,
        ],
        { cwd: process.cwd(), maxBuffer: 10 * 1024 * 1024 },
      );
      const site = await prisma.site.findFirst({
        where: { companyId: company.id },
        select: { id: true },
        orderBy: { createdAt: "asc" },
      });
      siteId = site?.id ?? null;
    } catch (error) {
      // The tenant exists and is usable; only its sample data failed. Surface
      // it instead of rolling back a tenant the founder may still want.
      seedError = error instanceof Error ? error.message : String(error);
      console.error(`[trial] seeding failed for ${company.id}: ${seedError}`);
    }
  } else {
    // "Leer": one site so the tenant has somewhere to start; the onboarding
    // wizard takes it from there.
    const site = await prisma.site.create({
      data: {
        companyId: company.id,
        name: `${name} — Hauptstandort`,
        country: input.country,
      },
    });
    siteId = site.id;
  }

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "trial.create",
    entityType: "Company",
    entityId: company.id,
    companyId: company.id,
    siteId,
    diff: {
      country: input.country,
      durationDays,
      withDemoData: input.withDemoData,
      expiresAt: expiresAt.toISOString(),
      seedError,
      inviteError,
    },
  });

  return {
    companyId: company.id,
    siteId,
    expiresAt,
    seeded: input.withDemoData && seedError === null,
    seedError,
    inviteError,
    adminUserId,
  };
}

// Re-apply the sample data for a seeded trial ("Zurücksetzen", A.4). Only for
// trials that STARTED from demo data — re-seeding a tenant the prospect filled
// themselves would mix fictional rows into their own work.
export async function reseedTrial(input: {
  companyId: string;
  actorUserId: string;
}): Promise<void> {
  const company = await prisma.company.findUnique({
    where: { id: input.companyId },
    select: {
      tenantKind: true,
      trialSeeded: true,
      homeCountry: true,
    },
  });
  if (!company) throw new TrialGateError("not-found");
  if (company.tenantKind !== "TRIAL") throw new TrialGateError("not-a-trial");
  if (!company.trialSeeded) throw new TrialGateError("not-seeded");

  // Attribute the re-seeded sample data to the tenant's own first admin, as the
  // original seeding did; without one there is nothing to attribute it to.
  const admin = await prisma.platformUser.findFirst({
    where: { companyId: input.companyId, role: "COMPANY_ADMIN" },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (!admin) throw new TrialGateError("no-administrator");

  await execFileAsync(
    process.execPath,
    [
      join(process.cwd(), "scripts", "seed-trial-fixture.mjs"),
      "--company-id",
      input.companyId,
      "--country",
      company.homeCountry ?? "AT",
      "--assessor",
      admin.id,
    ],
    { cwd: process.cwd(), maxBuffer: 10 * 1024 * 1024 },
  );

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "trial.reseed",
    entityType: "Company",
    entityId: input.companyId,
    companyId: input.companyId,
  });
}

// A.2: the trial admin invites colleagues with any tenant role, up to the user
// limit. Tenant-facing (the caller is a company_admin inside the app, not a
// super_admin), so the limit is enforced HERE rather than in the UI.
const TENANT_ROLES: readonly PlatformRole[] = [
  "COMPANY_ADMIN",
  "SITE_ADMIN",
  "EHS_SPECIALIST",
  "MANAGER",
  "EMPLOYEE",
  "OCCUPATIONAL_PHYSICIAN",
  "WORKS_COUNCIL",
];

export class TenantInviteError extends Error {
  constructor(
    message: string,
    readonly detail?: { limit: number; current: number },
  ) {
    super(message);
  }
}

export async function inviteTenantUser(input: {
  companyId: string;
  email: string;
  name: string;
  role: PlatformRole;
  actorUserId: string;
}): Promise<{ platformUserId: string }> {
  const email = input.email.trim();
  const name = input.name.trim();
  if (!email.includes("@")) throw new TenantInviteError("invalid-email");
  if (name.length === 0) throw new TenantInviteError("name-required");
  // Platform roles are never grantable from inside a tenant (§3 guardrail).
  if (!TENANT_ROLES.includes(input.role)) {
    throw new TenantInviteError("role-not-grantable");
  }

  const company = await prisma.company.findUnique({
    where: { id: input.companyId },
    select: { tenantKind: true },
  });
  if (!company) throw new TenantInviteError("not-found");

  const currentUsers = await prisma.platformUser.count({
    where: { companyId: input.companyId },
  });
  const limit = checkTrialUserLimit(company.tenantKind, currentUsers);
  if (!limit.ok) {
    throw new TenantInviteError("user-limit-reached", {
      limit: limit.limit,
      current: limit.current,
    });
  }

  const user = await invitePlatformUser({
    email,
    name,
    role: input.role,
    companyId: input.companyId,
  });
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "tenant.invite_user",
    entityType: "PlatformUser",
    entityId: user.id,
    companyId: input.companyId,
    diff: { role: input.role },
  });
  return { platformUserId: user.id };
}
