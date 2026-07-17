import Link from "next/link";
import { requireWorkstationAccess } from "@/lib/auth/require-access";
import { getDashboardDictionary } from "@/lib/i18n/dictionaries/dashboard";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";

export default async function WorkstationTasksPage({
  params,
}: {
  params: Promise<{ workstationId: string }>;
}) {
  const { workstationId } = await params;
  const { workstation } = await requireWorkstationAccess(workstationId);

  const tasks = await prisma.task.findMany({
    where: { workstationId },
    orderBy: { name: "asc" },
  });

  const locale = await getLocale();
  const dict = getDashboardDictionary(locale).workstationPage;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-12">
      <Breadcrumb
        site={workstation.site}
        workstationName={workstation.name}
        sitesLabel={dict.breadcrumbSites}
      />

      <div className="flex flex-col gap-1">
        <p className="font-technical text-xs uppercase tracking-[0.2em] text-border">
          {dict.eyebrow}
        </p>
        <h1 className="font-heading text-2xl font-bold">{workstation.name}</h1>
        {workstation.description && (
          <p className="text-sm text-border">{workstation.description}</p>
        )}
      </div>

      {tasks.length === 0 && (
        <p className="text-sm text-border">{dict.empty}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tasks.map((task) => (
          <Link
            key={task.id}
            href={`/tasks/${task.id}`}
            className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-5 transition-colors hover:border-accent"
          >
            <span className="font-heading text-lg font-bold">{task.name}</span>
            {task.description && (
              <span className="text-sm text-border">{task.description}</span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

function Breadcrumb({
  site,
  workstationName,
  sitesLabel,
}: {
  site: { id: string; name: string };
  workstationName: string;
  sitesLabel: string;
}) {
  return (
    <p className="text-sm text-border">
      <Link href="/sites" className="hover:text-accent">
        {sitesLabel}
      </Link>{" "}
      /{" "}
      <Link href={`/sites/${site.id}`} className="hover:text-accent">
        {site.name}
      </Link>{" "}
      / {workstationName}
    </p>
  );
}
