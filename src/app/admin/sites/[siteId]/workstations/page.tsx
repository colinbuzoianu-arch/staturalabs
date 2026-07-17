import { revalidatePath } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { prisma } from "@/lib/prisma";

export default async function WorkstationsPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  await requireSuperAdmin();
  const { siteId } = await params;

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: { company: true },
  });
  if (!site) notFound();

  async function createWorkstation(formData: FormData) {
    "use server";
    await requireSuperAdmin();

    const name = formData.get("name");
    if (typeof name !== "string" || name.trim().length === 0) {
      throw new Error("Workstation name is required");
    }

    await prisma.workstation.create({ data: { siteId, name: name.trim() } });
    revalidatePath(`/admin/sites/${siteId}/workstations`);
  }

  const workstations = await prisma.workstation.findMany({
    where: { siteId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm">
        <Link href="/admin/companies" className="underline">
          Companies
        </Link>{" "}
        /{" "}
        <Link
          href={`/admin/companies/${site.companyId}/sites`}
          className="underline"
        >
          {site.company.name}
        </Link>{" "}
        / {site.name}
      </p>
      <h1 className="text-xl font-semibold">Workstations</h1>

      <form action={createWorkstation} className="flex gap-2">
        <input
          name="name"
          placeholder="Workstation name"
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

      {workstations.length === 0 && (
        <p className="text-sm">No workstations yet.</p>
      )}

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-1 pr-4">Name</th>
            <th className="py-1 pr-4">Created</th>
            <th className="py-1">Tasks</th>
          </tr>
        </thead>
        <tbody>
          {workstations.map((workstation) => (
            <tr key={workstation.id} className="border-b last:border-0">
              <td className="py-1 pr-4">{workstation.name}</td>
              <td className="py-1 pr-4">
                {workstation.createdAt.toISOString()}
              </td>
              <td className="py-1">
                <Link
                  href={`/admin/workstations/${workstation.id}/tasks`}
                  className="underline"
                >
                  Tasks
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
