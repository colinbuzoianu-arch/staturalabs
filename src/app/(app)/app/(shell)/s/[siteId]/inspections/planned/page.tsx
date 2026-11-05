import { revalidatePath } from "next/cache";
import Link from "next/link";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import { createInspectionFromTemplate } from "@/lib/inspections/inspection";
import { prisma } from "@/lib/prisma";

// P9 §7.3: planned & in-progress inspections + a "new inspection" form that
// instantiates a template (snapshotting its questions into answers).
export default async function PlannedInspectionsPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const { site } = await requireSiteAdministrationAccess(siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).inspections;

  async function createAction(formData: FormData) {
    "use server";
    const { site: s } = await requireSiteAdministrationAccess(siteId);
    const templateId = formData.get("templateId");
    if (typeof templateId !== "string" || templateId.length === 0) return;
    const title = formData.get("title");
    const plannedRaw = formData.get("plannedDate");
    await createInspectionFromTemplate({
      templateId,
      siteId: s.id,
      title: typeof title === "string" ? title : null,
      plannedDate:
        typeof plannedRaw === "string" && plannedRaw.length > 0
          ? new Date(plannedRaw)
          : null,
    });
    revalidatePath(`/app/s/${siteId}/inspections/planned`);
  }

  const [templates, inspections] = await Promise.all([
    prisma.inspectionTemplate.findMany({
      where: {
        isActive: true,
        OR: [{ companyId: null }, { companyId: site.companyId }],
      },
      select: { id: true, title: true, type: true },
      orderBy: [{ isSystem: "desc" }, { title: "asc" }],
    }),
    prisma.inspection.findMany({
      where: { siteId, status: { in: ["PLANNED", "IN_PROGRESS"] } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
      <div>
        <p className="font-technical text-xs uppercase tracking-[0.2em] text-foreground-subtle">
          {dict.eyebrow}
        </p>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-foreground">
          {dict.heading}
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">{dict.intro}</p>
      </div>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="font-heading text-sm font-bold">{dict.newHeading}</h2>
        {templates.length === 0 ? (
          <p className="text-sm text-foreground-muted">{dict.noTemplates}</p>
        ) : (
          <form
            action={createAction}
            className="flex flex-wrap items-end gap-3 text-sm"
          >
            <label className="flex flex-col gap-1">
              {dict.templateLabel}
              <select
                name="templateId"
                required
                className="rounded border border-border bg-background px-2 py-1"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} ({dict.typeLabels[t.type]})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              {dict.titleLabel}
              <input
                name="title"
                className="rounded border border-border bg-background px-2 py-1"
              />
            </label>
            <label className="flex flex-col gap-1">
              {dict.plannedDateLabel}
              <input
                type="date"
                name="plannedDate"
                className="rounded border border-border bg-background px-2 py-1"
              />
            </label>
            <button
              type="submit"
              className="rounded-[var(--radius-md)] bg-accent px-4 py-2 font-medium text-background"
            >
              {dict.createButton}
            </button>
          </form>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-sm font-bold">
          {dict.plannedHeading}
        </h2>
        {inspections.length === 0 ? (
          <p className="text-sm text-foreground-muted">{dict.plannedEmpty}</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-foreground-muted">
                <th className="py-1 pr-4">{dict.colTitle}</th>
                <th className="py-1 pr-4">{dict.colType}</th>
                <th className="py-1 pr-4">{dict.colStatus}</th>
                <th className="py-1 pr-4">{dict.colPlanned}</th>
                <th className="py-1" />
              </tr>
            </thead>
            <tbody>
              {inspections.map((i) => (
                <tr key={i.id} className="border-b border-border last:border-0">
                  <td className="py-1.5 pr-4 font-medium text-foreground">
                    {i.title}
                  </td>
                  <td className="py-1.5 pr-4 text-foreground-muted">
                    {dict.typeLabels[i.type]}
                  </td>
                  <td className="py-1.5 pr-4 text-foreground-muted">
                    {dict.statusLabels[i.status]}
                  </td>
                  <td className="py-1.5 pr-4 text-foreground-muted">
                    {i.plannedDate
                      ? i.plannedDate.toISOString().slice(0, 10)
                      : dict.none}
                  </td>
                  <td className="py-1.5">
                    <Link
                      href={`/app/s/${siteId}/inspections/${i.id}`}
                      className="text-accent hover:underline"
                    >
                      {dict.openLink}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
