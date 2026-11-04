import { revalidatePath } from "next/cache";
import {
  type TrainingConfirmation,
  TrainingDeliveryMethod,
} from "@/generated/prisma/enums";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import {
  addRequirementSource,
  removeRequirementSource,
} from "@/lib/people/assignment";
import {
  createTrainingRequirementType,
  recordTrainingSession,
} from "@/lib/people/training";
import { prisma } from "@/lib/prisma";

const DELIVERY_METHODS = Object.values(TrainingDeliveryMethod);

// P7c Unterweisungen module (plan §7.6). Requirement types + recording a
// training session (attendees → TrainingRecords). Company-scoped, gated by
// requireSiteAdministrationAccess. The instruction matrix + assignment-driven
// due lists are P7c-2.
export default async function TrainingPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const { site } = await requireSiteAdministrationAccess(siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).trainingPage;
  const companyId = site.companyId;

  async function addTypeAction(formData: FormData) {
    "use server";
    const { user, site: s } = await requireSiteAdministrationAccess(siteId);
    const d = getAdministrationDictionary(await getLocale()).trainingPage;
    const title = formData.get("title");
    if (typeof title !== "string" || title.trim().length === 0) {
      throw new Error(d.titleRequired);
    }
    const contentOutline = formData.get("contentOutline");
    const recurrenceRaw = formData.get("recurrenceMonths");
    const recurrence =
      typeof recurrenceRaw === "string" && recurrenceRaw.trim().length > 0
        ? Number.parseInt(recurrenceRaw, 10)
        : null;
    const deliveryRaw = formData.get("deliveryMethod");
    const deliveryMethod = (DELIVERY_METHODS as string[]).includes(
      deliveryRaw as string,
    )
      ? (deliveryRaw as TrainingDeliveryMethod)
      : TrainingDeliveryMethod.IN_PERSON;

    await createTrainingRequirementType({
      companyId: s.companyId,
      title,
      contentOutline:
        typeof contentOutline === "string" ? contentOutline : null,
      recurrenceMonths:
        recurrence !== null && Number.isFinite(recurrence) && recurrence > 0
          ? recurrence
          : null,
      deliveryMethod,
      actorUserId: user.id,
    });
    revalidatePath(`/app/s/${siteId}/training`);
  }

  async function recordAction(formData: FormData) {
    "use server";
    const { user, site: s } = await requireSiteAdministrationAccess(siteId);
    const d = getAdministrationDictionary(await getLocale()).trainingPage;

    const requirementTypeId = formData.get("requirementTypeId");
    const attendeePersonIds = formData
      .getAll("attendeePersonIds")
      .filter((v): v is string => typeof v === "string" && v.length > 0);
    if (
      typeof requirementTypeId !== "string" ||
      requirementTypeId.length === 0 ||
      attendeePersonIds.length === 0
    ) {
      throw new Error(d.noAttendeesOrType);
    }
    const dateRaw = formData.get("date");
    const date =
      typeof dateRaw === "string" && dateRaw.trim().length > 0
        ? new Date(dateRaw)
        : new Date();
    const instructorRaw = formData.get("instructor");
    const topicsRaw = formData.get("topics");
    const confirmationRaw = formData.get("confirmation");
    const confirmation: TrainingConfirmation =
      confirmationRaw === "SELF_CONFIRMED" ? "SELF_CONFIRMED" : "SIGNATURE";

    await recordTrainingSession({
      companyId: s.companyId,
      requirementTypeId,
      date,
      instructor: typeof instructorRaw === "string" ? instructorRaw : "",
      topics: typeof topicsRaw === "string" ? topicsRaw : null,
      attendeePersonIds,
      confirmation,
      actorUserId: user.id,
    });
    revalidatePath(`/app/s/${siteId}/training`);
  }

  async function addSourceAction(formData: FormData) {
    "use server";
    const { user, site: s } = await requireSiteAdministrationAccess(siteId);
    const requirementTypeId = formData.get("requirementTypeId");
    const subjectValue = formData.get("subject");
    if (
      typeof requirementTypeId !== "string" ||
      typeof subjectValue !== "string" ||
      !subjectValue.includes(":")
    ) {
      return;
    }
    const [kind, subjectId] = subjectValue.split(":");
    const subjectType =
      kind === "workstation"
        ? "WORKSTATION"
        : kind === "orgunit"
          ? "ORG_UNIT"
          : kind === "process"
            ? "PROCESS"
            : kind === "substance"
              ? "SUBSTANCE"
              : null;
    if (!subjectType || !subjectId) return;
    await addRequirementSource({
      requirementTypeId,
      subjectType,
      subjectId,
      companyId: s.companyId,
      actorUserId: user.id,
    });
    revalidatePath(`/app/s/${siteId}/training`);
  }

  async function removeSourceAction(formData: FormData) {
    "use server";
    const { user, site: s } = await requireSiteAdministrationAccess(siteId);
    const id = formData.get("sourceId");
    if (typeof id === "string" && id.length > 0) {
      await removeRequirementSource(id, s.companyId, user.id);
    }
    revalidatePath(`/app/s/${siteId}/training`);
  }

  const [
    types,
    people,
    records,
    sources,
    workstations,
    siteOrgUnits,
    processes,
    substances,
  ] = await Promise.all([
    prisma.trainingRequirementType.findMany({
      where: { OR: [{ companyId }, { companyId: null }] },
      orderBy: { title: "asc" },
    }),
    prisma.person.findMany({
      where: { companyId, active: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.trainingRecord.findMany({
      where: { person: { companyId } },
      include: { person: true, requirementType: true },
      orderBy: { completedAt: "desc" },
      take: 25,
    }),
    prisma.trainingRequirementSource.findMany({
      where: { requirementType: { OR: [{ companyId }, { companyId: null }] } },
      include: { requirementType: { select: { title: true } } },
    }),
    prisma.workstation.findMany({
      where: { site: { companyId } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.orgUnit.findMany({
      where: { site: { companyId } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.process.findMany({
      where: { site: { companyId } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.substance.findMany({
      where: { companyId },
      select: { id: true, tradeName: true },
      orderBy: { tradeName: "asc" },
    }),
  ]);
  const subjectName = new Map<string, string>([
    ...workstations.map((w) => [`WORKSTATION:${w.id}`, w.name] as const),
    ...siteOrgUnits.map((o) => [`ORG_UNIT:${o.id}`, o.name] as const),
    ...processes.map((p) => [`PROCESS:${p.id}`, p.name] as const),
    ...substances.map((x) => [`SUBSTANCE:${x.id}`, x.tradeName] as const),
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

      <nav className="flex gap-2 border-b border-border pb-3 text-sm">
        <span className="rounded-[var(--radius-md)] bg-surface-raised px-3 py-1 font-medium text-foreground">
          {dict.recordTab}
        </span>
        <a
          href={`/app/s/${siteId}/training/matrix`}
          className="rounded-[var(--radius-md)] px-3 py-1 text-foreground-muted hover:bg-surface-raised"
        >
          {dict.matrixTab}
        </a>
      </nav>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="font-heading text-sm font-bold">
          {dict.addTypeHeading}
        </h2>
        <form action={addTypeAction} className="flex flex-col gap-3 text-sm">
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1">
              {dict.titleLabel}
              <input
                name="title"
                required
                className="rounded border border-border bg-background px-2 py-1"
              />
            </label>
            <label className="flex flex-col gap-1">
              {dict.recurrenceLabel}
              <input
                type="number"
                min={1}
                name="recurrenceMonths"
                className="w-32 rounded border border-border bg-background px-2 py-1"
              />
            </label>
            <label className="flex flex-col gap-1">
              {dict.deliveryMethodLabel}
              <select
                name="deliveryMethod"
                className="rounded border border-border bg-background px-2 py-1"
              >
                {DELIVERY_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {dict.deliveryMethodLabels[m]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1">
            {dict.contentOutlineLabel}
            <input
              name="contentOutline"
              className="rounded border border-border bg-background px-2 py-1"
            />
          </label>
          <button
            type="submit"
            className="self-start rounded-[var(--radius-md)] bg-accent px-4 py-2 font-medium text-background"
          >
            {dict.addTypeButton}
          </button>
        </form>
        {types.length === 0 ? (
          <p className="text-sm text-foreground-muted">{dict.typesEmpty}</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {types.map((t) => (
              <li key={t.id}>
                <span className="font-medium text-foreground">{t.title}</span>{" "}
                <span className="text-foreground-subtle">
                  · {dict.deliveryMethodLabels[t.deliveryMethod]}
                  {t.recurrenceMonths ? ` · ${t.recurrenceMonths} M` : ""}
                  {t.retentionOverride
                    ? ` · ${dict.retentionOverrideLabel} ${t.retentionOverride}`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="font-heading text-sm font-bold">
          {dict.sourcesHeading}
        </h2>
        <p className="text-xs text-foreground-muted">{dict.sourcesIntro}</p>
        {types.length > 0 && (
          <form
            action={addSourceAction}
            className="flex flex-wrap items-end gap-3 text-sm"
          >
            <label className="flex flex-col gap-1">
              {dict.requirementTypeLabel}
              <select
                name="requirementTypeId"
                className="rounded border border-border bg-background px-2 py-1"
              >
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              {dict.sourceSubjectLabel}
              <select
                name="subject"
                className="rounded border border-border bg-background px-2 py-1"
              >
                <optgroup label={dict.sourceTypeLabels.WORKSTATION}>
                  {workstations.map((w) => (
                    <option key={`w-${w.id}`} value={`workstation:${w.id}`}>
                      {w.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label={dict.sourceTypeLabels.ORG_UNIT}>
                  {siteOrgUnits.map((o) => (
                    <option key={`o-${o.id}`} value={`orgunit:${o.id}`}>
                      {o.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label={dict.sourceTypeLabels.PROCESS}>
                  {processes.map((p) => (
                    <option key={`p-${p.id}`} value={`process:${p.id}`}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label={dict.sourceTypeLabels.SUBSTANCE}>
                  {substances.map((x) => (
                    <option key={`x-${x.id}`} value={`substance:${x.id}`}>
                      {x.tradeName}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
            <button
              type="submit"
              className="rounded-[var(--radius-md)] bg-accent px-3 py-1.5 font-medium text-background"
            >
              {dict.addSourceButton}
            </button>
          </form>
        )}
        {sources.length === 0 ? (
          <p className="text-sm text-foreground-muted">{dict.sourcesEmpty}</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {sources.map((src) => (
              <li
                key={src.id}
                className="flex items-center justify-between gap-3"
              >
                <span className="text-foreground">
                  {src.requirementType.title}{" "}
                  <span className="text-foreground-subtle">
                    ·{" "}
                    {dict.sourceTypeLabels[src.subjectType] ?? src.subjectType}:{" "}
                    {subjectName.get(`${src.subjectType}:${src.subjectId}`) ??
                      dict.none}
                  </span>
                </span>
                <form action={removeSourceAction}>
                  <input type="hidden" name="sourceId" value={src.id} />
                  <button
                    type="submit"
                    className="text-xs text-foreground-subtle hover:text-accent hover:underline"
                  >
                    {dict.removeSource}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="font-heading text-sm font-bold">{dict.recordHeading}</h2>
        {types.length === 0 || people.length === 0 ? (
          <p className="text-sm text-foreground-muted">
            {dict.noAttendeesOrType}
          </p>
        ) : (
          <form action={recordAction} className="flex flex-col gap-3 text-sm">
            <div className="flex flex-wrap gap-3">
              <label className="flex flex-col gap-1">
                {dict.requirementTypeLabel}
                <select
                  name="requirementTypeId"
                  className="rounded border border-border bg-background px-2 py-1"
                >
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                {dict.dateLabel}
                <input
                  type="date"
                  name="date"
                  className="rounded border border-border bg-background px-2 py-1"
                />
              </label>
              <label className="flex flex-col gap-1">
                {dict.instructorLabel}
                <input
                  name="instructor"
                  className="rounded border border-border bg-background px-2 py-1"
                />
              </label>
              <label className="flex flex-col gap-1">
                {dict.confirmationLabel}
                <select
                  name="confirmation"
                  className="rounded border border-border bg-background px-2 py-1"
                >
                  <option value="SIGNATURE">
                    {dict.confirmationLabels.SIGNATURE}
                  </option>
                  <option value="SELF_CONFIRMED">
                    {dict.confirmationLabels.SELF_CONFIRMED}
                  </option>
                </select>
              </label>
            </div>
            <label className="flex flex-col gap-1">
              {dict.topicsLabel}
              <input
                name="topics"
                className="rounded border border-border bg-background px-2 py-1"
              />
            </label>
            <fieldset className="flex flex-col gap-1">
              <legend className="mb-1">{dict.attendeesLabel}</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {people.map((p) => (
                  <label key={p.id} className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      name="attendeePersonIds"
                      value={p.id}
                    />
                    {p.lastName}, {p.firstName}
                  </label>
                ))}
              </div>
            </fieldset>
            <button
              type="submit"
              className="self-start rounded-[var(--radius-md)] bg-accent px-4 py-2 font-medium text-background"
            >
              {dict.recordButton}
            </button>
          </form>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-sm font-bold">
          {dict.recentRecordsHeading}
        </h2>
        {records.length === 0 ? (
          <p className="text-sm text-foreground-muted">{dict.recordsEmpty}</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-foreground-muted">
                <th className="py-1 pr-4">{dict.colPerson}</th>
                <th className="py-1 pr-4">{dict.colRequirement}</th>
                <th className="py-1 pr-4">{dict.colDate}</th>
                <th className="py-1">{dict.colValidUntil}</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="py-1.5 pr-4 text-foreground">
                    {r.person.anonymisedAt
                      ? dict.none
                      : `${r.person.lastName}, ${r.person.firstName}`}
                  </td>
                  <td className="py-1.5 pr-4 text-foreground-muted">
                    {r.requirementType.title}
                  </td>
                  <td className="py-1.5 pr-4 text-foreground-muted">
                    {r.completedAt.toISOString().slice(0, 10)}
                  </td>
                  <td className="py-1.5 text-foreground-muted">
                    {r.validUntil
                      ? r.validUntil.toISOString().slice(0, 10)
                      : dict.none}
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
