import "server-only";

import {
  type PlatformRole,
  PlatformRole as Role,
} from "@/generated/prisma/enums";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { prisma } from "@/lib/prisma";

// P13 §2.4 super-admin user/role management. Cross-tenant by design; audited.
// Role changes are restricted to the company-scoped roles (keeping companyId);
// granting super_admin / l3_support is NOT done here — those are company-less
// platform operators, provisioned deliberately by invite (§10), the one thing
// that must never be casual.

export const COMPANY_SCOPED_ROLES: readonly PlatformRole[] = [
  Role.COMPANY_ADMIN,
  Role.SITE_ADMIN,
  Role.EHS_SPECIALIST,
  Role.MANAGER,
  Role.EMPLOYEE,
  Role.OCCUPATIONAL_PHYSICIAN,
  Role.WORKS_COUNCIL,
];

export async function setUserDisabled(input: {
  userId: string;
  disabled: boolean;
  actorUserId: string;
}): Promise<void> {
  const user = await prisma.platformUser.findUnique({
    where: { id: input.userId },
    select: { role: true, companyId: true },
  });
  if (!user) throw new Error("User not found");
  if (user.role === Role.SUPER_ADMIN) {
    // Never disable a super_admin through this surface — it could lock the
    // platform out of its own operators (§10).
    throw new Error("A super_admin account cannot be disabled here");
  }
  await prisma.platformUser.update({
    where: { id: input.userId },
    data: {
      disabledAt: input.disabled ? new Date() : null,
      disabledByUserId: input.disabled ? input.actorUserId : null,
    },
  });
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: input.disabled ? "user.disable" : "user.enable",
    entityType: "PlatformUser",
    entityId: input.userId,
    companyId: user.companyId,
  });
}

export async function changeUserRole(input: {
  userId: string;
  role: PlatformRole;
  actorUserId: string;
}): Promise<void> {
  if (!COMPANY_SCOPED_ROLES.includes(input.role)) {
    throw new Error(`Role ${input.role} cannot be granted here`);
  }
  const user = await prisma.platformUser.findUnique({
    where: { id: input.userId },
    select: { role: true, companyId: true },
  });
  if (!user) throw new Error("User not found");
  if (!user.companyId) {
    // A company-less operator (super_admin/l3_support) can't be re-pointed into
    // a tenant role here — that would violate the role/companyId CHECK.
    throw new Error("Cannot change the role of a platform operator here");
  }
  await prisma.platformUser.update({
    where: { id: input.userId },
    data: { role: input.role },
  });
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "user.change_role",
    entityType: "PlatformUser",
    entityId: input.userId,
    companyId: user.companyId,
    diff: { from: user.role, to: input.role },
  });
}
