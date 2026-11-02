import Link from "next/link";
import { ACTION_STATUS_TONE, Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { getAccessibleSites } from "@/lib/auth/accessible-sites";
import { requireAuthenticatedUser } from "@/lib/auth/require-access";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";

// Meine Aufgaben: the signed-in user's personal inbox across every site they
// can access — their open/overdue actions (where they are the responsible
// PlatformUser) and the assessments awaiting approval. Read-only aggregation
// over existing data; no new tables. (Notifications arrive with P5.)
export default async function MyTasksPage() {
  const user = await requireAuthenticatedUser();
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).myTasks;
  const statusLabels = getAdministrationDictionary(locale).actionStatusLabels;

  const sites = await getAccessibleSites(user);
  const siteIds = sites.map((s) => s.id);
  const siteName = new Map(sites.map((s) => [s.id, s.name]));

  const [myActions, awaitingApproval] = await Promise.all([
    prisma.action.findMany({
      where: {
        siteId: { in: siteIds },
        responsibleUserId: user.id,
        status: { in: ["OPEN", "IN_PROGRESS"] },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    }),
    prisma.riskAssessment.findMany({
      where: { siteId: { in: siteIds }, status: "IN_REVIEW" },
      include: { workstation: true, process: true },
      orderBy: { assessedAt: "desc" },
    }),
  ]);

  const now = new Date();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-foreground-subtle">
          {dict.eyebrow}
        </p>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-foreground">
          {dict.heading}
        </h1>
      </div>

      <Card>
        <CardHeader title={`${dict.myActionsHeading} (${myActions.length})`} />
        <CardBody>
          {myActions.length === 0 ? (
            <EmptyState title={dict.myActionsEmpty} />
          ) : (
            <ul className="divide-y divide-border">
              {myActions.map((a) => {
                const overdue = a.dueDate !== null && a.dueDate < now;
                return (
                  <li key={a.id}>
                    <Link
                      href={`/app/s/${a.siteId}/actions/${a.id}`}
                      className="flex items-center justify-between gap-3 px-1 py-2.5 text-sm hover:text-accent"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Badge tone={ACTION_STATUS_TONE[a.status] ?? "neutral"}>
                          {statusLabels[a.status]}
                        </Badge>
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-foreground">
                            {a.title}
                          </span>
                          <span className="text-xs text-foreground-subtle">
                            {siteName.get(a.siteId)}
                          </span>
                        </span>
                      </span>
                      <span
                        className={
                          overdue
                            ? "shrink-0 font-medium text-status-high"
                            : "shrink-0 text-foreground-subtle"
                        }
                      >
                        {a.dueDate
                          ? `${overdue ? `${dict.overdueLabel} ` : `${dict.dueLabel} `}${a.dueDate.toISOString().slice(0, 10)}`
                          : ""}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={`${dict.awaitingApprovalHeading} (${awaitingApproval.length})`}
        />
        <CardBody>
          {awaitingApproval.length === 0 ? (
            <EmptyState title={dict.awaitingApprovalEmpty} />
          ) : (
            <ul className="divide-y divide-border">
              {awaitingApproval.map((ra) => (
                <li key={ra.id}>
                  <Link
                    href={`/app/s/${ra.siteId}/risk/assessments/${ra.id}`}
                    className="flex items-center justify-between gap-3 px-1 py-2.5 text-sm hover:text-accent"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-foreground">
                        {ra.workstation?.name ??
                          ra.process?.name ??
                          siteName.get(ra.siteId)}
                      </span>
                      <span className="text-xs text-foreground-subtle">
                        {siteName.get(ra.siteId)}
                      </span>
                    </span>
                    <span className="shrink-0 text-foreground-subtle">
                      {ra.assessedAt.toISOString().slice(0, 10)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
