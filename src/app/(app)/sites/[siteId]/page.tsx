import Link from "next/link";
import { requireSiteAccess } from "@/lib/auth/require-access";
import { getDashboardDictionary } from "@/lib/i18n/dictionaries/dashboard";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";

export default async function SiteWorkstationsPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const { site } = await requireSiteAccess(siteId);

  const workstations = await prisma.workstation.findMany({
    where: { siteId },
    orderBy: { name: "asc" },
  });

  const locale = await getLocale();
  const dict = getDashboardDictionary(locale).siteDetailPage;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-12">
      <Breadcrumb site={site} sitesLabel={dict.breadcrumbSites} />

      <div className="flex flex-col gap-1">
        <p className="font-technical text-xs uppercase tracking-[0.2em] text-border">
          {dict.eyebrow}
        </p>
        <h1 className="font-heading text-2xl font-bold">{site.name}</h1>
      </div>

      {workstations.length === 0 && (
        <p className="text-sm text-border">{dict.empty}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {workstations.map((workstation) => (
          <Link
            key={workstation.id}
            href={`/workstations/${workstation.id}`}
            className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-5 transition-colors hover:border-accent"
          >
            <span className="font-heading text-lg font-bold">
              {workstation.name}
            </span>
            {workstation.location && (
              <span className="text-sm text-border">
                {workstation.location}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

function Breadcrumb({
  site,
  sitesLabel,
}: {
  site: { name: string };
  sitesLabel: string;
}) {
  return (
    <p className="text-sm text-border">
      <Link href="/sites" className="hover:text-accent">
        {sitesLabel}
      </Link>{" "}
      / {site.name}
    </p>
  );
}
