import Link from "next/link";
import { getAccessibleSites } from "@/lib/auth/accessible-sites";
import { requireAdministrationAccess } from "@/lib/auth/require-access";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";

// Landing view of the write surface (see CLAUDE.md M5): every site the
// signed-in company_admin/site_admin can write to. Reuses
// getAccessibleSites (the same function the read-only /sites landing view
// uses) rather than a parallel "which sites can I administer" query — the
// write-permission scope is identical to the read scope (canAccessSite),
// per the plan's "site_admin within assigned sites" rule.
export default async function AdministrationHome() {
  const user = await requireAdministrationAccess();
  const sites = await getAccessibleSites(user);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).administrationHome;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-12">
      <div className="flex flex-col gap-1">
        <p className="font-technical text-xs uppercase tracking-[0.2em] text-border">
          {dict.eyebrow}
        </p>
        <h1 className="font-heading text-2xl font-bold">{dict.heading}</h1>
        <p className="text-sm text-border">{dict.description}</p>
      </div>

      {sites.length === 0 && (
        <p className="text-sm text-border">{dict.empty}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sites.map((site) => (
          <Link
            key={site.id}
            href={`/administration/sites/${site.id}/org-units`}
            className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-5 transition-colors hover:border-accent"
          >
            <span className="font-heading text-lg font-bold">{site.name}</span>
            <span className="text-sm text-border">{site.company.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
