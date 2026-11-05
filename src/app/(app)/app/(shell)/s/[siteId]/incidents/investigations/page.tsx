import Link from "next/link";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";

// P10a §7.4: events currently under investigation or with actions pending.
export default async function IncidentInvestigationsPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  await requireSiteAdministrationAccess(siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).incidents;

  const incidents = await prisma.incident.findMany({
    where: {
      siteId,
      status: { in: ["UNDER_INVESTIGATION", "ACTIONS_PENDING"] },
    },
    orderBy: { occurredAt: "desc" },
  });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
      <div>
        <p className="font-technical text-xs uppercase tracking-[0.2em] text-foreground-subtle">
          {dict.eyebrow}
        </p>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-foreground">
          {dict.investigationsHeading}
        </h1>
      </div>

      {incidents.length === 0 ? (
        <p className="text-sm text-foreground-muted">
          {dict.investigationsEmpty}
        </p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-foreground-muted">
              <th className="py-1 pr-4">{dict.colTitle}</th>
              <th className="py-1 pr-4">{dict.colType}</th>
              <th className="py-1 pr-4">{dict.colStatus}</th>
              <th className="py-1 pr-4">{dict.colSeverity}</th>
              <th className="py-1 pr-4">{dict.colOccurred}</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody>
            {incidents.map((i) => (
              <tr key={i.id} className="border-b border-border last:border-0">
                <td className="py-1.5 pr-4 font-medium text-foreground">
                  {i.title}
                </td>
                <td className="py-1.5 pr-4 text-foreground-muted">
                  {dict.typeLabels[i.type]}
                </td>
                <td className="py-1.5 pr-4 text-foreground-muted">
                  {dict.statusLabels[i.status]}
                </td>
                <td className="py-1.5 pr-4 text-foreground-muted">
                  {i.severity ?? dict.none}
                </td>
                <td className="py-1.5 pr-4 text-foreground-muted">
                  {i.occurredAt.toISOString().slice(0, 10)}
                </td>
                <td className="py-1.5">
                  <Link
                    href={`/app/s/${siteId}/incidents/${i.id}`}
                    className="text-accent hover:underline"
                  >
                    {dict.openLink}
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
