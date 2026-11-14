import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { type AdminNavItem, AdminShell } from "@/components/admin/admin-shell";
import { mfaRedirectTarget } from "@/lib/auth/mfa";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { getAdminDictionary } from "@/lib/i18n/dictionaries/admin";
import { getLocale } from "@/lib/i18n/get-locale";

// Internal, super_admin-only console: cross-tenant management (tenants,
// module entitlements, catalogues, users, audit, feature flags, demo tools).
// The bare underline-link layout this used to ship with was restyled into a
// real control panel (AdminShell) — see CLAUDE.md. Billing is deliberately not
// surfaced anywhere here; it is managed outside the app.
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireSuperAdmin();
  // P13 §4: super_admin is the most powerful account — enforce MFA step-up here
  // too (the /security/mfa page lives outside this layout, so no redirect loop).
  const mfaTarget = await mfaRedirectTarget(user);
  if (mfaTarget) redirect(mfaTarget);

  const locale = await getLocale();
  const dict = getAdminDictionary(locale);
  const l = dict.layout;

  const nav: AdminNavItem[] = [
    { href: "/admin", label: l.overviewNav },
    { href: "/admin/tenants", label: l.companiesNav },
    { href: "/admin/entitlements", label: l.entitlementsNav },
    { href: "/admin/catalogues", label: l.cataloguesNav },
    { href: "/admin/users", label: l.usersNav },
    { href: "/admin/audit", label: l.auditNav },
    { href: "/admin/flags", label: l.flagsNav },
    { href: "/admin/ai-usage", label: l.aiUsageNav },
    { href: "/admin/engine-sandbox", label: l.engineSandboxNav },
    { href: "/admin/pilot-data", label: l.pilotNav },
    { href: "/admin/demo-reset", label: l.demoResetNav },
  ];

  return (
    <AdminShell title={l.title} nav={nav}>
      {children}
    </AdminShell>
  );
}
