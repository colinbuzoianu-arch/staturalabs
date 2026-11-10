import { revalidatePath } from "next/cache";
import Link from "next/link";
import { CountryCode } from "@/generated/prisma/enums";
import {
  createTenant,
  inviteCompanyAdmin,
  setCompanyArchived,
} from "@/lib/admin/tenant";
import { deleteTenant } from "@/lib/admin/tenant-delete";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { getAdminDictionary } from "@/lib/i18n/dictionaries/admin";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";

const COUNTRIES = Object.values(CountryCode);

// P13 §2.1: super-admin tenant console. Lists every company with its site /
// module / user counts, demo/pilot marker and archived state; creates a tenant
// (name + first-site country), archives/unarchives, and invites the first
// company_admin. Every mutation is audited (see the lib gates). Plain styling,
// same as the rest of /admin.
export default async function CompaniesPage() {
  await requireSuperAdmin();
  const locale = await getLocale();
  const dict = getAdminDictionary(locale).companiesPage;

  async function createTenantAction(formData: FormData) {
    "use server";
    const actor = await requireSuperAdmin();
    const name = formData.get("name");
    const country = formData.get("country");
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
      actorUserId: actor.id,
    });
    revalidatePath("/admin/companies");
  }

  async function archiveAction(formData: FormData) {
    "use server";
    const actor = await requireSuperAdmin();
    const companyId = formData.get("companyId");
    const archived = formData.get("archived") === "true";
    if (typeof companyId !== "string") return;
    await setCompanyArchived({ companyId, archived, actorUserId: actor.id });
    revalidatePath("/admin/companies");
  }

  async function inviteAction(formData: FormData) {
    "use server";
    const actor = await requireSuperAdmin();
    const companyId = formData.get("companyId");
    const name = formData.get("name");
    const email = formData.get("email");
    if (
      typeof companyId !== "string" ||
      typeof name !== "string" ||
      typeof email !== "string"
    ) {
      return;
    }
    await inviteCompanyAdmin({ companyId, name, email, actorUserId: actor.id });
    revalidatePath("/admin/companies");
  }

  async function deleteAction(formData: FormData) {
    "use server";
    const actor = await requireSuperAdmin();
    const companyId = formData.get("companyId");
    const confirmName = formData.get("confirmName");
    if (typeof companyId !== "string" || typeof confirmName !== "string")
      return;
    // Double confirm: the typed name must exactly match, and the lib enforces
    // the tenant is ARCHIVED. A permanent, leaf-to-root hard delete.
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true },
    });
    if (!company || company.name !== confirmName) return;
    await deleteTenant({ companyId, actorUserId: actor.id });
    revalidatePath("/admin/companies");
  }

  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { sites: true, companyModules: true, platformUsers: true },
      },
    },
  });
  // Demo/pilot markers: demo = the reset-script name marker; pilot = any
  // assessment/session carrying a pilotContext.
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
      <h1 className="text-xl font-semibold">{dict.heading}</h1>

      <form
        action={createTenantAction}
        className="flex flex-wrap items-end gap-2"
      >
        <label className="flex flex-col text-xs">
          {dict.namePlaceholder}
          <input name="name" required className="rounded border px-2 py-1" />
        </label>
        <label className="flex flex-col text-xs">
          {dict.countryLabel}
          <select name="country" className="rounded border px-2 py-1">
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded bg-black px-3 py-1 text-white dark:bg-white dark:text-black"
        >
          {dict.createTenant}
        </button>
      </form>

      {companies.length === 0 && <p className="text-sm">{dict.empty}</p>}

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-1 pr-4">{dict.colName}</th>
            <th className="py-1 pr-4">{dict.colStatus}</th>
            <th className="py-1 pr-4">{dict.colMarker}</th>
            <th className="py-1 pr-4">{dict.colSites}</th>
            <th className="py-1 pr-4">{dict.colModules}</th>
            <th className="py-1 pr-4">{dict.colUsers}</th>
            <th className="py-1">{dict.colActions}</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((c) => {
            const isDemo = c.name.startsWith("DEMO —");
            const isPilot = pilotCompanyIds.has(c.id);
            return (
              <tr key={c.id} className="border-b align-top last:border-0">
                <td className="py-1 pr-4">
                  <Link
                    href={`/admin/companies/${c.id}/sites`}
                    className="underline"
                  >
                    {c.name}
                  </Link>
                </td>
                <td className="py-1 pr-4">
                  {c.status === "ARCHIVED"
                    ? dict.statusArchived
                    : dict.statusActive}
                </td>
                <td className="py-1 pr-4">
                  {isDemo ? dict.markerDemo : isPilot ? dict.markerPilot : "—"}
                </td>
                <td className="py-1 pr-4">{c._count.sites}</td>
                <td className="py-1 pr-4">{c._count.companyModules}</td>
                <td className="py-1 pr-4">{c._count.platformUsers}</td>
                <td className="py-1">
                  <div className="flex flex-col gap-2">
                    <form action={archiveAction}>
                      <input type="hidden" name="companyId" value={c.id} />
                      <input
                        type="hidden"
                        name="archived"
                        value={c.status === "ARCHIVED" ? "false" : "true"}
                      />
                      <button type="submit" className="underline">
                        {c.status === "ARCHIVED"
                          ? dict.unarchive
                          : dict.archive}
                      </button>
                    </form>
                    <form
                      action={inviteAction}
                      className="flex flex-wrap items-end gap-1"
                    >
                      <input type="hidden" name="companyId" value={c.id} />
                      <input
                        name="name"
                        placeholder={dict.inviteName}
                        className="w-24 rounded border px-1 py-0.5 text-xs"
                      />
                      <input
                        name="email"
                        type="email"
                        placeholder={dict.inviteEmail}
                        className="w-36 rounded border px-1 py-0.5 text-xs"
                      />
                      <button
                        type="submit"
                        className="rounded border px-2 py-0.5 text-xs"
                      >
                        {dict.inviteButton}
                      </button>
                    </form>
                    <a
                      href={`/api/admin/companies/${c.id}/export`}
                      className="text-xs underline"
                    >
                      {dict.exportButton}
                    </a>
                    {c.status === "ARCHIVED" ? (
                      <form
                        action={deleteAction}
                        className="flex flex-wrap items-end gap-1"
                      >
                        <input type="hidden" name="companyId" value={c.id} />
                        <input
                          name="confirmName"
                          placeholder={dict.deleteHint}
                          className="w-40 rounded border px-1 py-0.5 text-xs"
                        />
                        <button
                          type="submit"
                          className="rounded border border-red-500 px-2 py-0.5 text-xs text-red-600"
                        >
                          {dict.deleteButton}
                        </button>
                      </form>
                    ) : (
                      <span className="text-xs text-neutral-500">
                        {dict.deleteArchivedFirst}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
