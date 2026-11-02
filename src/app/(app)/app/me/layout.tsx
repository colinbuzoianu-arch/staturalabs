import type { ReactNode } from "react";
import { AppFooter } from "@/components/app-footer";
import { AppHeader } from "@/components/app-header";
import { PlatformRole } from "@/generated/prisma/enums";
import { requireAuthenticatedUser } from "@/lib/auth/require-access";

// Meine Aufgaben (SLD_RESTRUCTURE_PLAN_platform-modules.md §2.1, §7) is the
// one cross-site surface — a personal inbox spanning every site the user can
// access — so it lives at /app/me, outside the site-scoped sidebar shell.
// Rather than a second sidebar, it reuses the header chrome (brand, the site
// chooser link, language/theme, sign-out), which is exactly the cross-site
// navigation this page needs.
export default async function MeLayout({ children }: { children: ReactNode }) {
  const user = await requireAuthenticatedUser();
  const showAdministrationLink =
    user.role === PlatformRole.COMPANY_ADMIN ||
    user.role === PlatformRole.SITE_ADMIN;
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <AppHeader showAdministrationLink={showAdministrationLink} />
      <main className="flex-1 px-6 py-8">{children}</main>
      <AppFooter />
    </div>
  );
}
