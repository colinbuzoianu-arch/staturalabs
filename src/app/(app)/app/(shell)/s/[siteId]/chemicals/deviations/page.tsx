import Link from "next/link";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import { getSiteDeviations } from "@/lib/chemicals/engines/comparison";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";

// P16 §4 (site overview): "Abweichungen SDB ↔ Berechnung" — products where a
// preview calculation differs from the supplier SDS. Preview only; a checking aid.
export default async function DeviationsPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const { site } = await requireSiteAdministrationAccess(siteId);
  const dict = getAdministrationDictionary(await getLocale()).chemicals
    .deviations;

  const deviations = await getSiteDeviations(site.companyId, site.country);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-foreground">
          {dict.heading}
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">{dict.intro}</p>
      </div>
      {deviations.length === 0 ? (
        <p className="text-sm text-foreground-muted">{dict.empty}</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-foreground-subtle">
              <th className="py-1 pr-3">{dict.colProduct}</th>
              <th className="py-1 pr-3">{dict.colDeviations}</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody>
            {deviations.map((d) => (
              <tr
                key={d.substanceId}
                className="border-b border-border last:border-0"
              >
                <td className="py-1.5 pr-3 font-medium">{d.tradeName}</td>
                <td className="py-1.5 pr-3 text-coral">
                  {d.items.join(" · ")}
                </td>
                <td className="py-1.5 text-right">
                  <Link
                    href={`/app/s/${siteId}/chemicals/register/${d.substanceId}/pruefung`}
                    className="text-accent hover:underline"
                  >
                    {dict.open}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
