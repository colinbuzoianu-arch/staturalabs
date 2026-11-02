import type { ReactNode } from "react";
import { AppFooter } from "@/components/app-footer";
import { AppHeader } from "@/components/app-header";
import { PresentModeShell } from "@/components/present-mode-shell";
import { PlatformRole } from "@/generated/prisma/enums";
import { requireAuthenticatedUser } from "@/lib/auth/require-access";
import { getDashboardDictionary } from "@/lib/i18n/dictionaries/dashboard";
import { getLocale } from "@/lib/i18n/get-locale";

// Header chrome for pages not yet migrated into the sidebar shell
// (SLD_RESTRUCTURE_PLAN_platform-modules.md §5, P2 incremental migration).
// This is the previous (app)/layout behaviour, moved into a path-transparent
// route group so migrated pages (under (shell)/) get the sidebar instead while
// everything else keeps working unchanged. As each module migrates, its pages
// move from here into (shell)/; when the last one moves this layout is deleted.
export default async function LegacyLayout({
  children,
}: {
  children: ReactNode;
}) {
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
