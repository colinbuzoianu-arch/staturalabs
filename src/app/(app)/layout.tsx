import type { ReactNode } from "react";
import { AppFooter } from "@/components/app-footer";
import { AppHeader } from "@/components/app-header";
import { PresentModeShell } from "@/components/present-mode-shell";
import { PlatformRole } from "@/generated/prisma/enums";
import { requireAuthenticatedUser } from "@/lib/auth/require-access";
import { getDashboardDictionary } from "@/lib/i18n/dictionaries/dashboard";
import { getLocale } from "@/lib/i18n/get-locale";

// Shell for the dashboard — role-aware, single navigation tree (see
// CLAUDE.md). Resource-level scoping is done per-page
// (requireSiteAccess/requireWorkstationAccess/requireTaskAccess/
// requireSiteAdministrationAccess); this layout only guards "signed in at
// all," so the header/footer never render for an anonymous visitor.
//
// The Administration nav link only shows for company_admin/site_admin —
// super_admin/l3_support use /admin instead and never reach this surface
// under normal routing (see requireAdministrationAccess).
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireAuthenticatedUser();
  const showAdministrationLink =
    user.role === PlatformRole.COMPANY_ADMIN ||
    user.role === PlatformRole.SITE_ADMIN;
  const locale = await getLocale();
  const exitLabel = getDashboardDictionary(locale).presentMode.exitLabel;

  return (
    <PresentModeShell
      header={<AppHeader showAdministrationLink={showAdministrationLink} />}
      footer={<AppFooter />}
      exitLabel={exitLabel}
    >
      {children}
    </PresentModeShell>
  );
}
