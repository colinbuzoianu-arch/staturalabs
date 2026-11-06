import "server-only";

import type { CountryCode } from "@/generated/prisma/enums";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { invitePlatformUser } from "@/lib/auth/invite";
import { prisma } from "@/lib/prisma";
import { applyTemplateToCompany } from "./entitlement-admin";

// P13 §2.1 super-admin tenant management. These actions cross tenants by design
// (that is the whole point of the super_admin role); the AuditEvent trail is
// the control. Callers must be super_admin (enforced by requireSuperAdmin in
// every /admin page and Server Action).

export async function createTenant(input: {
  name: string;
  country: CountryCode;
  firstSiteName?: string | null;
  actorUserId: string;
}): Promise<{ companyId: string; siteId: string }> {
  if (input.name.trim().length === 0)
    throw new Error("Company name is required");
  const result = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: { name: input.name.trim() },
    });
    const site = await tx.site.create({
      data: {
        companyId: company.id,
        name:
          input.firstSiteName?.trim() || `${input.name.trim()} — Hauptstandort`,
        country: input.country,
      },
    });
    return { companyId: company.id, siteId: site.id };
  });
  // Apply the default entitlement template to the new tenant (§2.2).
  await applyTemplateToCompany({
    companyId: result.companyId,
    actorUserId: input.actorUserId,
  });
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "tenant.create",
    entityType: "Company",
    entityId: result.companyId,
    companyId: result.companyId,
    siteId: result.siteId,
    diff: { name: input.name.trim(), country: input.country },
  });
  return result;
}

export async function setCompanyArchived(input: {
  companyId: string;
  archived: boolean;
  actorUserId: string;
}): Promise<void> {
  await prisma.company.update({
    where: { id: input.companyId },
    data: {
      status: input.archived ? "ARCHIVED" : "ACTIVE",
      archivedAt: input.archived ? new Date() : null,
      archivedByUserId: input.archived ? input.actorUserId : null,
    },
  });
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: input.archived ? "tenant.archive" : "tenant.unarchive",
    entityType: "Company",
    entityId: input.companyId,
    companyId: input.companyId,
  });
}

// Invite the first (or another) company_admin for a tenant. Reuses the one
// invite path (Supabase invite email + PlatformUser row). Audited.
export async function inviteCompanyAdmin(input: {
  companyId: string;
  email: string;
  name: string;
  actorUserId: string;
}): Promise<void> {
  if (input.email.trim().length === 0 || input.name.trim().length === 0) {
    throw new Error("Name and email are required");
  }
  const user = await invitePlatformUser({
    email: input.email.trim(),
    name: input.name.trim(),
    role: "COMPANY_ADMIN",
    companyId: input.companyId,
  });
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "tenant.invite_admin",
    entityType: "PlatformUser",
    entityId: user.id,
    companyId: input.companyId,
    diff: { role: "COMPANY_ADMIN" },
  });
}
