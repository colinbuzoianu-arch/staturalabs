import Link from "next/link";
import { ACTION_STATUS_TONE, Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";

// Maßnahmen › Kalender (SLD_RESTRUCTURE_PLAN_platform-modules.md §7.1): the
// same site actions as the register, bucketed by due date so what's overdue /
// due this month surfaces. Read-only; no new data path.
export default async function ActionsCalendarPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  await requireSiteAdministrationAccess(siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).actionsViews;
  const statusLabels = getAdministrationDictionary(locale).actionStatusLabels;

  const actions = await prisma.action.findMany({
    where: { siteId },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
  });

  const now = new Date();
  const endOfMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59,
  );
  const terminal = (s: string) => s === "VERIFIED" || s === "CANCELLED";

  const overdue = actions.filter(
    (a) => a.dueDate && a.dueDate < now && !terminal(a.status),
  );
  const thisMonth = actions.filter(
    (a) => a.dueDate && a.dueDate >= now && a.dueDate <= endOfMonth,
  );
  const later = actions.filter((a) => a.dueDate && a.dueDate > endOfMonth);
  const noDue = actions.filter((a) => !a.dueDate);

  const buckets: Array<{ key: string; label: string; rows: typeof actions }> = [
    { key: "overdue", label: dict.overdueBucket, rows: overdue },
    { key: "thisMonth", label: dict.thisMonthBucket, rows: thisMonth },
    { key: "later", label: dict.laterBucket, rows: later },
    { key: "noDue", label: dict.noDueDateBucket, rows: noDue },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-foreground-subtle">
          {dict.calendarEyebrow}
        </p>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-foreground">
          {dict.calendarHeading}
        </h1>
      </div>

      <ActionsTabs siteId={siteId} active="calendar" dict={dict} />

      {actions.length === 0 ? (
        <EmptyState title={dict.calendarEmpty} />
      ) : (
        buckets
          .filter((b) => b.rows.length > 0)
          .map((bucket) => (
            <Card key={bucket.key}>
              <CardHeader title={`${bucket.label} (${bucket.rows.length})`} />
              <CardBody>
                <ul className="divide-y divide-border">
                  {bucket.rows.map((a) => (
                    <li key={a.id}>
                      <Link
                        href={`/app/s/${siteId}/actions/${a.id}`}
                        className="flex items-center justify-between gap-3 px-1 py-2.5 text-sm hover:text-accent"
                      >
                        <span className="flex items-center gap-2">
                          <Badge
                            tone={ACTION_STATUS_TONE[a.status] ?? "neutral"}
                          >
                            {statusLabels[a.status]}
                          </Badge>
                          <span className="font-medium text-foreground">
                            {a.title}
                          </span>
                        </span>
                        <span className="text-foreground-subtle">
                          {a.dueDate
                            ? a.dueDate.toISOString().slice(0, 10)
                            : ""}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ))
      )}
    </div>
  );
}

// Shared tab row across the three Maßnahmen views.
export function ActionsTabs({
  siteId,
  active,
  dict,
}: {
  siteId: string;
  active: "list" | "calendar" | "effectiveness";
  dict: {
    listTab: string;
    calendarTab: string;
    effectivenessTab: string;
  };
}) {
  const tabs = [
    { key: "list", label: dict.listTab, href: `/app/s/${siteId}/actions` },
    {
      key: "calendar",
      label: dict.calendarTab,
      href: `/app/s/${siteId}/actions/calendar`,
    },
    {
      key: "effectiveness",
      label: dict.effectivenessTab,
      href: `/app/s/${siteId}/actions/effectiveness`,
    },
  ] as const;
  return (
    <nav className="flex gap-2 border-b border-border pb-3 text-sm">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === active ? "page" : undefined}
          className={
            t.key === active
              ? "rounded-[var(--radius-md)] bg-surface-raised px-3 py-1 font-medium text-foreground"
              : "rounded-[var(--radius-md)] px-3 py-1 text-foreground-muted hover:bg-surface-raised"
          }
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
