import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { userCan } from "@/lib/auth/company-role-bundle";
import { requireSiteAccess } from "@/lib/auth/require-access";
import { getBroadcastStatus } from "@/lib/broadcasts/status";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";

// Team-Status: the leader's view of the safety information reaching their own
// units, and how many of their people still have to confirm. The numbers come
// from the same scoped resolver as the status page, so "my team" here and "the
// people I may see" there are by construction the same set.
//
// A site-wide role sees the same page for their whole scope (the resolver
// returns every addressed person), which makes this a useful EHS overview too
// rather than a leader-only special case.
export default async function BroadcastTeamPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const { user, site } = await requireSiteAccess(siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).broadcasts;
  const canSend = await userCan(user, "broadcasts.write");

  // Published messages in scope. For a leader we cannot pre-filter in SQL (the
  // relevant link is through the recipient rows, which carry the person's unit),
  // so we take the published set and let the scoped resolver decide — the same
  // authority as the status page, no second rule.
  const broadcasts = await prisma.broadcast.findMany({
    where: {
      companyId: site.companyId,
      status: "PUBLISHED",
      OR: [{ siteId: null }, { siteId }],
    },
    orderBy: { publishedAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      priority: true,
      publishedAt: true,
      requiresConfirmation: true,
      confirmationDueAt: true,
    },
  });

  const rows: {
    id: string;
    title: string;
    priority: "INFO" | "SAFETY_ALERT";
    publishedAt: Date | null;
    confirmationDueAt: Date | null;
    mine: number;
    confirmed: number;
  }[] = [];
  for (const broadcast of broadcasts) {
    const status = await getBroadcastStatus({
      broadcastId: broadcast.id,
      viewer: user,
    });
    // A leader with nobody addressed in their units simply does not see the
    // message here (they may still have received it themselves — that is the
    // inbox, not the team view).
    if (status.persons.length === 0) continue;
    rows.push({
      id: broadcast.id,
      title: broadcast.title,
      priority: broadcast.priority,
      publishedAt: broadcast.publishedAt,
      confirmationDueAt: broadcast.confirmationDueAt,
      mine: status.persons.length,
      confirmed: status.persons.filter((p) => p.confirmedAt !== null).length,
    });
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
      <div>
        <p className="font-technical text-xs uppercase tracking-[0.2em] text-foreground-subtle">
          {dict.eyebrow}
        </p>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-foreground">
          {dict.teamHeading}
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">{dict.teamIntro}</p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-foreground-muted">{dict.teamEmpty}</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-foreground-muted">
              <th className="py-1 pr-4">{dict.colTitle}</th>
              <th className="py-1 pr-4">{dict.colPriority}</th>
              <th className="py-1 pr-4">{dict.colPublished}</th>
              <th className="py-1 pr-4">{dict.colDue}</th>
              <th className="py-1 pr-4">{dict.colRecipients}</th>
              <th className="py-1 pr-4">{dict.colConfirmed}</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="py-1.5 pr-4 font-medium text-foreground">
                  {r.title}
                </td>
                <td className="py-1.5 pr-4">
                  <Badge tone={r.priority === "SAFETY_ALERT" ? "high" : "info"}>
                    {dict.priorityLabels[r.priority]}
                  </Badge>
                </td>
                <td className="py-1.5 pr-4 text-foreground-muted">
                  {r.publishedAt?.toLocaleDateString(locale) ?? dict.none}
                </td>
                <td className="py-1.5 pr-4 text-foreground-muted">
                  {r.confirmationDueAt?.toLocaleDateString(locale) ?? dict.none}
                </td>
                <td className="py-1.5 pr-4 text-foreground-muted">{r.mine}</td>
                <td className="py-1.5 pr-4 text-foreground-muted">
                  {r.confirmed}
                  {r.confirmed < r.mine ? ` / ${r.mine}` : ""}
                </td>
                <td className="py-1.5">
                  {canSend && (
                    <Link
                      href={`/app/s/${siteId}/broadcasts/${r.id}/status`}
                      className="text-accent hover:underline"
                    >
                      {dict.openStatus}
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
