import type { ReactNode } from "react";
import { AppShell } from "@/components/sidebar/app-shell";
import { hasPermission } from "@/lib/auth/permissions";
import { requireSiteAccess } from "@/lib/auth/require-access";
import { getDashboardDictionary } from "@/lib/i18n/dictionaries/dashboard";
import { getLocale } from "@/lib/i18n/get-locale";
import { getEnabledModuleKeys } from "@/lib/modules/entitlement";
import { MODULE_REGISTRY, type ModuleKey } from "@/lib/modules/registry";

// Site-scoped sidebar shell (SLD_RESTRUCTURE_PLAN_platform-modules.md §5.1).
// requireSiteAccess does auth + per-site scoping (404 on an inaccessible
// site — same fail-closed behaviour as the rest of the app). The sidebar's
// module list is the registry filtered by entitlement (CompanyModule) AND
// permission (the role's bundle), exactly the §2.4 contract.
//
// MIGRATED_MODULES grows one entry per module-migration commit; until a
// module's pages live under this shell, its sidebar entry renders disabled so
// nothing links to a page that doesn't exist yet. When the last module moves,
// drop this and the (legacy) group.
const MIGRATED_MODULES: readonly ModuleKey[] = [
  "COCKPIT",
  "RISK",
  "ENVIRONMENT",
  "ACTIONS",
];

export default async function SiteShellLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const { user, site } = await requireSiteAccess(siteId);

  const entitled = await getEnabledModuleKeys(site.companyId);
  const enabledKeys = MODULE_REGISTRY.filter(
    (m) => entitled.has(m.key) && hasPermission(user, m.permission),
  ).map((m) => m.key);

  const locale = await getLocale();
  const exitLabel = getDashboardDictionary(locale).presentMode.exitLabel;

  return (
    <AppShell
      siteId={siteId}
      enabledKeys={enabledKeys}
      migratedKeys={MIGRATED_MODULES}
      badges={{}}
      exitLabel={exitLabel}
    >
      {children}
    </AppShell>
  );
}
