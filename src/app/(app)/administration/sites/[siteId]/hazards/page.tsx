import { revalidatePath } from "next/cache";
import { HazardCategory, PlatformRole } from "@/generated/prisma/enums";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";

const HAZARD_CATEGORIES = Object.values(HazardCategory);

// Catalogs | Company hazard additions | company_admin only (see CLAUDE.md
// M5 write-permission table) — site_admin can view both the system catalog
// and the company's own additions, but the create form only renders for
// company_admin. No M3 lib gate for this: unlike OrgUnit/Process, adding a
// Hazard has no cross-cutting invariant beyond "companyId scoped,
// isSystem = false," which the inline check below covers directly.
export default async function HazardsPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const { user, site } = await requireSiteAdministrationAccess(siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).hazardsPage;
  const categoryLabels =
    getAdministrationDictionary(locale).hazardCategoryLabels;
  const companyId = site.companyId;

  async function createHazardAction(formData: FormData) {
    "use server";
    const { user } = await requireSiteAdministrationAccess(siteId);
    const dict = getAdministrationDictionary(await getLocale()).hazardsPage;

    if (user.role !== PlatformRole.COMPANY_ADMIN) {
      throw new Error(dict.companyAdminOnlyNote);
    }
    if (!user.companyId) {
      throw new Error(dict.companyAdminOnlyNote);
    }

    const categoryRaw = formData.get("category");
    if (
      typeof categoryRaw !== "string" ||
      !(HAZARD_CATEGORIES as string[]).includes(categoryRaw)
    ) {
      throw new Error(dict.categoryRequired);
    }

    const code = formData.get("code");
    if (typeof code !== "string" || code.trim().length === 0) {
      throw new Error(dict.codeRequired);
    }

    const name = formData.get("name");
    if (typeof name !== "string" || name.trim().length === 0) {
      throw new Error(dict.nameRequired);
    }

    const descriptionRaw = formData.get("description");
    const description =
      typeof descriptionRaw === "string" && descriptionRaw.trim().length > 0
        ? descriptionRaw.trim()
        : null;

    await prisma.hazard.create({
      data: {
        companyId: user.companyId,
        category: categoryRaw as HazardCategory,
        code: code.trim(),
        name: name.trim(),
        description,
        isSystem: false,
      },
    });

    revalidatePath(`/administration/sites/${siteId}/hazards`);
  }

  const [systemHazards, companyHazards] = await Promise.all([
    prisma.hazard.findMany({
      where: { companyId: null },
      orderBy: [{ category: "asc" }, { code: "asc" }],
    }),
    prisma.hazard.findMany({
      where: { companyId },
      orderBy: [{ category: "asc" }, { code: "asc" }],
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

      {user.role === PlatformRole.COMPANY_ADMIN ? (
        <section className="flex flex-col gap-4">
          <h2 className="font-heading text-lg font-bold">
            {dict.createHeading}
          </h2>
          <form
            action={createHazardAction}
            className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface p-4"
          >
            <label className="flex flex-col gap-1 text-sm">
              {dict.categoryLabel}
              <select
                name="category"
                className="rounded border border-border bg-background px-2 py-1"
              >
                {HAZARD_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {categoryLabels[category]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {dict.codeLabel}
              <input
                name="code"
                required
                className="rounded border border-border bg-background px-2 py-1"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {dict.nameLabel}
              <input
                name="name"
                required
                className="rounded border border-border bg-background px-2 py-1"
              />
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
      ) : (
        <p className="text-sm text-border">{dict.companyAdminOnlyNote}</p>
      )}

      <HazardTable
        heading={dict.systemHeading}
        hazards={systemHazards}
        dict={dict}
        categoryLabels={categoryLabels}
      />
      <HazardTable
        heading={dict.companyHeading}
        hazards={companyHazards}
        dict={dict}
        categoryLabels={categoryLabels}
      />
    </div>
  );
}

function HazardTable({
  heading,
  hazards,
  dict,
  categoryLabels,
}: {
  heading: string;
  hazards: Array<{
    id: string;
    category: HazardCategory;
    code: string;
    name: string;
    description: string | null;
  }>;
  dict: {
    empty: string;
    colCategory: string;
    colCode: string;
    colName: string;
    colDescription: string;
  };
  categoryLabels: Record<HazardCategory, string>;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-heading text-lg font-bold">{heading}</h2>
      {hazards.length === 0 ? (
        <p className="text-sm text-border">{dict.empty}</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="py-1 pr-4">{dict.colCategory}</th>
              <th className="py-1 pr-4">{dict.colCode}</th>
              <th className="py-1 pr-4">{dict.colName}</th>
              <th className="py-1">{dict.colDescription}</th>
            </tr>
          </thead>
          <tbody>
            {hazards.map((hazard) => (
              <tr
                key={hazard.id}
                className="border-b border-border last:border-0"
              >
                <td className="py-1 pr-4">{categoryLabels[hazard.category]}</td>
                <td className="py-1 pr-4">{hazard.code}</td>
                <td className="py-1 pr-4">{hazard.name}</td>
                <td className="py-1">{hazard.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
