import "server-only";

import type { PlatformUserModel } from "@/generated/prisma/models";
import { hasPermission } from "@/lib/auth/permissions";
import { getEnabledModuleKeys } from "@/lib/modules/entitlement";
import { MODULE_REGISTRY, type ModuleKey } from "@/lib/modules/registry";

// The set of modules whose routes are actually built (§2.4 contract). A module
// shows in the sidebar only when it is BUILT ∩ entitled ∩ permitted — unbuilt
// modules are hidden, never shown as a dead link. Shared by the site shell and
// the cross-site Meine-Aufgaben surface so the two can't drift.
export const BUILT_MODULES: ReadonlySet<ModuleKey> = new Set<ModuleKey>([
  "COCKPIT",
  "MY_TASKS",
  "CALENDAR",
  "RISK",
  "ENVIRONMENT",
  "ACTIONS",
  "REPORTS",
  "SETTINGS",
  "DOCUMENTS",
  "PEOPLE",
  "TRAINING",
  "CHEMICALS",
  "INSPECTIONS",
  "INCIDENTS",
  "LEGAL",
]);

// Resolve the sidebar's module list for a user in a company: registry filtered
// by built ∩ entitlement (CompanyModule) ∩ permission (the role's bundle).
export async function resolveShellModuleKeys(
  user: Pick<PlatformUserModel, "role">,
  companyId: string,
): Promise<ModuleKey[]> {
  const entitled = await getEnabledModuleKeys(companyId);
  return MODULE_REGISTRY.filter(
    (m) =>
      BUILT_MODULES.has(m.key) &&
      entitled.has(m.key) &&
      hasPermission(user, m.permission),
  ).map((m) => m.key);
}
