import type { ReactNode } from "react";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";

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

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-8">
      <nav className="text-sm">
        <a href="/admin/companies" className="underline">
          Companies
        </a>
      </nav>
      {children}
    </div>
  );
}
