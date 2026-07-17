import { revalidatePath } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { getAdminDictionary } from "@/lib/i18n/dictionaries/admin";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";

export default async function TasksPage({
  params,
}: {
  params: Promise<{ workstationId: string }>;
}) {
  await requireSuperAdmin();
  const { workstationId } = await params;

  const workstation = await prisma.workstation.findUnique({
    where: { id: workstationId },
    include: { site: { include: { company: true } } },
  });
  if (!workstation) notFound();

  async function createTask(formData: FormData) {
    "use server";
    await requireSuperAdmin();

    const name = formData.get("name");
    if (typeof name !== "string" || name.trim().length === 0) {
      throw new Error("Task name is required");
    }

    await prisma.task.create({ data: { workstationId, name: name.trim() } });
    revalidatePath(`/admin/workstations/${workstationId}/tasks`);
  }

  const tasks = await prisma.task.findMany({
    where: { workstationId },
    orderBy: { createdAt: "desc" },
  });

  const locale = await getLocale();
  const dict = getAdminDictionary(locale).workstationTasksPage;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm">
        <Link href="/admin/companies" className="underline">
          {dict.companiesBreadcrumb}
        </Link>{" "}
        /{" "}
        <Link
          href={`/admin/companies/${workstation.site.companyId}/sites`}
          className="underline"
        >
          {workstation.site.company.name}
        </Link>{" "}
        /{" "}
        <Link
          href={`/admin/sites/${workstation.siteId}/workstations`}
          className="underline"
        >
          {workstation.site.name}
        </Link>{" "}
        / {workstation.name}
      </p>
      <h1 className="text-xl font-semibold">{dict.heading}</h1>
      <p>
        <Link
          href={`/admin/workstations/${workstationId}/sessions`}
          className="underline"
        >
          {dict.assessmentSessionsLink}
        </Link>
      </p>

      <form action={createTask} className="flex gap-2">
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

      {tasks.length === 0 && <p className="text-sm">{dict.empty}</p>}

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-1 pr-4">{dict.colName}</th>
            <th className="py-1 pr-4">{dict.colCreated}</th>
            <th className="py-1">{dict.colResults}</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id} className="border-b last:border-0">
              <td className="py-1 pr-4">{task.name}</td>
              <td className="py-1 pr-4">{task.createdAt.toISOString()}</td>
              <td className="py-1">
                <Link href={`/admin/tasks/${task.id}`} className="underline">
                  {dict.viewCaptures}
                </Link>{" "}
                ·{" "}
                <Link href={`/tasks/${task.id}/capture`} className="underline">
                  {dict.captureLink}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
