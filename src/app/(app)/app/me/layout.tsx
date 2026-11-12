import type { ReactNode } from "react";
import { AppFooter } from "@/components/app-footer";
import { AppHeader } from "@/components/app-header";
import { AppShell } from "@/components/sidebar/app-shell";
import { getAccessibleSites } from "@/lib/auth/accessible-sites";
import { requireAuthenticatedUser } from "@/lib/auth/require-access";
import { getDashboardDictionary } from "@/lib/i18n/dictionaries/dashboard";
import { getLocale } from "@/lib/i18n/get-locale";
import { resolveShellModuleKeys } from "@/lib/modules/shell-modules";

// Meine Aufgaben (SLD_RESTRUCTURE_PLAN_platform-modules.md §2.1, §7) is the one
// cross-site surface — a personal inbox spanning every site the user can access
// — so it keeps its /app/me URL. It renders inside the SAME sidebar shell as the
// rest of the app (so the left menu is present and consistent), using the user's
// first accessible site as the sidebar's navigation context; the sidebar's own
// SiteSwitcher lets them move between sites. A user with no accessible site
// (e.g. a self-scoped employee) falls back to the header chrome.
export default async function MeLayout({ children }: { children: ReactNode }) {
  const user = await requireAuthenticatedUser();
  const sites = await getAccessibleSites(user);

  if (sites.length > 0) {
    const homeSite = sites[0];
    const enabledKeys = await resolveShellModuleKeys(user, homeSite.companyId);
    const locale = await getLocale();
    const exitLabel = getDashboardDictionary(locale).presentMode.exitLabel;
    return (
      <AppShell
        siteId={homeSite.id}
        enabledKeys={enabledKeys}
        badges={{}}
        exitLabel={exitLabel}
      >
        {children}
      </AppShell>
    );
  }

  // Fallback: no site to anchor the sidebar — header chrome only.
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <AppHeader />
      <main className="flex-1 px-6 py-8">{children}</main>
      <AppFooter />
    </div>
  );
}
