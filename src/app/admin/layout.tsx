import type { ReactNode } from "react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { getAdminDictionary } from "@/lib/i18n/dictionaries/admin";
import { getLocale } from "@/lib/i18n/get-locale";

// Internal, super_admin-only tool: minimal CRUD to unblock manual testing
// (create the Company -> Site -> Workstation -> Task chain without hand-
// editing scripts/seed-dev-fixture.mjs) and a results view detailed enough
// to replace one-off diagnostic scripts after a capture. Deliberately not
// styled and not scoped for company_admin/site_admin — see CLAUDE.md.
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireSuperAdmin();
  const locale = await getLocale();
  const dict = getAdminDictionary(locale);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-8">
      <nav className="flex items-center justify-between text-sm">
        <div className="flex gap-4">
          <a href="/admin/companies" className="underline">
            {dict.layout.companiesNav}
          </a>
          <a href="/admin/demo-reset" className="underline">
            {dict.layout.demoResetNav}
          </a>
        </div>
        {/* Upper-right corner, same as every other page — the one piece of
            chrome this deliberately-unstyled tool gets, since the language
            switch was asked for on every page without exception. */}
        <LanguageSwitcher />
      </nav>
      {children}
    </div>
  );
}
