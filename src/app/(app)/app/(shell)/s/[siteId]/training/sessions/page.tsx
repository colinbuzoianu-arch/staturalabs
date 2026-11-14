import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import { accessibleOrgUnitIds } from "@/lib/auth/scope";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import { planTrainingSession } from "@/lib/people/training";
import { prisma } from "@/lib/prisma";

// P17 §4: a leader's training-session organisation surface. Plan a session for
// people in your own units, then open it to record attendance. Scope: MANAGER
// is narrowed to their accessible org units; admins/EHS see the whole company.
export default async function TrainingSessionsPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const { user, site } = await requireSiteAdministrationAccess(siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).trainingSessionsPage;
  const companyId = site.companyId;

  const unitSet = await accessibleOrgUnitIds(user);
  const inUnit = (orgUnitId: string | null) =>
    unitSet === null || (orgUnitId !== null && unitSet.has(orgUnitId));

  const [requirementTypes, persons, sessions] = await Promise.all([
    prisma.trainingRequirementType.findMany({
      where: { OR: [{ companyId }, { companyId: null }] },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
    prisma.person.findMany({
      where: { companyId, active: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true, orgUnitId: true },
    }),
    prisma.trainingSession.findMany({
      where: { companyId },
      orderBy: { date: "desc" },
      select: {
        id: true,
        date: true,
        location: true,
        status: true,
        plannedByUserId: true,
        requirementType: { select: { title: true } },
        participants: { select: { person: { select: { orgUnitId: true } } } },
      },
    }),
  ]);

  const invitablePersons = persons.filter((p) => inUnit(p.orgUnitId));
  // A session is visible if the viewer planned it, is company/site-wide
  // (unitSet null), or it touches one of their units.
  const visibleSessions = sessions.filter(
    (s) =>
      unitSet === null ||
      s.plannedByUserId === user.id ||
      s.participants.some((pt) => inUnit(pt.person.orgUnitId)),
  );

  async function planAction(formData: FormData) {
    "use server";
    const { user: actor, site: s } =
      await requireSiteAdministrationAccess(siteId);
    const requirementTypeId = formData.get("requirementTypeId");
    const dateRaw = formData.get("date");
    const instructor = formData.get("instructor");
    const location = formData.get("location");
    if (
      typeof requirementTypeId !== "string" ||
      typeof dateRaw !== "string" ||
      dateRaw.length === 0 ||
      typeof instructor !== "string" ||
      instructor.trim().length === 0
    ) {
      redirect(`/app/s/${siteId}/training/sessions`);
    }
    const invitedPersonIds = formData
      .getAll("personId")
      .filter((v): v is string => typeof v === "string");
    await planTrainingSession({
      companyId: s.companyId,
      requirementTypeId: requirementTypeId as string,
      date: new Date(`${dateRaw as string}T00:00:00`),
      instructor: instructor as string,
      location: typeof location === "string" ? location : null,
      invitedPersonIds,
      plannedByUserId: actor.id,
    });
    revalidatePath(`/app/s/${siteId}/training/sessions`);
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-wide text-border">
          {dict.eyebrow}
        </p>
        <h1 className="font-heading text-2xl font-bold">{dict.heading}</h1>
        <p className="max-w-3xl text-sm text-foreground/80">{dict.intro}</p>
      </header>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="font-heading text-lg font-bold">{dict.planHeading}</h2>
        <form action={planAction} className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              {dict.requirementLabel}
              <select
                name="requirementTypeId"
                required
                className="rounded border border-border bg-background p-2"
              >
                {requirementTypes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {dict.dateLabel}
              <input
                type="date"
                name="date"
                required
                className="rounded border border-border bg-background p-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {dict.instructorLabel}
              <input
                type="text"
                name="instructor"
                required
                className="rounded border border-border bg-background p-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {dict.locationLabel}
              <input
                type="text"
                name="location"
                className="rounded border border-border bg-background p-2"
              />
            </label>
          </div>
          <fieldset className="flex flex-col gap-1">
            <legend className="text-sm font-semibold">
              {dict.inviteLabel}
            </legend>
            {invitablePersons.length === 0 ? (
              <p className="text-sm text-border">{dict.noPersons}</p>
            ) : (
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
                {invitablePersons.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="personId" value={p.id} />
                    {p.lastName}, {p.firstName}
                  </label>
                ))}
              </div>
            )}
          </fieldset>
          <div>
            <button
              type="submit"
              className="rounded bg-accent px-3 py-1.5 text-sm font-semibold text-background"
            >
              {dict.planButton}
            </button>
          </div>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-bold">{dict.listHeading}</h2>
        {visibleSessions.length === 0 ? (
          <p className="text-sm text-border">{dict.empty}</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="py-1 pr-4">{dict.colDate}</th>
                <th className="py-1 pr-4">{dict.colTopic}</th>
                <th className="py-1 pr-4">{dict.colLocation}</th>
                <th className="py-1 pr-4">{dict.colInvited}</th>
                <th className="py-1 pr-4">{dict.colStatus}</th>
                <th className="py-1" />
              </tr>
            </thead>
            <tbody>
              {visibleSessions.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0">
                  <td className="py-1 pr-4">
                    {s.date.toISOString().slice(0, 10)}
                  </td>
                  <td className="py-1 pr-4">{s.requirementType.title}</td>
                  <td className="py-1 pr-4">{s.location ?? "—"}</td>
                  <td className="py-1 pr-4">{s.participants.length}</td>
                  <td className="py-1 pr-4">
                    {
                      dict.statusLabels[
                        s.status as keyof typeof dict.statusLabels
                      ]
                    }
                  </td>
                  <td className="py-1">
                    <Link
                      className="text-info hover:underline"
                      href={`/app/s/${siteId}/training/sessions/${s.id}`}
                    >
                      {dict.view}
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
