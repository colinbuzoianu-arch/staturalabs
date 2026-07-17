import { revalidatePath } from "next/cache";
import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { getAdminDictionary } from "@/lib/i18n/dictionaries/admin";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";

async function createCompany(formData: FormData) {
  "use server";
  await requireSuperAdmin();

  const name = formData.get("name");
  if (typeof name !== "string" || name.trim().length === 0) {
    throw new Error("Company name is required");
  }

  await prisma.company.create({ data: { name: name.trim() } });
  revalidatePath("/admin/companies");
}

export default async function CompaniesPage() {
  await requireSuperAdmin();
  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "desc" },
  });
  const locale = await getLocale();
  const dict = getAdminDictionary(locale).companiesPage;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">{dict.heading}</h1>

      <form action={createCompany} className="flex gap-2">
        <input
          name="name"
          placeholder={dict.namePlaceholder}
          required
          className="rounded border px-2 py-1"
        />
        <button
          type="submit"
          className="rounded bg-black px-3 py-1 text-white dark:bg-white dark:text-black"
        >
          {dict.create}
        </button>
      </form>

      {companies.length === 0 && <p className="text-sm">{dict.empty}</p>}

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-1 pr-4">{dict.colName}</th>
            <th className="py-1 pr-4">{dict.colCreated}</th>
            <th className="py-1">{dict.colSites}</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((company) => (
            <tr key={company.id} className="border-b last:border-0">
              <td className="py-1 pr-4">{company.name}</td>
              <td className="py-1 pr-4">{company.createdAt.toISOString()}</td>
              <td className="py-1">
                <Link
                  href={`/admin/companies/${company.id}/sites`}
                  className="underline"
                >
                  {dict.sitesLink}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
