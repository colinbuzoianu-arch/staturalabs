import { revalidatePath } from "next/cache";
import type { StorageLocationType } from "@/generated/prisma/enums";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import { getSiteStorageOverview } from "@/lib/chemicals/storage-compatibility-site";
import { createStorageLocation } from "@/lib/chemicals/storage-location";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";

const LOCATION_TYPES: StorageLocationType[] = [
  "ROOM",
  "CABINET",
  "OUTDOOR_AREA",
  "TANK",
  "OTHER",
];

// P15 S5b: storage locations + the TRGS 510 Zusammenlagerung check (DE sites).
// AT/CH show "keine Zusammenlagerungsregel hinterlegt" (fail-closed §3.15).
export default async function StoragePage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const { site } = await requireSiteAdministrationAccess(siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).chemicals.storage;

  async function addLocationAction(formData: FormData) {
    "use server";
    const { site: s } = await requireSiteAdministrationAccess(siteId);
    const name = formData.get("name");
    if (typeof name !== "string" || !name.trim()) return;
    const type = formData.get("type");
    await createStorageLocation({
      siteId: s.id,
      name,
      type: (LOCATION_TYPES as string[]).includes(type as string)
        ? (type as StorageLocationType)
        : "OTHER",
    });
    revalidatePath(`/app/s/${siteId}/chemicals/storage`);
  }

  const overview = await getSiteStorageOverview(siteId, site.country);

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

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 text-sm">
        <h2 className="font-heading text-sm font-bold">
          {dict.addLocationHeading}
        </h2>
        <form
          action={addLocationAction}
          className="flex flex-wrap items-end gap-3"
        >
          <label className="flex flex-col gap-1">
            {dict.locationNameLabel}
            <input
              name="name"
              required
              className="rounded border border-border bg-background px-2 py-1"
            />
          </label>
          <label className="flex flex-col gap-1">
            {dict.locationTypeLabel}
            <select
              name="type"
              className="rounded border border-border bg-background px-2 py-1"
            >
              {LOCATION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {dict.locationTypes[t]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-[var(--radius-md)] bg-accent px-3 py-1.5 font-medium text-background"
          >
            {dict.addLocationButton}
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        {overview.length === 0 ? (
          <p className="text-sm text-foreground-muted">{dict.locationsEmpty}</p>
        ) : (
          overview.map((loc) => (
            <div
              key={loc.locationId}
              className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 text-sm"
            >
              <h3 className="font-heading font-bold">{loc.name}</h3>
              <p className="text-foreground-muted">
                {dict.lagerklassenPresent}:{" "}
                {loc.lagerklassen.length > 0
                  ? loc.lagerklassen.join(", ")
                  : dict.noLagerklassen}
              </p>
              {!loc.hasMatrix ? (
                <p className="text-xs text-foreground-subtle">
                  {dict.noMatrix}
                </p>
              ) : loc.flags.length === 0 ? (
                <p className="text-xs text-info">{dict.allClear}</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {loc.flags.map((f) => (
                    <li
                      key={`${f.a}-${f.b}`}
                      className={
                        f.result === "NOT_ALLOWED" ? "text-coral" : "text-amber"
                      }
                    >
                      {f.a} + {f.b} —{" "}
                      {f.result === "NOT_ALLOWED"
                        ? dict.flagNotAllowed
                        : dict.flagConditional}
                      {f.conditionNote ? ` (${f.conditionNote})` : ""}
                      {f.tableRef ? ` · ${f.tableRef}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))
        )}
      </section>
    </div>
  );
}
