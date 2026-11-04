import type { PlatformRole, ScopeType } from "@/generated/prisma/enums";
import type { RoleAssignmentModel } from "@/generated/prisma/models";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { prisma } from "@/lib/prisma";

// P7d §B.3: grant / revoke role assignments. Every grant and revoke writes an
// AuditEvent. Scope shape is validated here (mirrors the DB CHECK) so a bad
// combination is a clean error, not a raw constraint violation. No
// `import "server-only"` — unit-testable; the pages gate the caller.

const SCOPE_NEEDS_ID: Record<ScopeType, boolean> = {
  COMPANY: false,
  SELF: false,
  SITE: true,
  ORG_UNIT: true,
};

export function validateScopeShape(
  scopeType: ScopeType,
  scopeId: string | null,
): void {
  const needsId = SCOPE_NEEDS_ID[scopeType];
  if (needsId && !scopeId) {
    throw new Error(`Scope ${scopeType} requires a target`);
  }
  if (!needsId && scopeId) {
    throw new Error(`Scope ${scopeType} must not carry a target`);
  }
}

export async function grantRole(input: {
  platformUserId: string;
  role: PlatformRole;
  scopeType: ScopeType;
  scopeId: string | null;
  grantedByUserId: string;
  companyId?: string | null;
}): Promise<RoleAssignmentModel> {
  validateScopeShape(input.scopeType, input.scopeId);
  const row = await prisma.roleAssignment.create({
    data: {
      platformUserId: input.platformUserId,
      role: input.role,
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      grantedByUserId: input.grantedByUserId,
    },
  });
  await recordAuditEvent({
    actorUserId: input.grantedByUserId,
    action: "role.grant",
    entityType: "RoleAssignment",
    entityId: row.id,
    companyId: input.companyId ?? null,
    diff: {
      targetUser: input.platformUserId,
      role: input.role,
      scopeType: input.scopeType,
      scopeId: input.scopeId,
    },
  });
  return row;
}

// Revoke keeps history (sets revokedAt), never deletes (§B.3). No-op if the
// assignment is already revoked or doesn't exist.
export async function revokeRoleAssignment(
  roleAssignmentId: string,
  actorUserId: string,
  companyId?: string | null,
): Promise<void> {
  const res = await prisma.roleAssignment.updateMany({
    where: { id: roleAssignmentId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (res.count > 0) {
    await recordAuditEvent({
      actorUserId,
      action: "role.revoke",
      entityType: "RoleAssignment",
      entityId: roleAssignmentId,
      companyId: companyId ?? null,
    });
  }
}
