import { revalidatePath } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { prisma } from "@/lib/prisma";

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

    await prisma.site.create({ data: { companyId, name: name.trim() } });
    revalidatePath(`/admin/companies/${companyId}/sites`);
  }

  const sites = await prisma.site.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm">
        <Link href="/admin/companies" className="underline">
          Companies
        </Link>{" "}
        / {company.name}
      </p>
      <h1 className="text-xl font-semibold">Sites</h1>

      <form action={createSite} className="flex gap-2">
        <input
          name="name"
          placeholder="Site name"
          required
          className="rounded border px-2 py-1"
        />
        <button
          type="submit"
          className="rounded bg-black px-3 py-1 text-white dark:bg-white dark:text-black"
        >
          Create
        </button>
      </form>

      {sites.length === 0 && <p className="text-sm">No sites yet.</p>}

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-1 pr-4">Name</th>
            <th className="py-1 pr-4">Created</th>
            <th className="py-1">Workstations</th>
          </tr>
        </thead>
        <tbody>
          {sites.map((site) => (
            <tr key={site.id} className="border-b last:border-0">
              <td className="py-1 pr-4">{site.name}</td>
              <td className="py-1 pr-4">{site.createdAt.toISOString()}</td>
              <td className="py-1">
                <Link
                  href={`/admin/sites/${site.id}/workstations`}
                  className="underline"
                >
                  Workstations
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
