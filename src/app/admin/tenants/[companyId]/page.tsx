import { revalidatePath } from "next/cache";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { EntitlementToggle } from "@/components/admin/entitlement-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/field";
import {
  CompanyStatus,
  CountryCode,
  type ModuleKey,
} from "@/generated/prisma/enums";
import {
  applyTemplateToCompany,
  entitlementModuleKeys,
  toggleCompanyModule,
} from "@/lib/admin/entitlement-admin";
import {
  inviteCompanyAdmin,
  setCompanyArchived,
  setCompanyDefaults,
} from "@/lib/admin/tenant";
import { deleteTenant } from "@/lib/admin/tenant-delete";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { getAdminDictionary } from "@/lib/i18n/dictionaries/admin";
import { getLocale } from "@/lib/i18n/get-locale";
import { isLocale, LOCALE_LABELS, LOCALES } from "@/lib/i18n/locale";
import { resolveModuleLabel } from "@/lib/modules/module-labels";
import { getModuleDefinition, moduleStatus } from "@/lib/modules/registry";
import { prisma } from "@/lib/prisma";

// Per-tenant super-admin detail: the one place a tenant is managed end to end —
// module entitlements (add/remove), sites, administrators, and the archive /
// export / delete lifecycle. All writes go through the audited lib gates.
// Billing is deliberately absent (managed outside the app).
export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  await requireSuperAdmin();
  const { companyId } = await params;
  const locale = await getLocale();
  const dict = getAdminDictionary(locale);
  const t = dict.tenantDetailPage;
  const cDict = dict.companiesPage;

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      sites: { orderBy: { name: "asc" } },
      companyModules: { select: { moduleKey: true } },
      platformUsers: {
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, email: true, role: true },
      },
    },
  });
  if (!company) notFound();

  const enabled = new Set(company.companyModules.map((m) => m.moduleKey));
  const moduleKeys = entitlementModuleKeys();
  const archived = company.status === CompanyStatus.ARCHIVED;
  const countries = [...new Set(company.sites.map((s) => s.country))];

  async function toggleModuleKey(key: string, enable: boolean) {
    "use server";
    const actor = await requireSuperAdmin();
    await toggleCompanyModule({
      companyId,
      key: key as ModuleKey,
      enable,
      actorUserId: actor.id,
    });
    revalidatePath(`/admin/tenants/${companyId}`);
  }

  async function applyTemplateAction() {
    "use server";
    const actor = await requireSuperAdmin();
    await applyTemplateToCompany({ companyId, actorUserId: actor.id });
    revalidatePath(`/admin/tenants/${companyId}`);
  }

  async function saveDefaultsAction(formData: FormData) {
    "use server";
    const actor = await requireSuperAdmin();
    const language = formData.get("language");
    const home = formData.get("homeCountry");
    await setCompanyDefaults({
      companyId,
      defaultLocale:
        typeof language === "string" && isLocale(language) ? language : null,
      homeCountry:
        typeof home === "string" &&
        (Object.values(CountryCode) as string[]).includes(home)
          ? (home as CountryCode)
          : null,
      actorUserId: actor.id,
    });
    revalidatePath(`/admin/tenants/${companyId}`);
  }

  async function archiveAction() {
    "use server";
    const actor = await requireSuperAdmin();
    const current = await prisma.company.findUnique({
      where: { id: companyId },
      select: { status: true },
    });
    await setCompanyArchived({
      companyId,
      archived: current?.status !== CompanyStatus.ARCHIVED,
      actorUserId: actor.id,
    });
    revalidatePath(`/admin/tenants/${companyId}`);
  }

  async function inviteAction(formData: FormData) {
    "use server";
    const actor = await requireSuperAdmin();
    const name = formData.get("name");
    const email = formData.get("email");
    if (typeof name !== "string" || typeof email !== "string") return;
    await inviteCompanyAdmin({ companyId, name, email, actorUserId: actor.id });
    revalidatePath(`/admin/tenants/${companyId}`);
  }

  async function deleteAction(formData: FormData) {
    "use server";
    const actor = await requireSuperAdmin();
    const confirmName = formData.get("confirmName");
    if (typeof confirmName !== "string") return;
    const row = await prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true },
    });
    if (!row || row.name !== confirmName) return;
    await deleteTenant({ companyId, actorUserId: actor.id });
    redirect("/admin/tenants");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/admin/tenants"
          className="text-sm text-accent hover:underline"
        >
          ← {t.backToTenants}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold">
            {company.name}
          </h1>
          <Badge tone={archived ? "neutral" : "low"}>
            {archived ? cDict.statusArchived : cDict.statusActive}
          </Badge>
        </div>
        <p className="text-sm text-foreground-muted">
          {t.country}: {countries.length > 0 ? countries.join(", ") : "—"} ·{" "}
          {t.created}: {company.createdAt.toISOString().slice(0, 10)}
        </p>
      </div>

      {/* Settings: default language + home country */}
      <Card>
        <CardHeader title={t.settingsHeading} description={t.settingsHint} />
        <CardBody>
          <form
            action={saveDefaultsAction}
            className="flex flex-wrap items-end gap-3"
          >
            <div className="flex flex-col gap-1">
              <Label htmlFor="tenant-language">{t.languageLabel}</Label>
              <Select
                id="tenant-language"
                name="language"
                defaultValue={
                  isLocale(company.defaultLocale) ? company.defaultLocale : ""
                }
              >
                <option value="">{t.noneOption}</option>
                {LOCALES.map((l) => (
                  <option key={l} value={l}>
                    {LOCALE_LABELS[l]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="tenant-home-country">{t.homeCountryLabel}</Label>
              <Select
                id="tenant-home-country"
                name="homeCountry"
                defaultValue={company.homeCountry ?? ""}
              >
                <option value="">{t.noneOption}</option>
                {Object.values(CountryCode).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" variant="secondary">
              {t.save}
            </Button>
          </form>
        </CardBody>
      </Card>

      {/* Modules */}
      <Card>
        <CardHeader
          title={t.modulesHeading}
          description={t.modulesHint}
          action={
            <form action={applyTemplateAction}>
              <Button type="submit" variant="secondary" size="sm">
                {t.applyTemplate}
              </Button>
            </form>
          }
        />
        <CardBody>
          <ul className="grid gap-2 sm:grid-cols-2">
            {moduleKeys.map((k) => {
              const on = enabled.has(k);
              const st = moduleStatus(getModuleDefinition(k));
              const planned = st === "planned";
              return (
                <li
                  key={k}
                  className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-border px-3 py-2"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">
                      {resolveModuleLabel(getModuleDefinition(k).labelKey)}
                      {st === "beta" ? (
                        <span className="ml-1 text-xs text-foreground-subtle">
                          ({dict.entitlementsPage.beta})
                        </span>
                      ) : null}
                    </span>
                    <span className="truncate text-xs text-foreground-subtle">
                      {k}
                    </span>
                  </span>
                  <EntitlementToggle
                    appearance="button"
                    on={on}
                    moduleKey={k}
                    disabled={planned}
                    labels={{
                      enable: t.enable,
                      disable: t.disable,
                      saving: t.saving,
                      saved: t.saved,
                    }}
                    action={toggleModuleKey}
                  />
                </li>
              );
            })}
          </ul>
        </CardBody>
      </Card>

      {/* Sites */}
      <Card>
        <CardHeader
          title={t.sitesHeading}
          action={
            <Link
              href={`/admin/companies/${company.id}/sites`}
              className="text-sm text-accent hover:underline"
            >
              {t.manageSites}
            </Link>
          }
        />
        <CardBody className="p-0">
          {company.sites.length === 0 ? (
            <p className="px-5 py-4 text-sm text-foreground-muted">
              {t.noSites}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {company.sites.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
                >
                  <span className="font-medium">{s.name}</span>
                  <Badge tone="outline">{s.country}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* Administrators */}
      <Card>
        <CardHeader title={t.adminsHeading} />
        <CardBody className="flex flex-col gap-4">
          {company.platformUsers.length === 0 ? (
            <p className="text-sm text-foreground-muted">{t.noAdmins}</p>
          ) : (
            <ul className="divide-y divide-border">
              {company.platformUsers.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center justify-between gap-3 py-2 text-sm"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{u.name}</span>
                    <span className="truncate text-xs text-foreground-subtle">
                      {u.email}
                    </span>
                  </span>
                  <Badge tone="outline">{u.role}</Badge>
                </li>
              ))}
            </ul>
          )}
          <form
            action={inviteAction}
            className="flex flex-wrap items-end gap-3 border-t border-border pt-4"
          >
            <div>
              <Label htmlFor="invite-name">{cDict.inviteName}</Label>
              <Input id="invite-name" name="name" required className="w-48" />
            </div>
            <div>
              <Label htmlFor="invite-email">{cDict.inviteEmail}</Label>
              <Input
                id="invite-email"
                name="email"
                type="email"
                required
                className="w-56"
              />
            </div>
            <Button type="submit" variant="secondary">
              {cDict.inviteButton}
            </Button>
          </form>
        </CardBody>
      </Card>

      {/* Danger zone */}
      <Card className="border-status-high/40">
        <CardHeader title={t.dangerHeading} />
        <CardBody className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <form action={archiveAction}>
              <Button type="submit" variant="secondary">
                {archived ? cDict.unarchive : cDict.archive}
              </Button>
            </form>
            <a
              href={`/api/admin/companies/${company.id}/export`}
              className="text-sm text-accent hover:underline"
            >
              {cDict.exportButton}
            </a>
          </div>

          {archived ? (
            <form
              action={deleteAction}
              className="flex flex-wrap items-end gap-3 border-t border-border pt-4"
            >
              <div>
                <Label htmlFor="delete-confirm">{cDict.deleteHint}</Label>
                <Input
                  id="delete-confirm"
                  name="confirmName"
                  placeholder={company.name}
                  className="w-72"
                />
              </div>
              <Button type="submit" variant="danger">
                {cDict.deleteButton}
              </Button>
            </form>
          ) : (
            <p className="text-xs text-foreground-subtle">
              {cDict.deleteArchivedFirst}
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
