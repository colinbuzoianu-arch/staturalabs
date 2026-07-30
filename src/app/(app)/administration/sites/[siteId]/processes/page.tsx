import { revalidatePath } from "next/cache";
import { ProcessStatus } from "@/generated/prisma/enums";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";
import { addTaskToProcess, createProcess } from "@/lib/process";

const PROCESS_STATUSES = Object.values(ProcessStatus);

export default async function ProcessesPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  await requireSiteAdministrationAccess(siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).processesPage;
  const commonDict = getAdministrationDictionary(locale).common;
  const statusLabels = getAdministrationDictionary(locale).processStatusLabels;

  async function createProcessAction(formData: FormData) {
    "use server";
    await requireSiteAdministrationAccess(siteId);
    const dict = getAdministrationDictionary(await getLocale()).processesPage;
    const commonDict = getAdministrationDictionary(await getLocale()).common;

    const name = formData.get("name");
    if (typeof name !== "string" || name.trim().length === 0) {
      throw new Error(dict.nameRequired);
    }

    const orgUnitIdRaw = formData.get("orgUnitId");
    const orgUnitId =
      typeof orgUnitIdRaw === "string" && orgUnitIdRaw.length > 0
        ? orgUnitIdRaw
        : null;

    const codeRaw = formData.get("code");
    const code =
      typeof codeRaw === "string" && codeRaw.trim().length > 0
        ? codeRaw.trim()
        : null;

    const descriptionRaw = formData.get("description");
    const description =
      typeof descriptionRaw === "string" && descriptionRaw.trim().length > 0
        ? descriptionRaw.trim()
        : null;

    const statusRaw = formData.get("status");
    const status =
      typeof statusRaw === "string" &&
      (PROCESS_STATUSES as string[]).includes(statusRaw)
        ? (statusRaw as ProcessStatus)
        : ProcessStatus.DRAFT;

    try {
      await createProcess({
        siteId,
        orgUnitId,
        name: name.trim(),
        code,
        description,
        status,
      });
    } catch (error) {
      throw new Error(
        commonDict.unexpectedError(
          error instanceof Error ? error.message : String(error),
        ),
      );
    }

    revalidatePath(`/administration/sites/${siteId}/processes`);
  }

  async function addTaskToProcessAction(formData: FormData) {
    "use server";
    await requireSiteAdministrationAccess(siteId);
    const dict = getAdministrationDictionary(await getLocale()).processesPage;
    const commonDict = getAdministrationDictionary(await getLocale()).common;

    const processId = formData.get("processId");
    if (typeof processId !== "string" || processId.length === 0) {
      throw new Error(commonDict.unexpectedError("missing processId"));
    }

    const taskId = formData.get("taskId");
    if (typeof taskId !== "string" || taskId.length === 0) {
      throw new Error(dict.taskRequired);
    }

    const sequenceRaw = formData.get("sequence");
    const sequence =
      typeof sequenceRaw === "string" ? Number.parseInt(sequenceRaw, 10) : NaN;
    if (!Number.isInteger(sequence)) {
      throw new Error(dict.sequenceInvalid);
    }

    try {
      await addTaskToProcess({ processId, taskId, sequence });
    } catch (error) {
      throw new Error(
        commonDict.unexpectedError(
          error instanceof Error ? error.message : String(error),
        ),
      );
    }

    revalidatePath(`/administration/sites/${siteId}/processes`);
  }

  const [processes, orgUnits, tasks] = await Promise.all([
    prisma.process.findMany({
      where: { siteId },
      include: {
        tasks: { include: { task: true }, orderBy: { sequence: "asc" } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.orgUnit.findMany({ where: { siteId }, orderBy: { name: "asc" } }),
    prisma.task.findMany({
      where: { workstation: { siteId } },
      include: { workstation: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <p className="font-technical text-xs uppercase tracking-[0.2em] text-border">
          {dict.eyebrow}
        </p>
        <h1 className="font-heading text-2xl font-bold">{dict.heading}</h1>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-bold">{dict.createHeading}</h2>
        <form
          action={createProcessAction}
          className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface p-4"
        >
          <label className="flex flex-col gap-1 text-sm">
            {dict.nameLabel}
            <input
              name="name"
              required
              className="rounded border border-border bg-background px-2 py-1"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {dict.orgUnitLabel}
            <select
              name="orgUnitId"
              className="rounded border border-border bg-background px-2 py-1"
            >
              <option value="">{commonDict.none}</option>
              {orgUnits.map((orgUnit) => (
                <option key={orgUnit.id} value={orgUnit.id}>
                  {orgUnit.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {dict.codeLabel}
            <input
              name="code"
              className="rounded border border-border bg-background px-2 py-1"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {dict.statusLabel}
            <select
              name="status"
              defaultValue={ProcessStatus.DRAFT}
              className="rounded border border-border bg-background px-2 py-1"
            >
              {PROCESS_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-1 basis-full flex-col gap-1 text-sm">
            {dict.descriptionLabel}
            <input
              name="description"
              className="rounded border border-border bg-background px-2 py-1"
            />
          </label>
          <button
            type="submit"
            className="rounded bg-accent px-3 py-1.5 text-sm font-semibold text-background"
          >
            {dict.create}
          </button>
        </form>
      </section>

      {processes.length === 0 ? (
        <p className="text-sm text-border">{dict.empty}</p>
      ) : (
        <div className="flex flex-col gap-6">
          {processes.map((process) => (
            <section
              key={process.id}
              className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4"
            >
              <div className="flex items-baseline justify-between">
                <h3 className="font-heading text-base font-bold">
                  {process.name}
                </h3>
                <span className="text-xs text-border">
                  {statusLabels[process.status]}
                </span>
              </div>

              <div>
                <h4 className="text-sm font-semibold">{dict.tasksHeading}</h4>
                {process.tasks.length === 0 ? (
                  <p className="text-sm text-border">{dict.tasksEmpty}</p>
                ) : (
                  <ol className="list-decimal pl-5 text-sm">
                    {process.tasks.map((processTask) => (
                      <li key={processTask.id}>{processTask.task.name}</li>
                    ))}
                  </ol>
                )}
              </div>

              <form
                action={addTaskToProcessAction}
                className="flex flex-wrap items-end gap-2"
              >
                <input type="hidden" name="processId" value={process.id} />
                <label className="flex flex-col gap-1 text-sm">
                  {dict.taskLabel}
                  <select
                    name="taskId"
                    className="rounded border border-border bg-background px-2 py-1"
                  >
                    {tasks.map((task) => (
                      <option key={task.id} value={task.id}>
                        {task.workstation.name} / {task.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  {dict.sequenceLabel}
                  <input
                    type="number"
                    name="sequence"
                    defaultValue={process.tasks.length + 1}
                    min={1}
                    className="w-20 rounded border border-border bg-background px-2 py-1"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded border border-border px-2 py-1 text-xs hover:border-accent"
                >
                  {dict.addTask}
                </button>
              </form>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
