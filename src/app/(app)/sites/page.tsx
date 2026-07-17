import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PlatformRole } from "@/generated/prisma/enums";
import { getAccessibleSites } from "@/lib/auth/accessible-sites";
import { requireAuthenticatedUser } from "@/lib/auth/require-access";
import { getDashboardDictionary } from "@/lib/i18n/dictionaries/dashboard";
import { getLocale } from "@/lib/i18n/get-locale";

// Landing view of the read-only dashboard: every site the signed-in user
// can access (one for most site_admins, potentially many for a
// company_admin) — drill-down from here into workstations, then tasks,
// then a task's assessment history. super_admin/l3_support keep using the
// internal /admin tool instead (see CLAUDE.md).
//
// Lives at /sites, not /: root is now the public marketing page
// (src/app/page.tsx) — this is the authenticated home instead, fitting the
// existing /sites/[siteId] detail-page pattern (list + detail under the
// same segment) rather than introducing a new "dashboard" concept.
export default async function DashboardHome() {
  const user = await requireAuthenticatedUser();

  if (
    user.role === PlatformRole.SUPER_ADMIN ||
    user.role === PlatformRole.L3_SUPPORT
  ) {
    redirect("/admin");
  }

  const sites = await getAccessibleSites(user);
  const locale = await getLocale();
  const dict = getDashboardDictionary(locale).sitesPage;

  return (
    <div className="relative">
      {/* Decorative only, landing view only (see CLAUDE.md) — SVGs gain
          nothing from Next's raster optimization pipeline, so unoptimized
          rather than fighting next.config for SVG passthrough. */}
      <Image
        src="/bg/statura_bg_dark.svg"
        alt=""
        aria-hidden="true"
        fill
        unoptimized
        className="theme-bg-dark pointer-events-none -z-10 object-cover opacity-[0.12]"
      />
      <Image
        src="/bg/statura_bg_light.svg"
        alt=""
        aria-hidden="true"
        fill
        unoptimized
        className="theme-bg-light pointer-events-none -z-10 object-cover opacity-[0.12]"
      />

      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-12">
        <div className="flex flex-col gap-1">
          <p className="font-technical text-xs uppercase tracking-[0.2em] text-border">
            {dict.eyebrow}
          </p>
          <h1 className="font-heading text-2xl font-bold">{dict.heading}</h1>
        </div>

        {sites.length === 0 && (
          <p className="text-sm text-border">{dict.empty}</p>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sites.map((site) => (
            <Link
              key={site.id}
              href={`/sites/${site.id}`}
              className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-5 transition-colors hover:border-accent"
            >
              <span className="font-heading text-lg font-bold">
                {site.name}
              </span>
              <span className="text-sm text-border">{site.company.name}</span>
              {site.address && (
                <span className="text-sm text-border">{site.address}</span>
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
