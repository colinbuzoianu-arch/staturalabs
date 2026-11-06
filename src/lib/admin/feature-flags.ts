import "server-only";

import { recordAuditEvent } from "@/lib/audit/audit-event";
import { prisma } from "@/lib/prisma";

// P13 §2.5: feature-flag resolution + super-admin management. A per-company row
// overrides the global (companyId null) default; absent entirely ⇒ false.

export async function isFeatureEnabled(
  key: string,
  companyId: string | null,
): Promise<boolean> {
  if (companyId) {
    const perCompany = await prisma.featureFlag.findUnique({
      where: { key_companyId: { key, companyId } },
      select: { enabled: true },
    });
    if (perCompany) return perCompany.enabled;
  }
  const global = await prisma.featureFlag.findFirst({
    where: { key, companyId: null },
    select: { enabled: true },
  });
  return global?.enabled ?? false;
}

export async function setFeatureFlag(input: {
  key: string;
  companyId: string | null;
  enabled: boolean;
  actorUserId: string;
}): Promise<void> {
  const key = input.key.trim();
  if (key.length === 0) throw new Error("Flag key is required");
  // Can't rely on a unique upsert for the null-companyId (global) row (Postgres
  // treats NULLs as distinct in the unique index), so find-then-write.
  const existing = await prisma.featureFlag.findFirst({
    where: { key, companyId: input.companyId },
    select: { id: true },
  });
  if (existing) {
    await prisma.featureFlag.update({
      where: { id: existing.id },
      data: { enabled: input.enabled, setByUserId: input.actorUserId },
    });
  } else {
    await prisma.featureFlag.create({
      data: {
        key,
        companyId: input.companyId,
        enabled: input.enabled,
        setByUserId: input.actorUserId,
      },
    });
  }
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "feature_flag.set",
    entityType: "FeatureFlag",
    entityId: key,
    companyId: input.companyId,
    diff: { key, enabled: input.enabled },
  });
}
