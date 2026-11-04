import { revalidatePath } from "next/cache";
import Link from "next/link";
import {
  type CmrCategory,
  PhysicalState,
  type SubstanceSignalWord,
} from "@/generated/prisma/enums";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import { substanceSdsAlerts } from "@/lib/chemicals/alerts";
import { createSubstance } from "@/lib/chemicals/substance";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";

const PHYSICAL_STATES = Object.values(PhysicalState);
const SIGNAL_WORDS: SubstanceSignalWord[] = ["GEFAHR", "ACHTUNG", "NONE"];
const CMR_CATS: CmrCategory[] = ["NONE", "CAT_2", "CAT_1B", "CAT_1A"];

// P8 §5(2) substance register: list (with SDS alerts) + create.
export default async function SubstanceRegisterPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const { site } = await requireSiteAdministrationAccess(siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).chemicals;
  const companyId = site.companyId;
  const siteRequiresDe = site.country === "AT" || site.country === "DE";

  async function createAction(formData: FormData) {
    "use server";
    const { site: s } = await requireSiteAdministrationAccess(siteId);
    const d = getAdministrationDictionary(await getLocale()).chemicals;
    const tradeName = formData.get("tradeName");
    if (typeof tradeName !== "string" || tradeName.trim().length === 0) {
      throw new Error(d.tradeNameRequired);
    }
    const str = (k: string) => {
      const v = formData.get(k);
      return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
    };
    const physical = formData.get("physicalState");
    const signal = formData.get("signalWord");
    const cmr = (k: string): CmrCategory => {
      const v = formData.get(k);
      return (CMR_CATS as string[]).includes(v as string)
        ? (v as CmrCategory)
        : "NONE";
    };
    await createSubstance({
      companyId: s.companyId,
      tradeName,
      manufacturer: str("manufacturer"),
      casNumber: str("casNumber"),
      ecNumber: str("ecNumber"),
      physicalState: (PHYSICAL_STATES as string[]).includes(physical as string)
        ? (physical as PhysicalState)
        : PhysicalState.OTHER,
      signalWord: (SIGNAL_WORDS as string[]).includes(signal as string)
        ? (signal as SubstanceSignalWord)
        : "NONE",
      carcinogenicCategory: cmr("carcinogenicCategory"),
      mutagenicCategory: cmr("mutagenicCategory"),
      reprotoxicCategory: cmr("reprotoxicCategory"),
    });
    revalidatePath(`/app/s/${siteId}/chemicals/register`);
  }

  const substances = await prisma.substance.findMany({
    where: { companyId },
    include: {
      safetyDataSheets: {
        select: { language: true, revisionDate: true, supersededAt: true },
      },
      uses: { select: { activeTo: true } },
    },
    orderBy: { tradeName: "asc" },
  });
  const now = new Date();

  function cmrSummary(s: (typeof substances)[number]): string {
    const tags: string[] = [];
    if (s.carcinogenicCategory !== "NONE")
      tags.push(`C ${dict.cmrLabels[s.carcinogenicCategory]}`);
    if (s.mutagenicCategory !== "NONE")
      tags.push(`M ${dict.cmrLabels[s.mutagenicCategory]}`);
    if (s.reprotoxicCategory !== "NONE")
      tags.push(`R ${dict.cmrLabels[s.reprotoxicCategory]}`);
    return tags.length > 0 ? tags.join(", ") : dict.none;
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
        {siteRequiresDe && (
          <a
            href={`/api/sites/${siteId}/substance-register`}
            className="mt-2 inline-block text-sm text-accent hover:underline"
          >
            {dict.downloadRegister}
          </a>
        )}
      </div>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="font-heading text-sm font-bold">{dict.addHeading}</h2>
        <form action={createAction} className="flex flex-col gap-3 text-sm">
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1">
              {dict.tradeNameLabel}
              <input
                name="tradeName"
                required
                className="rounded border border-border bg-background px-2 py-1"
              />
            </label>
            <label className="flex flex-col gap-1">
              {dict.manufacturerLabel}
              <input
                name="manufacturer"
                className="rounded border border-border bg-background px-2 py-1"
              />
            </label>
            <label className="flex flex-col gap-1">
              {dict.casLabel}
              <input
                name="casNumber"
                className="w-28 rounded border border-border bg-background px-2 py-1"
              />
            </label>
            <label className="flex flex-col gap-1">
              {dict.ecLabel}
              <input
                name="ecNumber"
                className="w-28 rounded border border-border bg-background px-2 py-1"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1">
              {dict.physicalStateLabel}
              <select
                name="physicalState"
                className="rounded border border-border bg-background px-2 py-1"
              >
                {PHYSICAL_STATES.map((p) => (
                  <option key={p} value={p}>
                    {dict.physicalStateLabels[p]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              {dict.signalWordLabel}
              <select
                name="signalWord"
                className="rounded border border-border bg-background px-2 py-1"
              >
                {SIGNAL_WORDS.map((s) => (
                  <option key={s} value={s}>
                    {dict.signalWordLabels[s]}
                  </option>
                ))}
              </select>
            </label>
            {(
              [
                ["carcinogenicCategory", dict.carcinogenicLabel],
                ["mutagenicCategory", dict.mutagenicLabel],
                ["reprotoxicCategory", dict.reprotoxicLabel],
              ] as const
            ).map(([name, label]) => (
              <label key={name} className="flex flex-col gap-1">
                {label}
                <select
                  name={name}
                  className="rounded border border-border bg-background px-2 py-1"
                >
                  {CMR_CATS.map((c) => (
                    <option key={c} value={c}>
                      {dict.cmrLabels[c]}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <button
            type="submit"
            className="self-start rounded-[var(--radius-md)] bg-accent px-4 py-2 font-medium text-background"
          >
            {dict.addButton}
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-sm font-bold">{dict.listHeading}</h2>
        {substances.length === 0 ? (
          <p className="text-sm text-foreground-muted">{dict.listEmpty}</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-foreground-muted">
                <th className="py-1 pr-4">{dict.colName}</th>
                <th className="py-1 pr-4">{dict.colSignal}</th>
                <th className="py-1 pr-4">{dict.colCmr}</th>
                <th className="py-1 pr-4">{dict.colAlerts}</th>
                <th className="py-1" />
              </tr>
            </thead>
            <tbody>
              {substances.map((s) => {
                const alerts = substanceSdsAlerts({
                  hasActiveUse: s.uses.some((u) => u.activeTo === null),
                  sdsList: s.safetyDataSheets,
                  siteRequiresDe,
                  now,
                  staleYears: 2,
                });
                return (
                  <tr
                    key={s.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="py-1.5 pr-4 font-medium text-foreground">
                      {s.tradeName}
                      {s.manufacturer ? (
                        <span className="text-foreground-subtle">
                          {" "}
                          · {s.manufacturer}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-1.5 pr-4 text-foreground-muted">
                      {dict.signalWordLabels[s.signalWord]}
                    </td>
                    <td className="py-1.5 pr-4 text-foreground-muted">
                      {cmrSummary(s)}
                    </td>
                    <td className="py-1.5 pr-4">
                      {alerts.length === 0 ? (
                        <span className="text-foreground-subtle">
                          {dict.none}
                        </span>
                      ) : (
                        alerts.map((a) => (
                          <span
                            key={a}
                            className="mr-1 inline-block rounded bg-status-high/15 px-1.5 py-0.5 text-xs text-status-high"
                          >
                            {dict.alertLabels[a]}
                          </span>
                        ))
                      )}
                    </td>
                    <td className="py-1.5">
                      <Link
                        href={`/app/s/${siteId}/chemicals/register/${s.id}`}
                        className="text-accent hover:underline"
                      >
                        {dict.detailLink}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
