import Link from "next/link";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";

// P9 §7.3: completed & closed inspections.
export default async function PerformedInspectionsPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  await requireSiteAdministrationAccess(siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).inspections;

  const inspections = await prisma.inspection.findMany({
    where: { siteId, status: { in: ["COMPLETED", "CLOSED"] } },
    orderBy: { performedDate: "desc" },
  });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
      <div>
        <p className="font-technical text-xs uppercase tracking-[0.2em] text-foreground-subtle">
          {dict.eyebrow}
        </p>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-foreground">
          {dict.performedHeading}
        </h1>
      </div>

      {inspections.length === 0 ? (
        <p className="text-sm text-foreground-muted">{dict.performedEmpty}</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-foreground-muted">
              <th className="py-1 pr-4">{dict.colTitle}</th>
              <th className="py-1 pr-4">{dict.colType}</th>
              <th className="py-1 pr-4">{dict.colStatus}</th>
              <th className="py-1 pr-4">{dict.colPerformed}</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody>
            {inspections.map((i) => (
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
                  {i.performedDate
                    ? i.performedDate.toISOString().slice(0, 10)
                    : dict.none}
                </td>
                <td className="py-1.5">
                  <Link
                    href={`/app/s/${siteId}/inspections/${i.id}`}
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
