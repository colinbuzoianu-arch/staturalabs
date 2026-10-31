import type { ModuleKey } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { baselineModuleKeys, getModuleDefinition } from "./registry";

// Module entitlement (SLD_RESTRUCTURE_PLAN_platform-modules.md §2.4): which
// company has which module turned on. Entitlement is DATA (CompanyModule), the
// registry decides which modules are baseline (always on, no row needed).
//
// Deliberately no `import "server-only"`: these are thin gates over
// `@/lib/prisma`, unit-tested with a mocked client, same reasoning as
// action.ts / process.ts / entitlement's sibling registry.ts.
//
// WRITES are super_admin-only (§2.4). This file does not re-check the role —
// the single place that writes entitlement is a super_admin-gated surface
// under /admin (requireSuperAdmin), same division of labour as every other
// lib gate (the function enforces the invariant, the caller enforces the
// role). enable/disableModule throw on a baseline module, which has no
// entitlement row to toggle.

export async function isModuleEnabled(
  companyId: string,
  key: ModuleKey,
): Promise<boolean> {
  if (!getModuleDefinition(key).requiresEntitlement) return true;
  const row = await prisma.companyModule.findUnique({
    where: { companyId_moduleKey: { companyId, moduleKey: key } },
    select: { id: true },
  });
  return row !== null;
}

// Every module key the company may use: the baseline set (always on) plus
// every entitlement row it holds. Returned as a Set for O(1) membership in the
// sidebar/route guard.
export async function getEnabledModuleKeys(
  companyId: string,
): Promise<Set<ModuleKey>> {
  const rows = await prisma.companyModule.findMany({
    where: { companyId },
    select: { moduleKey: true },
  });
  const enabled = new Set<ModuleKey>(baselineModuleKeys());
  for (const row of rows) enabled.add(row.moduleKey);
  return enabled;
}

export async function enableModule(
  companyId: string,
  key: ModuleKey,
  enabledByUserId: string | null,
): Promise<void> {
  if (!getModuleDefinition(key).requiresEntitlement) {
    throw new Error(
      `Module ${key} is a baseline module and is always enabled — it has no entitlement row to set`,
    );
  }
  // Upsert so enabling an already-enabled module is a no-op, not a unique
  // violation — matches the migration's own ON CONFLICT DO NOTHING seed.
  await prisma.companyModule.upsert({
    where: { companyId_moduleKey: { companyId, moduleKey: key } },
    create: { companyId, moduleKey: key, enabledByUserId },
    update: {},
  });
}

export async function disableModule(
  companyId: string,
  key: ModuleKey,
): Promise<void> {
  if (!getModuleDefinition(key).requiresEntitlement) {
    throw new Error(
      `Module ${key} is a baseline module and cannot be disabled`,
    );
  }
  await prisma.companyModule.deleteMany({
    where: { companyId, moduleKey: key },
  });
}
