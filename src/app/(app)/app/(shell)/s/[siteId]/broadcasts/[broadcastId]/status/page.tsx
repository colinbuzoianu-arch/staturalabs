import { revalidatePath } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { userCan } from "@/lib/auth/company-role-bundle";
import { requireSiteAccess } from "@/lib/auth/require-access";
import { sendBroadcastReminders } from "@/lib/broadcasts/reminders";
import { getBroadcastStatus } from "@/lib/broadcasts/status";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";

// Who has confirmed and who has not. ONE page for three audiences, because the
// resolver (getBroadcastStatus) applies the P17 §2 visibility rules itself:
//   * an admin / site admin / EHS sees every addressed person;
//   * a leader sees only the people in their own org units — their "Team-Status";
//   * the works council sees the aggregate only, with the §3.4 minimum group
//     size suppressing any rate small enough to single someone out.
export default async function BroadcastStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string; broadcastId: string }>;
  searchParams: Promise<{ reminded?: string }>;
}) {
  const { siteId, broadcastId } = await params;
  const { reminded } = await searchParams;
  const { user, site } = await requireSiteAccess(siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).broadcasts;

  const broadcast = await prisma.broadcast.findUnique({
    where: { id: broadcastId },
    select: {
      id: true,
      companyId: true,
      siteId: true,
      title: true,
      status: true,
      priority: true,
      requiresConfirmation: true,
      confirmationDueAt: true,
    },
  });
  if (!broadcast || broadcast.companyId !== site.companyId) notFound();
  if (broadcast.siteId && broadcast.siteId !== siteId) notFound();
  if (broadcast.status === "DRAFT") notFound(); // nothing to show yet

  const canSend = await userCan(user, "broadcasts.write");
  const status = await getBroadcastStatus({ broadcastId, viewer: user });

  async function remindAction() {
    "use server";
    const { user: actor } = await requireSiteAccess(siteId);
    if (!(await userCan(actor, "broadcasts.write"))) notFound();
    // Scoped the same way the page is: a leader reminds only their own
    // people, because that is the only list they can see.
    const scoped = await getBroadcastStatus({ broadcastId, viewer: actor });
    const outstanding = scoped.persons
      .filter((p) => p.confirmedAt === null)
      .map((p) => p.recipientId);
    const result = await sendBroadcastReminders({
      broadcastId,
      actorUserId: actor.id,
      recipientIds: outstanding.length > 0 ? outstanding : undefined,
      kind: "manual",
    });
    revalidatePath(
      `/app/s/${siteId}/broadcasts/${broadcastId}/status?reminded=${result.created}`,
    );
    const { redirect } = await import("next/navigation");
    redirect(
      `/app/s/${siteId}/broadcasts/${broadcastId}/status?reminded=${result.created}`,
    );
  }

  const fmt = (d: Date | null) =>
    d ? d.toLocaleDateString(locale) : dict.none;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
      <div>
        <Link
          href={`/app/s/${siteId}/broadcasts/${broadcastId}`}
          className="text-sm text-accent hover:underline"
        >
          ← {broadcast.title}
        </Link>
        <h1 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-bold text-foreground">
          {dict.statusHeading}
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">{dict.statusIntro}</p>
      </div>

      {reminded !== undefined && (
        <p className="rounded-lg border border-border bg-surface p-3 text-sm text-foreground">
          {dict.remindedBanner.replace("{count}", reminded ?? "0")}
        </p>
      )}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(
          [
            ["colRecipients", status.totals.recipients],
            ["statTotalDelivered", status.totals.delivered],
            ["statTotalRead", status.totals.read],
            ["colConfirmed", status.totals.confirmed],
            ["statTotalOverdue", status.totals.overdue],
          ] as [keyof typeof dict, number][]
        ).map(([key, value]) => (
          <div
            key={String(key)}
            className="rounded-lg border border-border bg-surface p-3"
          >
            <p className="text-xs text-foreground-muted">{String(dict[key])}</p>
            <p className="font-heading text-xl font-bold text-foreground">
              {value}
            </p>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap gap-3">
        {canSend && broadcast.requiresConfirmation && (
          <form action={remindAction}>
            <button
              type="submit"
              className="rounded-[var(--radius-md)] border border-border px-4 py-2 text-sm font-medium text-foreground"
            >
              {dict.remindButton}
            </button>
          </form>
        )}
        <a
          href={`/api/broadcasts/${broadcastId}/status.csv`}
          className="rounded-[var(--radius-md)] border border-border px-4 py-2 text-sm font-medium text-foreground"
        >
          {dict.exportCsv}
        </a>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="font-heading text-sm font-bold">{dict.breakdownSite}</h2>
        <BreakdownTable rows={status.bySite} dict={dict} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-heading text-sm font-bold">
          {dict.breakdownOrgUnit}
        </h2>
        <BreakdownTable rows={status.byOrgUnit} dict={dict} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-heading text-sm font-bold">
          {dict.detailRecipients}
        </h2>
        {status.personsSuppressed ? (
          <p className="text-sm text-foreground-muted">
            {dict.personsSuppressedNote}
          </p>
        ) : status.persons.length === 0 ? (
          <p className="text-sm text-foreground-muted">
            {dict.detailNoRecipients}
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-foreground-muted">
                <th className="py-1 pr-4">{dict.colName}</th>
                <th className="py-1 pr-4">{dict.colOrgUnit}</th>
                <th className="py-1 pr-4">{dict.colRead}</th>
                <th className="py-1 pr-4">{dict.colConfirmed}</th>
              </tr>
            </thead>
            <tbody>
              {status.persons.map((p) => (
                <tr
                  key={p.recipientId}
                  className="border-b border-border last:border-0"
                >
                  <td className="py-1.5 pr-4 text-foreground">{p.name}</td>
                  <td className="py-1.5 pr-4 text-foreground-muted">
                    {p.orgUnitName ?? dict.none}
                  </td>
                  <td className="py-1.5 pr-4 text-foreground-muted">
                    {fmt(p.readAt)}
                  </td>
                  <td className="py-1.5 pr-4">
                    {p.confirmedAt ? (
                      <Badge tone="low">{fmt(p.confirmedAt)}</Badge>
                    ) : (
                      <Badge tone="elevated">{dict.notConfirmed}</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function BreakdownTable({
  rows,
  dict,
}: {
  rows: {
    key: string;
    label: string;
    recipients: number;
    confirmed: number;
    confirmationRate: number | null;
  }[];
  dict: {
    colRecipients: string;
    colConfirmed: string;
    colRate: string;
    suppressed: string;
    none: string;
  };
}) {
  if (rows.length === 0) return null;
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-border text-foreground-muted">
          <th className="py-1 pr-4" />
          <th className="py-1 pr-4">{dict.colRecipients}</th>
          <th className="py-1 pr-4">{dict.colConfirmed}</th>
          <th className="py-1 pr-4">{dict.colRate}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} className="border-b border-border last:border-0">
            <td className="py-1.5 pr-4 text-foreground">{r.label}</td>
            <td className="py-1.5 pr-4 text-foreground-muted">
              {r.recipients}
            </td>
            <td className="py-1.5 pr-4 text-foreground-muted">{r.confirmed}</td>
            <td className="py-1.5 pr-4 text-foreground-muted">
              {r.confirmationRate === null
                ? dict.suppressed
                : `${r.confirmationRate} %`}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
