import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { OrgUnitType } from "@/generated/prisma/enums";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import { createOrgUnit } from "@/lib/org-unit";
import { prisma } from "@/lib/prisma";

const ORG_UNIT_TYPES = Object.values(OrgUnitType);

export default async function OrgUnitsPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  await requireSiteAdministrationAccess(siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).orgUnitsPage;
  const commonDict = getAdministrationDictionary(locale).common;
  const typeLabels = getAdministrationDictionary(locale).orgUnitTypeLabels;

  async function createOrgUnitAction(formData: FormData) {
    "use server";
    await requireSiteAdministrationAccess(siteId);
    const dict = getAdministrationDictionary(await getLocale()).orgUnitsPage;
    const commonDict = getAdministrationDictionary(await getLocale()).common;

    const name = formData.get("name");
    if (typeof name !== "string" || name.trim().length === 0) {
      throw new Error(dict.nameRequired);
    }

    const type = formData.get("type");
    if (
      typeof type !== "string" ||
      !(ORG_UNIT_TYPES as string[]).includes(type)
    ) {
      throw new Error(dict.typeRequired);
    }

    const parentIdRaw = formData.get("parentId");
    const parentId =
      typeof parentIdRaw === "string" && parentIdRaw.length > 0
        ? parentIdRaw
        : null;

    const codeRaw = formData.get("code");
    const code =
      typeof codeRaw === "string" && codeRaw.trim().length > 0
        ? codeRaw.trim()
        : null;

    try {
      await createOrgUnit({
        siteId,
        parentId,
        type: type as OrgUnitType,
        name: name.trim(),
        code,
      });
    } catch (error) {
      throw new Error(
        commonDict.unexpectedError(
          error instanceof Error ? error.message : String(error),
        ),
      );
    }

    revalidatePath(`/administration/sites/${siteId}/org-units`);
  }

  async function assignWorkstationOrgUnitAction(formData: FormData) {
    "use server";
    await requireSiteAdministrationAccess(siteId);
    const commonDict = getAdministrationDictionary(await getLocale()).common;

    const workstationId = formData.get("workstationId");
    if (typeof workstationId !== "string" || workstationId.length === 0) {
      throw new Error(commonDict.unexpectedError("missing workstationId"));
    }

    const orgUnitIdRaw = formData.get("orgUnitId");
    const orgUnitId =
      typeof orgUnitIdRaw === "string" && orgUnitIdRaw.length > 0
        ? orgUnitIdRaw
        : null;

    const workstation = await prisma.workstation.findUnique({
      where: { id: workstationId },
      select: { siteId: true },
    });
    if (!workstation || workstation.siteId !== siteId) notFound();

    if (orgUnitId !== null) {
      const orgUnit = await prisma.orgUnit.findUnique({
        where: { id: orgUnitId },
        select: { siteId: true },
      });
      if (!orgUnit || orgUnit.siteId !== siteId) {
        throw new Error(
          commonDict.unexpectedError("org unit belongs to a different site"),
        );
      }
    }

    await prisma.workstation.update({
      where: { id: workstationId },
      data: { orgUnitId },
    });

    revalidatePath(`/administration/sites/${siteId}/org-units`);
  }

  const [orgUnits, workstations] = await Promise.all([
    prisma.orgUnit.findMany({
      where: { siteId },
      include: { parent: true },
      orderBy: { name: "asc" },
    }),
    prisma.workstation.findMany({
      where: { siteId },
      include: { orgUnit: true },
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
        <h2 className="font-heading text-lg font-bold">
          {dict.orgUnitsHeading}
        </h2>

        <form
          action={createOrgUnitAction}
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
            {dict.typeLabel}
            <select
              name="type"
              className="rounded border border-border bg-background px-2 py-1"
            >
              {ORG_UNIT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {typeLabels[type]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {dict.parentLabel}
            <select
              name="parentId"
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
          <button
            type="submit"
            className="rounded bg-accent px-3 py-1.5 text-sm font-semibold text-background"
          >
            {dict.create}
          </button>
        </form>

        {orgUnits.length === 0 ? (
          <p className="text-sm text-border">{dict.orgUnitsEmpty}</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="py-1 pr-4">{dict.colName}</th>
                <th className="py-1 pr-4">{dict.colType}</th>
                <th className="py-1 pr-4">{dict.colParent}</th>
                <th className="py-1">{dict.colCode}</th>
              </tr>
            </thead>
            <tbody>
              {orgUnits.map((orgUnit) => (
                <tr
                  key={orgUnit.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="py-1 pr-4">{orgUnit.name}</td>
                  <td className="py-1 pr-4">{typeLabels[orgUnit.type]}</td>
                  <td className="py-1 pr-4">
                    {orgUnit.parent?.name ?? commonDict.none}
                  </td>
                  <td className="py-1">{orgUnit.code ?? commonDict.none}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-bold">
          {dict.workstationsHeading}
        </h2>

        {workstations.length === 0 ? (
          <p className="text-sm text-border">{dict.workstationsEmpty}</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="py-1 pr-4">{dict.colWorkstationName}</th>
                <th className="py-1 pr-4">{dict.colWorkstationOrgUnit}</th>
                <th className="py-1" />
              </tr>
            </thead>
            <tbody>
              {workstations.map((workstation) => (
                <tr
                  key={workstation.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="py-1 pr-4">{workstation.name}</td>
                  <td className="py-1 pr-4">
                    <form
                      action={assignWorkstationOrgUnitAction}
                      className="flex items-center gap-2"
                    >
                      <input
                        type="hidden"
                        name="workstationId"
                        value={workstation.id}
                      />
                      <select
                        name="orgUnitId"
                        defaultValue={workstation.orgUnitId ?? ""}
                        className="rounded border border-border bg-background px-2 py-1"
                      >
                        <option value="">{commonDict.none}</option>
                        {orgUnits.map((orgUnit) => (
                          <option key={orgUnit.id} value={orgUnit.id}>
                            {orgUnit.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="rounded border border-border px-2 py-1 text-xs hover:border-accent"
                      >
                        {dict.assign}
                      </button>
                    </form>
                  </td>
                  <td className="py-1" />
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
