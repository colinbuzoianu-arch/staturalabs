import { revalidatePath } from "next/cache";
import Link from "next/link";
import { IncidentType } from "@/generated/prisma/enums";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import { createIncident } from "@/lib/incidents/incident";
import { prisma } from "@/lib/prisma";

const INCIDENT_TYPES = Object.values(IncidentType);

// P10a §7.4: report an event + list of reported/open events. Events describe
// CONDITIONS and an occurrence — never a person (the "no names in the narrative"
// notice is on the form).
export default async function IncidentReportsPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  await requireSiteAdministrationAccess(siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).incidents;

  async function createAction(formData: FormData) {
    "use server";
    const { user, site: s } = await requireSiteAdministrationAccess(siteId);
    const type = formData.get("type");
    const title = formData.get("title");
    const description = formData.get("description");
    const occurredRaw = formData.get("occurredAt");
    const location = formData.get("locationText");
    if (
      typeof type !== "string" ||
      !(INCIDENT_TYPES as string[]).includes(type) ||
      typeof title !== "string" ||
      title.trim().length === 0 ||
      typeof description !== "string" ||
      description.trim().length === 0
    ) {
      return;
    }
    await createIncident({
      companyId: s.companyId,
      siteId: s.id,
      type: type as IncidentType,
      title,
      description,
      occurredAt:
        typeof occurredRaw === "string" && occurredRaw.length > 0
          ? new Date(occurredRaw)
          : new Date(),
      actorUserId: user.id,
      locationText: typeof location === "string" ? location : null,
    });
    revalidatePath(`/app/s/${siteId}/incidents/reports`);
  }

  const incidents = await prisma.incident.findMany({
    where: { siteId, status: { not: "CLOSED" } },
    orderBy: { occurredAt: "desc" },
  });

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
        <p className="text-xs text-foreground-subtle">{dict.narrativeNotice}</p>
        <form action={createAction} className="flex flex-col gap-3 text-sm">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              {dict.typeLabel}
              <select
                name="type"
                required
                className="rounded border border-border bg-background px-2 py-1"
              >
                {INCIDENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {dict.typeLabels[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              {dict.occurredAtLabel}
              <input
                type="datetime-local"
                name="occurredAt"
                className="rounded border border-border bg-background px-2 py-1"
              />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              {dict.locationLabel}
              <input
                name="locationText"
                className="rounded border border-border bg-background px-2 py-1"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            {dict.titleLabel}
            <input
              name="title"
              required
              className="rounded border border-border bg-background px-2 py-1"
            />
          </label>
          <label className="flex flex-col gap-1">
            {dict.descriptionLabel}
            <textarea
              name="description"
              required
              rows={3}
              className="rounded border border-border bg-background px-2 py-1"
            />
          </label>
          <div>
            <button
              type="submit"
              className="rounded-[var(--radius-md)] bg-accent px-4 py-2 font-medium text-background"
            >
              {dict.createButton}
            </button>
          </div>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-sm font-bold">
          {dict.reportsHeading}
        </h2>
        {incidents.length === 0 ? (
          <p className="text-sm text-foreground-muted">{dict.reportsEmpty}</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-foreground-muted">
                <th className="py-1 pr-4">{dict.colTitle}</th>
                <th className="py-1 pr-4">{dict.colType}</th>
                <th className="py-1 pr-4">{dict.colStatus}</th>
                <th className="py-1 pr-4">{dict.colSeverity}</th>
                <th className="py-1 pr-4">{dict.colOccurred}</th>
                <th className="py-1" />
              </tr>
            </thead>
            <tbody>
              {incidents.map((i) => (
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
                    {i.severity ?? dict.none}
                  </td>
                  <td className="py-1.5 pr-4 text-foreground-muted">
                    {i.occurredAt.toISOString().slice(0, 10)}
                  </td>
                  <td className="py-1.5">
                    <Link
                      href={`/app/s/${siteId}/incidents/${i.id}`}
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
