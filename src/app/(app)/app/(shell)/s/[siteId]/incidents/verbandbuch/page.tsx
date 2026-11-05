import Link from "next/link";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";

// P10e §D.5: the Verbandbuch — a print-friendly book of first-aid events
// (type ERSTE_HILFE) at the site, with its own 5-year retention (DGUV V1 §24
// Abs.6 / §16 ASchG). Shows the event, date and involved persons; the medical
// free-text stays in the restricted health sub-compartment and is never shown
// here. A plain list that prints cleanly — no app chrome needed for the print.
export default async function VerbandbuchPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  await requireSiteAdministrationAccess(siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).incidents;

  const entries = await prisma.incident.findMany({
    where: { siteId, type: "ERSTE_HILFE" },
    orderBy: { occurredAt: "desc" },
    include: {
      involvedPersons: {
        include: { person: { select: { firstName: true, lastName: true } } },
      },
    },
  });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
      <div>
        <p className="font-technical text-xs uppercase tracking-[0.2em] text-foreground-subtle">
          {dict.eyebrow}
        </p>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-foreground">
          {dict.verbandbuchHeading}
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">
          {dict.verbandbuchIntro}
        </p>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-foreground-muted">{dict.verbandbuchEmpty}</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-foreground-muted">
              <th className="py-1 pr-4">{dict.colOccurred}</th>
              <th className="py-1 pr-4">{dict.colTitle}</th>
              <th className="py-1 pr-4">{dict.verbandbuchPersons}</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-b border-border last:border-0">
                <td className="py-1.5 pr-4 text-foreground-muted">
                  {e.occurredAt.toISOString().slice(0, 10)}
                </td>
                <td className="py-1.5 pr-4 text-foreground">{e.title}</td>
                <td className="py-1.5 pr-4 text-foreground-muted">
                  {e.involvedPersons.length === 0
                    ? dict.none
                    : e.involvedPersons
                        .map(
                          (ip) =>
                            `${ip.person.lastName}, ${ip.person.firstName}`,
                        )
                        .join("; ")}
                </td>
                <td className="py-1.5">
                  <Link
                    href={`/app/s/${siteId}/incidents/${e.id}`}
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
