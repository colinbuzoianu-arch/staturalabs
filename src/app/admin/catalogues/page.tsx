import { revalidatePath } from "next/cache";
import {
  activateCatalogueVersion,
  CATALOGUES,
  listCatalogueVersions,
} from "@/lib/admin/catalogue-admin";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { getAdminDictionary } from "@/lib/i18n/dictionaries/admin";
import { getLocale } from "@/lib/i18n/get-locale";

// P13 §2.3: super-admin catalogue version control. Lists each single-active
// catalogue's versions with row counts + provenance, and activates a different
// version in one audited, fail-closed action.
export default async function CataloguesPage() {
  await requireSuperAdmin();
  const locale = await getLocale();
  const dict = getAdminDictionary(locale).cataloguesPage;

  async function activateAction(formData: FormData) {
    "use server";
    const actor = await requireSuperAdmin();
    const key = formData.get("key");
    const version = formData.get("version");
    if (typeof key !== "string" || typeof version !== "string") return;
    await activateCatalogueVersion({ key, version, actorUserId: actor.id });
    revalidatePath("/admin/catalogues");
  }

  const sections = await Promise.all(
    CATALOGUES.map(async (c) => ({
      key: c.key,
      provenance: c.provenance,
      rows: await listCatalogueVersions(c.key),
    })),
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">{dict.heading}</h1>
        <p className="mt-1 text-xs text-gray-500">{dict.intro}</p>
      </div>

      {sections.map((section) => (
        <section key={section.key} className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">
            {dict.catalogueLabels[
              section.key as keyof typeof dict.catalogueLabels
            ] ?? section.key}
          </h2>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b">
                <th className="py-1 pr-3">{dict.colVersion}</th>
                <th className="py-1 pr-3">{dict.colLabel}</th>
                <th className="py-1 pr-3">{dict.colActive}</th>
                <th className="py-1 pr-3">{dict.colRows}</th>
                {section.provenance && (
                  <th className="py-1 pr-3">{dict.colVerified}</th>
                )}
                <th className="py-1 pr-3">{dict.colActivatedAt}</th>
                <th className="py-1" />
              </tr>
            </thead>
            <tbody>
              {section.rows.map((v) => (
                <tr key={v.version} className="border-b last:border-0">
                  <td className="py-1 pr-3 font-mono">{v.version}</td>
                  <td className="py-1 pr-3">{v.label ?? dict.none}</td>
                  <td className="py-1 pr-3">
                    {v.isActive ? dict.activeBadge : ""}
                  </td>
                  <td className="py-1 pr-3">{v.rowCount}</td>
                  {section.provenance && (
                    <td className="py-1 pr-3">
                      {v.verifiedBy
                        ? `${v.verifiedBy} · ${v.verifiedAt ? v.verifiedAt.toISOString().slice(0, 10) : ""}`
                        : dict.none}
                    </td>
                  )}
                  <td className="py-1 pr-3">
                    {v.activatedAt.toISOString().slice(0, 10)}
                  </td>
                  <td className="py-1">
                    {!v.isActive && (
                      <form action={activateAction}>
                        <input type="hidden" name="key" value={section.key} />
                        <input type="hidden" name="version" value={v.version} />
                        <button
                          type="submit"
                          className="rounded border px-2 py-0.5"
                        >
                          {dict.activate}
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
