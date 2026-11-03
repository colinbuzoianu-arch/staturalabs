import { revalidatePath } from "next/cache";
import Link from "next/link";
import { ACTION_STATUS_TONE, Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { getAccessibleSites } from "@/lib/auth/accessible-sites";
import { requireAuthenticatedUser } from "@/lib/auth/require-access";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import { generateDueNotifications } from "@/lib/notifications/generate";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications/service";
import { prisma } from "@/lib/prisma";

// Meine Aufgaben: the signed-in user's personal inbox across every site they
// can access — their notifications (P5), their open/overdue actions (where
// they are the responsible PlatformUser) and the assessments awaiting
// approval. The actions/approvals lists are read-only live aggregation; the
// notifications stream is the persisted P5 service (generate + mark read).
export default async function MyTasksPage() {
  const user = await requireAuthenticatedUser();
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).myTasks;
  const statusLabels = getAdministrationDictionary(locale).actionStatusLabels;

  const sites = await getAccessibleSites(user);
  const siteIds = sites.map((s) => s.id);
  const siteName = new Map(sites.map((s) => [s.id, s.name]));

  // P5: generate the signed-in user's due notifications on demand (a manual
  // "check" button; a scheduled EU job is the production trigger — deferred).
  // Scoped to recipientUserId so it only ever writes this user's own inbox.
  async function checkNotificationsAction() {
    "use server";
    const u = await requireAuthenticatedUser();
    const accessible = await getAccessibleSites(u);
    await generateDueNotifications({
      siteIds: accessible.map((s) => s.id),
      recipientUserId: u.id,
    });
    revalidatePath("/app/me");
  }

  async function markReadAction(formData: FormData) {
    "use server";
    const u = await requireAuthenticatedUser();
    const id = formData.get("id");
    if (typeof id === "string" && id.length > 0) {
      await markNotificationRead(id, u.id);
    }
    revalidatePath("/app/me");
  }

  async function markAllReadAction() {
    "use server";
    const u = await requireAuthenticatedUser();
    await markAllNotificationsRead(u.id);
    revalidatePath("/app/me");
  }

  const notifications = await listNotifications(user.id);
  const unreadCount = notifications.filter((n) => n.readAt === null).length;

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
        <CardHeader
          title={`${dict.notificationsHeading}${
            unreadCount > 0
              ? ` (${unreadCount} ${dict.notificationsUnreadSuffix})`
              : ""
          }`}
        />
        <CardBody>
          <div className="mb-3 flex flex-wrap gap-2">
            <form action={checkNotificationsAction}>
              <button
                type="submit"
                className="rounded-[var(--radius-md)] bg-accent px-3 py-1.5 text-sm font-medium text-white"
              >
                {dict.notificationsCheckButton}
              </button>
            </form>
            {unreadCount > 0 && (
              <form action={markAllReadAction}>
                <button
                  type="submit"
                  className="rounded-[var(--radius-md)] border border-border px-3 py-1.5 text-sm text-foreground-muted hover:bg-surface-raised"
                >
                  {dict.notificationsMarkAllRead}
                </button>
              </form>
            )}
          </div>
          {notifications.length === 0 ? (
            <EmptyState title={dict.notificationsEmpty} />
          ) : (
            <ul className="divide-y divide-border">
              {notifications.map((n) => {
                const unread = n.readAt === null;
                return (
                  <li
                    key={n.id}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm"
                  >
                    <Link
                      href={n.href}
                      className="flex min-w-0 items-center gap-2 hover:text-accent"
                    >
                      <Badge tone={unread ? "info" : "neutral"}>
                        {dict.notificationEventLabels[n.eventType]}
                      </Badge>
                      <span className="min-w-0">
                        <span
                          className={`block truncate ${
                            unread
                              ? "font-semibold text-foreground"
                              : "font-medium text-foreground-muted"
                          }`}
                        >
                          {n.title}
                        </span>
                        <span className="text-xs text-foreground-subtle">
                          {n.body}
                          {n.dueAt
                            ? ` · ${dict.dueLabel} ${n.dueAt.toISOString().slice(0, 10)}`
                            : ""}
                        </span>
                      </span>
                    </Link>
                    {unread && (
                      <form action={markReadAction} className="shrink-0">
                        <input type="hidden" name="id" value={n.id} />
                        <button
                          type="submit"
                          className="text-xs text-foreground-subtle hover:text-accent hover:underline"
                        >
                          {dict.notificationsMarkRead}
                        </button>
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>

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
