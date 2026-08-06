import Link from "next/link";
import type { ReactNode } from "react";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";

// Shared gate + section nav for every page under
// (app)/administration/sites/[siteId]/**. requireSiteAdministrationAccess
// 404s (never redirects) on a site the signed-in company_admin/site_admin
// can't write to, same fail-closed pattern as requireSiteAccess on the
// read-only dashboard.
export default async function SiteAdministrationLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const { site } = await requireSiteAdministrationAccess(siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).siteAdminNav;

  const sections = [
    { href: `/administration/sites/${siteId}/org-units`, label: dict.orgUnits },
    {
      href: `/administration/sites/${siteId}/processes`,
      label: dict.processes,
    },
    { href: `/administration/sites/${siteId}/hazards`, label: dict.hazards },
    {
      href: `/administration/sites/${siteId}/risk-assessments`,
      label: dict.riskAssessments,
    },
    { href: `/administration/sites/${siteId}/actions`, label: dict.actions },
    {
      href: `/administration/sites/${siteId}/floor-plans`,
      label: dict.floorPlans,
    },
  ];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-12">
      <p className="text-sm text-border">
        <Link href="/administration" className="hover:text-accent">
          {dict.breadcrumbAdministration}
        </Link>{" "}
        / {site.name}
      </p>

      <nav className="flex flex-wrap gap-2 border-b border-border pb-4 text-sm">
        {sections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="rounded border border-border px-3 py-1 transition-colors hover:border-accent"
          >
            {section.label}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  );
}
