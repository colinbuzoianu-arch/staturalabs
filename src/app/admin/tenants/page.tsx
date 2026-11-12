import { revalidatePath } from "next/cache";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/field";
import { CompanyStatus, CountryCode } from "@/generated/prisma/enums";
import { createTenant } from "@/lib/admin/tenant";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { getAdminDictionary } from "@/lib/i18n/dictionaries/admin";
import { getLocale } from "@/lib/i18n/get-locale";
import { isLocale, LOCALE_LABELS, LOCALES } from "@/lib/i18n/locale";
import { prisma } from "@/lib/prisma";

const COUNTRIES = Object.values(CountryCode);

// Styled super-admin tenant list. Row-level management (modules, admins,
// archive, export, delete) lives in the per-tenant detail page; this surface
// is the list + create. Reuses the audited lib gates (createTenant) and the
// existing companiesPage dictionary.
export default async function TenantsPage() {
  await requireSuperAdmin();
  const locale = await getLocale();
  const dict = getAdminDictionary(locale).companiesPage;

  async function createTenantAction(formData: FormData) {
    "use server";
    const actor = await requireSuperAdmin();
    const name = formData.get("name");
    const country = formData.get("country");
    const language = formData.get("language");
    if (
      typeof name !== "string" ||
      typeof country !== "string" ||
      !(COUNTRIES as string[]).includes(country)
    ) {
      return;
    }
    await createTenant({
      name,
      country: country as CountryCode,
      defaultLocale:
        typeof language === "string" && isLocale(language) ? language : null,
      actorUserId: actor.id,
    });
    revalidatePath("/admin/tenants");
  }

  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { sites: true, companyModules: true, platformUsers: true },
      },
    },
  });
  const pilotCompanyIds = new Set(
    (
      await prisma.riskAssessment.findMany({
        where: { pilotContext: { not: null } },
        select: { site: { select: { companyId: true } } },
        distinct: ["siteId"],
      })
    ).map((r) => r.site.companyId),
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold">
        {dict.heading}
      </h1>

      <Card>
        <CardHeader title={dict.createHeading} />
        <CardBody>
          <form
            action={createTenantAction}
            className="flex flex-wrap items-end gap-3"
          >
            <div className="flex flex-col gap-1">
              <Label htmlFor="tenant-name">{dict.namePlaceholder}</Label>
              <Input id="tenant-name" name="name" required className="w-64" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="tenant-country">{dict.countryLabel}</Label>
              <Select id="tenant-country" name="country">
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="tenant-language">{dict.languageLabel}</Label>
              <Select id="tenant-language" name="language" defaultValue="de">
                {LOCALES.map((l) => (
                  <option key={l} value={l}>
                    {LOCALE_LABELS[l]}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit">{dict.createTenant}</Button>
          </form>
        </CardBody>
      </Card>

      {companies.length === 0 ? (
        <p className="text-sm text-foreground-muted">{dict.empty}</p>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-foreground-subtle">
                  <th className="px-5 py-3 font-medium">{dict.colName}</th>
                  <th className="px-3 py-3 font-medium">{dict.colStatus}</th>
                  <th className="px-3 py-3 font-medium">{dict.colMarker}</th>
                  <th className="px-3 py-3 text-right font-medium">
                    {dict.colSites}
                  </th>
                  <th className="px-3 py-3 text-right font-medium">
                    {dict.colModules}
                  </th>
                  <th className="px-5 py-3 text-right font-medium">
                    {dict.colUsers}
                  </th>
                </tr>
              </thead>
              <tbody>
                {companies.map((co) => {
                  const isDemo = co.name.startsWith("DEMO —");
                  const isPilot = pilotCompanyIds.has(co.id);
                  const archived = co.status === CompanyStatus.ARCHIVED;
                  return (
                    <tr
                      key={co.id}
                      className="border-b border-border last:border-0 hover:bg-surface"
                    >
                      <td className="px-5 py-3">
                        <Link
                          href={`/admin/tenants/${co.id}`}
                          className="font-medium text-foreground hover:text-accent"
                        >
                          {co.name}
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone={archived ? "neutral" : "low"}>
                          {archived ? dict.statusArchived : dict.statusActive}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-foreground-muted">
                        {isDemo ? (
                          <Badge tone="info">{dict.markerDemo}</Badge>
                        ) : isPilot ? (
                          <Badge tone="outline">{dict.markerPilot}</Badge>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {co._count.sites}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {co._count.companyModules}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums">
                        {co._count.platformUsers}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
