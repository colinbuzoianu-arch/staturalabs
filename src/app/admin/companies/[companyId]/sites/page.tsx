import { revalidatePath } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CountryCode } from "@/generated/prisma/enums";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { getAdminDictionary } from "@/lib/i18n/dictionaries/admin";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";

const COUNTRY_OPTIONS = Object.values(CountryCode);

export default async function SitesPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  await requireSuperAdmin();
  const { companyId } = await params;

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) notFound();

  async function createSite(formData: FormData) {
    "use server";
    await requireSuperAdmin();

    const name = formData.get("name");
    if (typeof name !== "string" || name.trim().length === 0) {
      throw new Error("Site name is required");
    }

    const countryRaw = formData.get("country");
    if (
      typeof countryRaw !== "string" ||
      !(Object.values(CountryCode) as string[]).includes(countryRaw)
    ) {
      throw new Error(`country must be one of ${COUNTRY_OPTIONS.join(", ")}`);
    }

    await prisma.site.create({
      data: {
        companyId,
        name: name.trim(),
        country: countryRaw as CountryCode,
      },
    });
    revalidatePath(`/admin/companies/${companyId}/sites`);
  }

  const sites = await prisma.site.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
  });

  const locale = await getLocale();
  const dict = getAdminDictionary(locale).companySitesPage;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm">
        <Link href="/admin/companies" className="underline">
          {dict.companiesBreadcrumb}
        </Link>{" "}
        / {company.name}
      </p>
      <h1 className="text-xl font-semibold">{dict.heading}</h1>

      <form action={createSite} className="flex gap-2">
        <input
          name="name"
          placeholder={dict.namePlaceholder}
          required
          className="rounded border px-2 py-1"
        />
        <label className="flex items-center gap-1 text-sm">
          {dict.countryLabel}
          <select
            name="country"
            defaultValue={CountryCode.AT}
            className="rounded border px-2 py-1"
          >
            {COUNTRY_OPTIONS.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded bg-black px-3 py-1 text-white dark:bg-white dark:text-black"
        >
          {dict.create}
        </button>
      </form>

      {sites.length === 0 && <p className="text-sm">{dict.empty}</p>}

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-1 pr-4">{dict.colName}</th>
            <th className="py-1 pr-4">{dict.colCountry}</th>
            <th className="py-1 pr-4">{dict.colCreated}</th>
            <th className="py-1">{dict.colWorkstations}</th>
          </tr>
        </thead>
        <tbody>
          {sites.map((site) => (
            <tr key={site.id} className="border-b last:border-0">
              <td className="py-1 pr-4">{site.name}</td>
              <td className="py-1 pr-4">{site.country}</td>
              <td className="py-1 pr-4">{site.createdAt.toISOString()}</td>
              <td className="py-1">
                <Link
                  href={`/admin/sites/${site.id}/workstations`}
                  className="underline"
                >
                  {dict.workstationsLink}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
