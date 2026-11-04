import { revalidatePath } from "next/cache";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import {
  anonymisePerson,
  createPerson,
  deactivatePerson,
} from "@/lib/people/person";
import { prisma } from "@/lib/prisma";

// P7a Personen register (SLD_P7_COMPARTMENT_DESIGN_NOTE.md, plan §7.7). The
// first person-data surface. Company-scoped (persons belong to the company,
// not a single site) but reached from the site shell; gated by
// requireSiteAdministrationAccess. Create / deactivate / anonymise, plus a
// DSAR export link. CSV import and the instruction matrix land in P7b/P7c.
export default async function PeoplePage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const { site } = await requireSiteAdministrationAccess(siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).peoplePage;
  const companyId = site.companyId;

  async function createPersonAction(formData: FormData) {
    "use server";
    const { user, site: s } = await requireSiteAdministrationAccess(siteId);
    const d = getAdministrationDictionary(await getLocale()).peoplePage;

    const firstName = formData.get("firstName");
    const lastName = formData.get("lastName");
    if (
      typeof firstName !== "string" ||
      firstName.trim().length === 0 ||
      typeof lastName !== "string" ||
      lastName.trim().length === 0
    ) {
      throw new Error(d.firstNameRequired);
    }
    const personnelNumberRaw = formData.get("personnelNumber");
    const orgUnitIdRaw = formData.get("orgUnitId");
    const employmentStartRaw = formData.get("employmentStart");

    // Validate an optional org unit belongs to this company (plain column, so
    // the app layer owns the integrity the missing FK would otherwise give).
    let orgUnitId: string | null = null;
    if (typeof orgUnitIdRaw === "string" && orgUnitIdRaw.length > 0) {
      const orgUnit = await prisma.orgUnit.findUnique({
        where: { id: orgUnitIdRaw },
        select: { site: { select: { companyId: true } } },
      });
      if (orgUnit && orgUnit.site.companyId === s.companyId) {
        orgUnitId = orgUnitIdRaw;
      }
    }

    await createPerson({
      companyId: s.companyId,
      firstName,
      lastName,
      personnelNumber:
        typeof personnelNumberRaw === "string" ? personnelNumberRaw : null,
      orgUnitId,
      employmentStart:
        typeof employmentStartRaw === "string" &&
        employmentStartRaw.trim().length > 0
          ? new Date(employmentStartRaw)
          : null,
      actorUserId: user.id,
    });
    revalidatePath(`/app/s/${siteId}/people`);
  }

  async function deactivateAction(formData: FormData) {
    "use server";
    const { user, site: s } = await requireSiteAdministrationAccess(siteId);
    const id = formData.get("personId");
    if (typeof id === "string" && id.length > 0) {
      const person = await prisma.person.findUnique({
        where: { id },
        select: { companyId: true },
      });
      if (person && person.companyId === s.companyId) {
        await deactivatePerson(id, user.id);
      }
    }
    revalidatePath(`/app/s/${siteId}/people`);
  }

  async function anonymiseAction(formData: FormData) {
    "use server";
    const { user, site: s } = await requireSiteAdministrationAccess(siteId);
    const id = formData.get("personId");
    if (typeof id === "string" && id.length > 0) {
      const person = await prisma.person.findUnique({
        where: { id },
        select: { companyId: true },
      });
      if (person && person.companyId === s.companyId) {
        await anonymisePerson(id, user.id);
      }
    }
    revalidatePath(`/app/s/${siteId}/people`);
  }

  const [people, orgUnits] = await Promise.all([
    prisma.person.findMany({
      where: { companyId },
      orderBy: [{ active: "desc" }, { lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.orgUnit.findMany({
      where: { site: { companyId } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const orgUnitName = new Map(orgUnits.map((o) => [o.id, o.name]));

  function statusLabel(p: (typeof people)[number]): string {
    if (p.anonymisedAt) return dict.statusAnonymised;
    return p.active ? dict.statusActive : dict.statusInactive;
  }

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
        <h2 className="font-heading text-sm font-bold">{dict.addHeading}</h2>
        <form
          action={createPersonAction}
          className="flex flex-col gap-3 text-sm"
        >
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1">
              {dict.firstNameLabel}
              <input
                name="firstName"
                required
                className="rounded border border-border bg-background px-2 py-1"
              />
            </label>
            <label className="flex flex-col gap-1">
              {dict.lastNameLabel}
              <input
                name="lastName"
                required
                className="rounded border border-border bg-background px-2 py-1"
              />
            </label>
            <label className="flex flex-col gap-1">
              {dict.personnelNumberLabel}
              <input
                name="personnelNumber"
                className="rounded border border-border bg-background px-2 py-1"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1">
              {dict.orgUnitLabel}
              <select
                name="orgUnitId"
                className="rounded border border-border bg-background px-2 py-1"
              >
                <option value="">{dict.none}</option>
                {orgUnits.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              {dict.employmentStartLabel}
              <input
                type="date"
                name="employmentStart"
                className="rounded border border-border bg-background px-2 py-1"
              />
            </label>
          </div>
          <button
            type="submit"
            className="self-start rounded-[var(--radius-md)] bg-accent px-4 py-2 font-medium text-white"
          >
            {dict.addButton}
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-sm font-bold">{dict.listHeading}</h2>
        {people.length === 0 ? (
          <p className="text-sm text-foreground-muted">{dict.listEmpty}</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-foreground-muted">
                <th className="py-1 pr-4">{dict.colName}</th>
                <th className="py-1 pr-4">{dict.colPersonnelNumber}</th>
                <th className="py-1 pr-4">{dict.colOrgUnit}</th>
                <th className="py-1 pr-4">{dict.colStatus}</th>
                <th className="py-1" />
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="py-1.5 pr-4 font-medium text-foreground">
                    {p.anonymisedAt
                      ? dict.statusAnonymised
                      : `${p.lastName}, ${p.firstName}`}
                  </td>
                  <td className="py-1.5 pr-4 text-foreground-muted">
                    {p.personnelNumber ?? dict.none}
                  </td>
                  <td className="py-1.5 pr-4 text-foreground-muted">
                    {p.orgUnitId
                      ? (orgUnitName.get(p.orgUnitId) ?? dict.none)
                      : dict.none}
                  </td>
                  <td className="py-1.5 pr-4 text-foreground-muted">
                    {statusLabel(p)}
                  </td>
                  <td className="flex flex-wrap items-center gap-2 py-1.5">
                    <a
                      href={`/api/people/${p.id}/export`}
                      className="text-accent hover:underline"
                    >
                      {dict.exportLink}
                    </a>
                    {p.active && !p.anonymisedAt && (
                      <form action={deactivateAction}>
                        <input type="hidden" name="personId" value={p.id} />
                        <button
                          type="submit"
                          className="text-foreground-subtle hover:text-accent hover:underline"
                        >
                          {dict.deactivate}
                        </button>
                      </form>
                    )}
                    {!p.anonymisedAt && (
                      <form action={anonymiseAction}>
                        <input type="hidden" name="personId" value={p.id} />
                        <button
                          type="submit"
                          title={dict.anonymiseConfirm}
                          className="text-coral hover:underline"
                        >
                          {dict.anonymise}
                        </button>
                      </form>
                    )}
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
