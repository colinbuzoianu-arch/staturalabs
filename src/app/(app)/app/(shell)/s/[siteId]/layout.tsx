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
// module list is the registry filtered by entitlement (CompanyModule),
// permission (the role's bundle) AND whether the module is actually built
// yet — the §2.4 contract. The not-yet-built modules (my-tasks, inspections,
// incidents, chemicals, training, people, legal, documents) are hidden until
// their own phases (P5–P12) build them; add each to BUILT_MODULES then.
const BUILT_MODULES: ReadonlySet<ModuleKey> = new Set<ModuleKey>([
  "COCKPIT",
  "MY_TASKS",
  "RISK",
  "ENVIRONMENT",
  "ACTIONS",
  "REPORTS",
  "SETTINGS",
  "DOCUMENTS",
  "PEOPLE",
  "TRAINING",
]);

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
    (m) =>
      BUILT_MODULES.has(m.key) &&
      entitled.has(m.key) &&
      hasPermission(user, m.permission),
  ).map((m) => m.key);

  const locale = await getLocale();
  const exitLabel = getDashboardDictionary(locale).presentMode.exitLabel;

  return (
    <AppShell
      siteId={siteId}
      enabledKeys={enabledKeys}
      badges={{}}
      exitLabel={exitLabel}
    >
      {children}
    </AppShell>
  );
}
