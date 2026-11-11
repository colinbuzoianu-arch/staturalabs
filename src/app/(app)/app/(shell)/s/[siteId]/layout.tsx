import type { ReactNode } from "react";
import { AppShell } from "@/components/sidebar/app-shell";
import { getAccessibleSites } from "@/lib/auth/accessible-sites";
import { requireSiteAccess } from "@/lib/auth/require-access";
import { getDashboardDictionary } from "@/lib/i18n/dictionaries/dashboard";
import { getLocale } from "@/lib/i18n/get-locale";
import { resolveShellModuleKeys } from "@/lib/modules/shell-modules";

// Site-scoped sidebar shell (SLD_RESTRUCTURE_PLAN_platform-modules.md §5.1).
// requireSiteAccess does auth + per-site scoping (404 on an inaccessible
// site — same fail-closed behaviour as the rest of the app). The sidebar's
// module list comes from resolveShellModuleKeys (built ∩ entitled ∩ permitted),
// shared with the cross-site Meine-Aufgaben surface so the two can't drift.
export default async function SiteShellLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const { user, site } = await requireSiteAccess(siteId);

  const enabledKeys = await resolveShellModuleKeys(user, site.companyId);

  // The sites the signed-in user may switch to (same source as the /app/sites
  // chooser), serialised to the minimum the sidebar switcher needs.
  const sites = (await getAccessibleSites(user)).map((s) => ({
    id: s.id,
    name: s.name,
    country: s.country,
  }));

  const locale = await getLocale();
  const exitLabel = getDashboardDictionary(locale).presentMode.exitLabel;

  return (
    <AppShell
      siteId={siteId}
      enabledKeys={enabledKeys}
      sites={sites}
      badges={{}}
      exitLabel={exitLabel}
    >
      {children}
    </AppShell>
  );
}
