import type { ReactNode } from "react";
import { AppFooter } from "@/components/app-footer";
import { AppHeader } from "@/components/app-header";
import { requireAuthenticatedUser } from "@/lib/auth/require-access";

// Shell for the read-only company_admin/site_admin dashboard — role-aware,
// single navigation tree (see CLAUDE.md). Resource-level scoping is done
// per-page (requireSiteAccess/requireWorkstationAccess/requireTaskAccess);
// this layout only guards "signed in at all," so the header/footer never
// render for an anonymous visitor.
export default async function AppLayout({ children }: { children: ReactNode }) {
  await requireAuthenticatedUser();

  return (
    <div className="flex min-h-full flex-col bg-background text-foreground">
      <AppHeader />
      <main className="flex-1">{children}</main>
      <AppFooter />
    </div>
  );
}
