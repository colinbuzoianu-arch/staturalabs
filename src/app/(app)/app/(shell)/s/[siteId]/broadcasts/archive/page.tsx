import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { requireSiteAccess } from "@/lib/auth/require-access";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";

// The archive. An archived message stays readable WITH its confirmation
// totals, because that list is the proof the information was passed on — the
// reason the module exists. The works-council aggregate view (minimum group
// size) lands in slice 4.
export default async function BroadcastsArchivePage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const { site } = await requireSiteAccess(siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).broadcasts;

  const broadcasts = await prisma.broadcast.findMany({
    where: {
      companyId: site.companyId,
      status: "ARCHIVED",
      OR: [{ siteId: null }, { siteId }],
    },
    orderBy: { archivedAt: "desc" },
    select: {
      id: true,
      title: true,
      priority: true,
      publishedAt: true,
      archivedAt: true,
      _count: { select: { recipients: true } },
    },
  });

  const confirmed = await prisma.broadcastRecipient.groupBy({
    by: ["broadcastId"],
    where: {
      broadcastId: { in: broadcasts.map((b) => b.id) },
      confirmedAt: { not: null },
    },
    _count: { _all: true },
  });
  const confirmedByBroadcast = new Map(
    confirmed.map((c) => [c.broadcastId, c._count._all]),
  );

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
      <div>
        <p className="font-technical text-xs uppercase tracking-[0.2em] text-foreground-subtle">
          {dict.eyebrow}
        </p>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-foreground">
          {dict.archiveHeading}
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">
          {dict.archiveIntro}
        </p>
      </div>

      {broadcasts.length === 0 ? (
        <p className="text-sm text-foreground-muted">{dict.archiveEmpty}</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-foreground-muted">
              <th className="py-1 pr-4">{dict.colTitle}</th>
              <th className="py-1 pr-4">{dict.colPriority}</th>
              <th className="py-1 pr-4">{dict.colPublished}</th>
              <th className="py-1 pr-4">{dict.colRecipients}</th>
              <th className="py-1 pr-4">{dict.colConfirmed}</th>
            </tr>
          </thead>
          <tbody>
            {broadcasts.map((b) => (
              <tr key={b.id} className="border-b border-border last:border-0">
                <td className="py-1.5 pr-4 font-medium">
                  <Link
                    href={`/app/s/${siteId}/broadcasts/${b.id}`}
                    className="text-foreground hover:text-accent hover:underline"
                  >
                    {b.title}
                  </Link>
                </td>
                <td className="py-1.5 pr-4">
                  <Badge tone={b.priority === "SAFETY_ALERT" ? "high" : "info"}>
                    {dict.priorityLabels[b.priority]}
                  </Badge>
                </td>
                <td className="py-1.5 pr-4 text-foreground-muted">
                  {b.publishedAt?.toLocaleDateString(locale) ?? dict.none}
                </td>
                <td className="py-1.5 pr-4 text-foreground-muted">
                  {b._count.recipients}
                </td>
                <td className="py-1.5 pr-4 text-foreground-muted">
                  {confirmedByBroadcast.get(b.id) ?? 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
