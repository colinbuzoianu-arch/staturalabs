import "server-only";

import type { ModuleKey } from "@/generated/prisma/enums";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { disableModule, enableModule } from "@/lib/modules/entitlement";
import {
  getModuleDefinition,
  MODULE_REGISTRY,
  moduleStatus,
} from "@/lib/modules/registry";
import { prisma } from "@/lib/prisma";

// P13 §2.2 super-admin module entitlement. All actions are super_admin-only
// (enforced at the page/action) and audited. Respects the registry lifecycle:
// a `planned` module can never be unlocked; `beta`/`stable` can.

// The entitlement-requiring modules (the matrix columns; baseline modules are
// always on and never toggled).
export function entitlementModuleKeys(): ModuleKey[] {
  return MODULE_REGISTRY.filter((m) => m.requiresEntitlement).map((m) => m.key);
}

export async function getDefaultTemplateKeys(): Promise<ModuleKey[]> {
  const rows = await prisma.defaultEntitlementModule.findMany({
    select: { moduleKey: true },
  });
  return rows.map((r) => r.moduleKey);
}

export async function setDefaultTemplateKey(input: {
  key: ModuleKey;
  on: boolean;
  actorUserId: string;
}): Promise<void> {
  const def = getModuleDefinition(input.key);
  if (!def.requiresEntitlement) {
    throw new Error(
      `${input.key} is a baseline module — not part of the template`,
    );
  }
  if (input.on && moduleStatus(def) === "planned") {
    throw new Error(`${input.key} is planned and cannot be enabled`);
  }
  if (input.on) {
    await prisma.defaultEntitlementModule.upsert({
      where: { moduleKey: input.key },
      create: { moduleKey: input.key },
      update: {},
    });
  } else {
    await prisma.defaultEntitlementModule.deleteMany({
      where: { moduleKey: input.key },
    });
  }
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "entitlement_template.set",
    entityType: "DefaultEntitlementModule",
    entityId: input.key,
    diff: { on: input.on },
  });
}

// Toggle one module for one tenant. Enabling a `planned` module is refused.
export async function toggleCompanyModule(input: {
  companyId: string;
  key: ModuleKey;
  enable: boolean;
  actorUserId: string;
}): Promise<void> {
  const def = getModuleDefinition(input.key);
  if (!def.requiresEntitlement) {
    throw new Error(`${input.key} is a baseline module — always on`);
  }
  if (input.enable && moduleStatus(def) === "planned") {
    throw new Error(`${input.key} is planned and cannot be unlocked`);
  }
  if (input.enable) {
    await enableModule(input.companyId, input.key, input.actorUserId);
  } else {
    await disableModule(input.companyId, input.key);
  }
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: input.enable ? "entitlement.enable" : "entitlement.disable",
    entityType: "CompanyModule",
    entityId: input.key,
    companyId: input.companyId,
    diff: { module: input.key, enabled: input.enable },
  });
}

// Apply the default template to a tenant (used at creation and for bulk apply).
// Enables each template module that is entitlement-requiring and not planned;
// never disables anything already on (additive).
export async function applyTemplateToCompany(input: {
  companyId: string;
  actorUserId: string;
}): Promise<void> {
  const keys = await getDefaultTemplateKeys();
  for (const key of keys) {
    const def = getModuleDefinition(key);
    if (!def.requiresEntitlement || moduleStatus(def) === "planned") continue;
    await enableModule(input.companyId, key, input.actorUserId);
  }
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "entitlement_template.apply",
    entityType: "Company",
    entityId: input.companyId,
    companyId: input.companyId,
    diff: { modules: keys },
  });
}
