import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import { getEngineReadiness } from "@/lib/chemicals/engines/data-readiness-store";
import {
  autoFillFromSds,
  getMixtureComponents,
  type MixtureComponentEditInput,
  setMixtureComponents,
} from "@/lib/chemicals/mixture-composition-store";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";

const BLANK_ROWS = 3;

// P16 §3.1–3.2: the composition editor + data-readiness (Datenbasis) panel.
export default async function CompositionPage({
  params,
}: {
  params: Promise<{ siteId: string; substanceId: string }>;
}) {
  const { siteId, substanceId } = await params;
  const { site } = await requireSiteAdministrationAccess(siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).chemicals.composition;
  const companyId = site.companyId;

  const substance = await prisma.substance.findFirst({
    where: { id: substanceId, companyId },
    select: { id: true, tradeName: true },
  });
  if (!substance) notFound();

  async function autoFillAction() {
    "use server";
    const { site: s, user } = await requireSiteAdministrationAccess(siteId);
    await autoFillFromSds({
      substanceId,
      companyId: s.companyId,
      actorUserId: user.id,
    });
    redirect(`/app/s/${siteId}/chemicals/register/${substanceId}/composition`);
  }

  async function saveAction(formData: FormData) {
    "use server";
    const { site: s, user } = await requireSiteAdministrationAccess(siteId);
    const count = Number(formData.get("rowCount") ?? 0);
    const numOrNull = (k: string) => {
      const v = formData.get(k);
      if (typeof v !== "string" || v.trim() === "") return null;
      const n = Number(v.replace(",", "."));
      return Number.isFinite(n) ? n : null;
    };
    const str = (k: string) => {
      const v = formData.get(k);
      return typeof v === "string" && v.trim() ? v.trim() : null;
    };
    const components: MixtureComponentEditInput[] = [];
    for (let i = 0; i < count; i++) {
      const name = str(`r_${i}_name`);
      if (!name) continue;
      components.push({
        name,
        casNumber: str(`r_${i}_cas`),
        concentrationExactPct: numOrNull(`r_${i}_exact`),
        concentrationMinPct: numOrNull(`r_${i}_min`),
        concentrationMaxPct: numOrNull(`r_${i}_max`),
        classification: str(`r_${i}_class`),
        wgk: numOrNull(`r_${i}_wgk`),
      });
    }
    await setMixtureComponents({
      substanceId,
      companyId: s.companyId,
      actorUserId: user.id,
      components,
    });
    redirect(`/app/s/${siteId}/chemicals/register/${substanceId}/composition`);
  }

  const components = await getMixtureComponents(substanceId);
  const readiness = await getEngineReadiness(substanceId);
  const rows = [
    ...components.map((c) => ({
      name: c.name,
      cas: c.casNumber ?? "",
      exact: c.concentrationExactPct?.toString() ?? "",
      min: c.concentrationMinPct?.toString() ?? "",
      max: c.concentrationMaxPct?.toString() ?? "",
      cls: c.classification ?? "",
      wgk: c.wgk?.toString() ?? "",
    })),
    ...Array.from({ length: BLANK_ROWS }, () => ({
      name: "",
      cas: "",
      exact: "",
      min: "",
      max: "",
      cls: "",
      wgk: "",
    })),
  ];
  const inputCls =
    "rounded border border-border bg-background px-1.5 py-1 text-sm";

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
      <Link
        href={`/app/s/${siteId}/chemicals/register/${substanceId}`}
        className="text-sm text-accent hover:underline"
      >
        {dict.back}
      </Link>
      <div>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-foreground">
          {dict.heading}
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">
          {substance.tradeName} — {dict.intro}
        </p>
      </div>

      <form action={autoFillAction}>
        <button
          type="submit"
          className="rounded-[var(--radius-md)] border border-border px-3 py-1.5 text-sm hover:border-accent"
        >
          {dict.autoFill}
        </button>
        <span className="ml-2 text-xs text-foreground-subtle">
          {dict.autoFillHint}
        </span>
      </form>

      <form
        action={saveAction}
        className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4"
      >
        <input type="hidden" name="rowCount" value={rows.length} />
        <p className="text-xs text-foreground-subtle">{dict.concHint}</p>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs text-foreground-subtle">
              <th className="pb-1">{dict.colName}</th>
              <th className="pb-1">{dict.colCas}</th>
              <th className="pb-1">{dict.colExact}</th>
              <th className="pb-1">{dict.colMin}</th>
              <th className="pb-1">{dict.colMax}</th>
              <th className="pb-1">{dict.colClassification}</th>
              <th className="pb-1">{dict.colWgk}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length editor rows (existing components + a fixed number of blank rows); the index is the stable submit key.
              <tr key={i}>
                <td className="pr-1">
                  <input
                    name={`r_${i}_name`}
                    defaultValue={r.name}
                    className={`${inputCls} w-full`}
                  />
                </td>
                <td className="pr-1">
                  <input
                    name={`r_${i}_cas`}
                    defaultValue={r.cas}
                    className={`${inputCls} w-24`}
                  />
                </td>
                <td className="pr-1">
                  <input
                    name={`r_${i}_exact`}
                    defaultValue={r.exact}
                    className={`${inputCls} w-16`}
                  />
                </td>
                <td className="pr-1">
                  <input
                    name={`r_${i}_min`}
                    defaultValue={r.min}
                    className={`${inputCls} w-16`}
                  />
                </td>
                <td className="pr-1">
                  <input
                    name={`r_${i}_max`}
                    defaultValue={r.max}
                    className={`${inputCls} w-16`}
                  />
                </td>
                <td className="pr-1">
                  <input
                    name={`r_${i}_class`}
                    defaultValue={r.cls}
                    className={`${inputCls} w-full`}
                  />
                </td>
                <td className="pr-1">
                  <input
                    name={`r_${i}_wgk`}
                    defaultValue={r.wgk}
                    className={`${inputCls} w-12`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          type="submit"
          className="self-start rounded-[var(--radius-md)] bg-accent px-4 py-2 font-medium text-background"
        >
          {dict.save}
        </button>
      </form>

      <section className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 text-sm">
        <h2 className="font-heading text-sm font-bold">
          {dict.dataBasisHeading}
        </h2>
        <ul className="flex flex-col gap-1">
          {readiness.map((r) => (
            <li key={r.engineKey} className="flex flex-wrap items-center gap-2">
              <span className="font-medium">
                {dict.engineLabels[
                  r.engineKey as keyof typeof dict.engineLabels
                ] ?? r.engineKey}
              </span>
              {r.ready ? (
                <span className="text-info">{dict.ready}</span>
              ) : (
                <span className="text-coral">
                  {dict.notReady} — {dict.missingLabel}: {r.missing.join(", ")}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
