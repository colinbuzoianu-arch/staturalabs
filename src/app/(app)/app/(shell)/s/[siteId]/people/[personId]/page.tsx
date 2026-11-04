import { revalidatePath } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import {
  createPersonAssignment,
  endPersonAssignment,
} from "@/lib/people/assignment";
import { setLegalHold } from "@/lib/people/retention-batch";
import { prisma } from "@/lib/prisma";

// P7d §A.1 person detail — assignments (Einsatz) + training records + DSAR.
// Company-scoped; assignments drive requirement derivation and are never shown
// on any assessment screen.
export default async function PersonDetailPage({
  params,
}: {
  params: Promise<{ siteId: string; personId: string }>;
}) {
  const { siteId, personId } = await params;
  const { site } = await requireSiteAdministrationAccess(siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).personDetail;
  const companyId = site.companyId;

  const person = await prisma.person.findUnique({
    where: { id: personId },
    include: {
      assignments: { orderBy: { createdAt: "desc" } },
      trainingRecords: {
        include: { requirementType: true },
        orderBy: { completedAt: "desc" },
      },
    },
  });
  if (!person || person.companyId !== companyId) notFound();

  async function addAssignmentAction(formData: FormData) {
    "use server";
    const { user, site: s } = await requireSiteAdministrationAccess(siteId);
    const targetType = formData.get("targetType");
    const target = formData.get("target");
    const validFromRaw = formData.get("validFrom");
    if (typeof target !== "string" || target.length === 0) return;
    await createPersonAssignment({
      personId,
      companyId: s.companyId,
      workstationId: targetType === "workstation" ? target : null,
      orgUnitId: targetType === "orgunit" ? target : null,
      validFrom:
        typeof validFromRaw === "string" && validFromRaw.trim().length > 0
          ? new Date(validFromRaw)
          : null,
      actorUserId: user.id,
    });
    revalidatePath(`/app/s/${siteId}/people/${personId}`);
  }

  async function endAssignmentAction(formData: FormData) {
    "use server";
    const { user, site: s } = await requireSiteAdministrationAccess(siteId);
    const id = formData.get("assignmentId");
    if (typeof id === "string" && id.length > 0) {
      await endPersonAssignment(id, s.companyId, user.id);
    }
    revalidatePath(`/app/s/${siteId}/people/${personId}`);
  }

  async function legalHoldAction(formData: FormData) {
    "use server";
    const { user, site: s } = await requireSiteAdministrationAccess(siteId);
    const hold = formData.get("hold") === "on";
    const reasonRaw = formData.get("reason");
    await setLegalHold(
      personId,
      s.companyId,
      hold,
      typeof reasonRaw === "string" && reasonRaw.trim().length > 0
        ? reasonRaw.trim()
        : null,
      user.id,
    );
    revalidatePath(`/app/s/${siteId}/people/${personId}`);
  }

  const now = new Date();
  const activeAssignments = person.assignments.filter(
    (a) => a.validUntil === null || a.validUntil > now,
  );
  const [workstations, orgUnits] = await Promise.all([
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
  ]);
  const wsName = new Map(workstations.map((w) => [w.id, w.name]));
  const ouName = new Map(orgUnits.map((o) => [o.id, o.name]));

  const title = person.anonymisedAt
    ? dict.none
    : `${person.lastName}, ${person.firstName}`;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
      <div>
        <Link
          href={`/app/s/${siteId}/people`}
          className="text-sm text-accent hover:underline"
        >
          {dict.back}
        </Link>
        <h1 className="mt-1 font-[family-name:var(--font-heading)] text-2xl font-bold text-foreground">
          {title}
        </h1>
        <a
          href={`/api/people/${person.id}/export`}
          className="text-sm text-accent hover:underline"
        >
          {dict.exportLink}
        </a>
      </div>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="font-heading text-sm font-bold">
          {dict.assignmentsHeading}
        </h2>
        <p className="text-xs text-foreground-muted">{dict.assignmentsIntro}</p>
        <form
          action={addAssignmentAction}
          className="flex flex-wrap items-end gap-3 text-sm"
        >
          <label className="flex flex-col gap-1">
            {dict.targetTypeLabel}
            <select
              name="targetType"
              className="rounded border border-border bg-background px-2 py-1"
            >
              <option value="workstation">{dict.targetWorkstation}</option>
              <option value="orgunit">{dict.targetOrgUnit}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            {dict.targetLabel}
            <select
              name="target"
              className="rounded border border-border bg-background px-2 py-1"
            >
              <optgroup label={dict.targetWorkstation}>
                {workstations.map((w) => (
                  <option key={`w-${w.id}`} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label={dict.targetOrgUnit}>
                {orgUnits.map((o) => (
                  <option key={`o-${o.id}`} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            {dict.validFromLabel}
            <input
              type="date"
              name="validFrom"
              className="rounded border border-border bg-background px-2 py-1"
            />
          </label>
          <button
            type="submit"
            className="rounded-[var(--radius-md)] bg-accent px-3 py-1.5 font-medium text-background"
          >
            {dict.addButton}
          </button>
        </form>
        {activeAssignments.length === 0 ? (
          <p className="text-sm text-foreground-muted">
            {dict.assignmentsEmpty}
          </p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {activeAssignments.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3"
              >
                <span className="text-foreground">
                  {a.workstationId
                    ? `${dict.targetWorkstation}: ${wsName.get(a.workstationId) ?? dict.none}`
                    : `${dict.targetOrgUnit}: ${a.orgUnitId ? (ouName.get(a.orgUnitId) ?? dict.none) : dict.none}`}
                </span>
                <form action={endAssignmentAction}>
                  <input type="hidden" name="assignmentId" value={a.id} />
                  <button
                    type="submit"
                    className="text-xs text-foreground-subtle hover:text-accent hover:underline"
                  >
                    {dict.endButton}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
        <h2 className="font-heading text-sm font-bold">
          {dict.legalHoldHeading}
        </h2>
        <p className="text-xs text-foreground-muted">{dict.legalHoldIntro}</p>
        {person.legalHold && (
          <p className="text-sm font-semibold text-status-high">
            {dict.legalHoldActive}
            {person.legalHoldReason ? ` — ${person.legalHoldReason}` : ""}
          </p>
        )}
        {person.legalHold ? (
          <form action={legalHoldAction}>
            <button
              type="submit"
              className="self-start rounded border border-border px-3 py-1.5 text-sm hover:border-accent"
            >
              {dict.clearHold}
            </button>
          </form>
        ) : (
          <form
            action={legalHoldAction}
            className="flex flex-wrap items-end gap-2 text-sm"
          >
            <input type="hidden" name="hold" value="on" />
            <label className="flex flex-col gap-1">
              {dict.legalHoldReasonLabel}
              <input
                name="reason"
                className="rounded border border-border bg-background px-2 py-1"
              />
            </label>
            <button
              type="submit"
              className="rounded border border-border px-3 py-1.5 text-coral hover:border-coral"
            >
              {dict.setHold}
            </button>
          </form>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-sm font-bold">
          {dict.trainingHeading}
        </h2>
        {person.trainingRecords.length === 0 ? (
          <p className="text-sm text-foreground-muted">{dict.trainingEmpty}</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-foreground-muted">
                <th className="py-1 pr-4">{dict.colRequirement}</th>
                <th className="py-1 pr-4">{dict.colDate}</th>
                <th className="py-1">{dict.colValidUntil}</th>
              </tr>
            </thead>
            <tbody>
              {person.trainingRecords.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="py-1.5 pr-4 text-foreground">
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
