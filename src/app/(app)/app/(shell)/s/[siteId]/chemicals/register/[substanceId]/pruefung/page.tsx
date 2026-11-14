import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import { getEngineComparisons } from "@/lib/chemicals/engines/comparison";
import { isEnginePreviewable } from "@/lib/chemicals/engines/engine-flags";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";

// P16 §4: the "Prüfung & Berechnung" tab — engine output next to the SDS, with the
// PREVIEW banner. Only PREVIEW+ engines appear (getEngineComparisons filters OFF).
export default async function PruefungPage({
  params,
}: {
  params: Promise<{ siteId: string; substanceId: string }>;
}) {
  const { siteId, substanceId } = await params;
  const { site } = await requireSiteAdministrationAccess(siteId);
  const locale = await getLocale();
  const chem = getAdministrationDictionary(locale).chemicals;
  const dict = chem.pruefung;

  const substance = await prisma.substance.findFirst({
    where: { id: substanceId, companyId: site.companyId },
    select: { id: true, tradeName: true },
  });
  if (!substance) notFound();

  const comparisons = await getEngineComparisons(
    substanceId,
    site.companyId,
    site.country,
  );
  const showBanner = comparisons.some((c) => c.state === "PREVIEW");
  const sdsDraftAvailable = await isEnginePreviewable(
    "sds.authoring",
    site.companyId,
  );

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

      {showBanner && (
        <p className="rounded-lg border border-amber/40 bg-amber/10 p-3 text-sm font-medium text-foreground">
          {dict.banner}
        </p>
      )}

      {sdsDraftAvailable && (
        <a
          href={`/api/sites/${siteId}/substances/${substanceId}/sds-draft`}
          className="self-start rounded-[var(--radius-md)] border border-border px-3 py-1.5 text-sm hover:border-accent"
        >
          {dict.sdsDraftButton}
        </a>
      )}

      {comparisons.length === 0 ? (
        <p className="text-sm text-foreground-muted">{dict.noEngines}</p>
      ) : (
        comparisons.map((c) => (
          <section
            key={c.engineKey}
            className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 text-sm"
          >
            <h2 className="font-heading text-sm font-bold">
              {chem.composition.engineLabels[
                c.engineKey as keyof typeof chem.composition.engineLabels
              ] ?? c.engineKey}
            </h2>
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs text-foreground-subtle">
                  <th className="pb-1">{dict.colItem}</th>
                  <th className="pb-1">{dict.colSds}</th>
                  <th className="pb-1">{dict.colEngine}</th>
                </tr>
              </thead>
              <tbody>
                {c.rows.map((r, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: fixed per-engine comparison rows in a stable order.
                  <tr key={i} className="border-t border-border first:border-0">
                    <td className="py-1 pr-3">{r.label}</td>
                    <td className="py-1 pr-3 text-foreground-muted">
                      {r.sdsValue ?? "—"}
                    </td>
                    <td
                      className={`py-1 ${r.status === "deviation" ? "text-coral" : ""}`}
                    >
                      {r.engineValue ?? "—"}
                      {r.status === "deviation"
                        ? ` ⚠ ${dict.statusDeviation}`
                        : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {c.refusedReason && (
              <p className="text-xs text-foreground-subtle">
                {dict.refusedPrefix}: {c.refusedReason}
              </p>
            )}
          </section>
        ))
      )}
    </div>
  );
}
