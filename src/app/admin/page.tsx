import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CompanyStatus } from "@/generated/prisma/enums";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { getAdminDictionary } from "@/lib/i18n/dictionaries/admin";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";

// Super-admin landing: a real overview (tenant/site/user/module counts +
// recent tenants) instead of the old redirect to the bare companies list.
// This is where the founder lands on sign-in (super_admin is routed here).
export default async function AdminOverviewPage() {
  await requireSuperAdmin();
  const locale = await getLocale();
  const dict = getAdminDictionary(locale);
  const c = dict.console;

  const [active, archived, sites, users, moduleGrants, recent] =
    await Promise.all([
      prisma.company.count({ where: { status: CompanyStatus.ACTIVE } }),
      prisma.company.count({ where: { status: CompanyStatus.ARCHIVED } }),
      prisma.site.count(),
      prisma.platformUser.count(),
      prisma.companyModule.count(),
      prisma.company.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        include: {
          _count: { select: { sites: true, companyModules: true } },
        },
      }),
    ]);

  const stats: { label: string; value: number }[] = [
    { label: c.tenantsStat, value: active + archived },
    { label: c.activeStat, value: active },
    { label: c.archivedStat, value: archived },
    { label: c.sitesStat, value: sites },
    { label: c.usersStat, value: users },
    { label: c.modulesStat, value: moduleGrants },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold">
            {c.heading}
          </h1>
          <p className="max-w-2xl text-sm text-foreground-muted">
            {c.subheading}
          </p>
        </div>
        <Link
          href="/admin/tenants"
          className="inline-flex h-10 items-center rounded-[var(--radius-md)] bg-accent px-4 text-sm font-medium text-white hover:brightness-110"
        >
          {c.manageTenants}
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardBody className="flex flex-col gap-1">
              <span className="font-[family-name:var(--font-heading)] text-3xl font-bold tabular-nums">
                {s.value}
              </span>
              <span className="text-xs text-foreground-subtle">{s.label}</span>
            </CardBody>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader
          title={c.recentTenants}
          action={
            <Link
              href="/admin/tenants"
              className="text-sm text-accent hover:underline"
            >
              {c.viewAllTenants}
            </Link>
          }
        />
        <CardBody className="p-0">
          {recent.length === 0 ? (
            <p className="px-5 py-4 text-sm text-foreground-muted">
              {c.noTenants}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/admin/tenants/${t.id}`}
                    className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-surface"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-medium">{t.name}</span>
                      {t.status === CompanyStatus.ARCHIVED ? (
                        <Badge tone="neutral">{c.archivedStat}</Badge>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-xs text-foreground-subtle">
                      {t._count.sites} · {t._count.companyModules}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <p className="text-xs text-foreground-subtle">{c.billingNote}</p>
    </div>
  );
}
