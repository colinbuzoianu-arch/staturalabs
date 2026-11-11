import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { hasPermission } from "@/lib/auth/permissions";
import { requireSiteAccess } from "@/lib/auth/require-access";
import {
  bucketCalendarEntries,
  type CalendarBucketKey,
  type CalendarEntry,
  type CalendarModule,
  collectCalendarEntries,
} from "@/lib/calendar/collect";
import { getDashboardDictionary } from "@/lib/i18n/dictionaries/dashboard";
import { getLocale } from "@/lib/i18n/get-locale";

// P14 G2: the Aktivitätenkalender — a read-only, cross-module view of every
// due-dated item for this site, in an agenda (bucketed) or a month-grid view.
// Each source is permission-gated; each entry deep-links to its record. Server-
// rendered throughout: the view/month/filter state rides on the query string,
// so no client JS and no new data path (plan §G2).

const ALL_MODULES: readonly CalendarModule[] = [
  "actions",
  "inspections",
  "risk",
  "legal",
  "incidents",
];

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function CalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<{
    view?: string;
    module?: string;
    mine?: string;
    month?: string;
  }>;
}) {
  const { siteId } = await params;
  const sp = await searchParams;
  const { user } = await requireSiteAccess(siteId);
  if (!hasPermission(user, "calendar.read")) notFound();

  const locale = await getLocale();
  const dict = getDashboardDictionary(locale).calendar;

  // Which module sources this user may read.
  const allowed = new Set<CalendarModule>(
    ALL_MODULES.filter((m) => hasPermission(user, `${m}.read`)),
  );

  const now = new Date();
  let entries = await collectCalendarEntries({
    siteIds: [siteId],
    modules: allowed,
    now,
  });

  // Filters.
  const moduleFilter =
    sp.module && (ALL_MODULES as readonly string[]).includes(sp.module)
      ? (sp.module as CalendarModule)
      : null;
  const onlyMine = sp.mine === "1";
  if (moduleFilter) entries = entries.filter((e) => e.module === moduleFilter);
  if (onlyMine)
    entries = entries.filter((e) => e.responsibleUserId === user.id);

  const view = sp.view === "month" ? "month" : "agenda";

  const hrefWith = (overrides: Record<string, string | null>): string => {
    const q = new URLSearchParams();
    const base: Record<string, string | undefined> = {
      view: sp.view,
      module: sp.module,
      mine: sp.mine,
      month: sp.month,
      ...Object.fromEntries(
        Object.entries(overrides).map(([k, v]) => [k, v ?? undefined]),
      ),
    };
    for (const [k, v] of Object.entries(base)) if (v) q.set(k, v);
    const s = q.toString();
    return `/app/s/${siteId}/calendar${s ? `?${s}` : ""}`;
  };

  const chip = (label: string, href: string, active: boolean) => (
    <Link
      href={href}
      className={
        active
          ? "rounded-[var(--radius-md)] bg-accent px-3 py-1 text-xs font-medium text-background"
          : "rounded-[var(--radius-md)] border border-border px-3 py-1 text-xs text-foreground-muted hover:border-accent"
      }
    >
      {label}
    </Link>
  );

  const kindLabel = (e: CalendarEntry) => dict.kinds[e.kind];
  const moduleLabel = (m: CalendarModule) => dict.moduleLabels[m];

  const entryRow = (e: CalendarEntry) => (
    <li key={e.id}>
      <Link
        href={e.href}
        className="flex items-center justify-between gap-3 px-1 py-2.5 text-sm hover:text-accent"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Badge tone={e.overdue ? "high" : "neutral"}>
            {moduleLabel(e.module)}
          </Badge>
          <span className="min-w-0">
            <span className="block truncate font-medium text-foreground">
              {e.title || kindLabel(e)}
            </span>
            <span className="text-xs text-foreground-subtle">
              {kindLabel(e)}
            </span>
          </span>
        </span>
        <span
          className={
            e.overdue
              ? "shrink-0 font-medium text-status-high"
              : "shrink-0 text-foreground-subtle"
          }
        >
          {isoDay(e.dueDate)}
        </span>
      </Link>
    </li>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-foreground-subtle">
          {dict.eyebrow}
        </p>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-foreground">
          {dict.heading}
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">{dict.intro}</p>
      </div>

      {/* Controls: view · module filter · only-mine */}
      <div className="flex flex-wrap items-center gap-2">
        {chip(dict.agendaView, hrefWith({ view: null }), view === "agenda")}
        {chip(dict.monthView, hrefWith({ view: "month" }), view === "month")}
        <span className="mx-1 text-foreground-subtle">·</span>
        {chip(
          dict.allModules,
          hrefWith({ module: null }),
          moduleFilter === null,
        )}
        {ALL_MODULES.filter((m) => allowed.has(m)).map((m) =>
          chip(moduleLabel(m), hrefWith({ module: m }), moduleFilter === m),
        )}
        <span className="mx-1 text-foreground-subtle">·</span>
        {chip(
          onlyMine ? dict.onlyMine : dict.everyone,
          hrefWith({ mine: onlyMine ? null : "1" }),
          onlyMine,
        )}
      </div>

      {entries.length === 0 ? (
        <EmptyState title={dict.empty} />
      ) : view === "month" ? (
        <MonthView
          entries={entries}
          monthParam={sp.month}
          now={now}
          dict={dict}
          hrefWith={hrefWith}
        />
      ) : (
        <AgendaView
          entries={entries}
          now={now}
          dict={dict}
          entryRow={entryRow}
        />
      )}
    </div>
  );
}

function AgendaView({
  entries,
  now,
  dict,
  entryRow,
}: {
  entries: CalendarEntry[];
  now: Date;
  dict: ReturnType<typeof getDashboardDictionary>["calendar"];
  entryRow: (e: CalendarEntry) => React.ReactNode;
}) {
  const buckets = bucketCalendarEntries(entries, now);
  const order: Array<{ key: CalendarBucketKey; label: string }> = [
    { key: "overdue", label: dict.overdueBucket },
    { key: "thisWeek", label: dict.thisWeekBucket },
    { key: "thisMonth", label: dict.thisMonthBucket },
    { key: "later", label: dict.laterBucket },
  ];
  return (
    <>
      {order
        .filter((b) => buckets[b.key].length > 0)
        .map((b) => (
          <Card key={b.key}>
            <CardHeader title={`${b.label} (${buckets[b.key].length})`} />
            <CardBody>
              <ul className="divide-y divide-border">
                {buckets[b.key].map((e) => entryRow(e))}
              </ul>
            </CardBody>
          </Card>
        ))}
    </>
  );
}

function MonthView({
  entries,
  monthParam,
  now,
  dict,
  hrefWith,
}: {
  entries: CalendarEntry[];
  monthParam: string | undefined;
  now: Date;
  dict: ReturnType<typeof getDashboardDictionary>["calendar"];
  hrefWith: (o: Record<string, string | null>) => string;
}) {
  // Resolve the displayed month (YYYY-MM), default current.
  const m = /^\d{4}-\d{2}$/.test(monthParam ?? "")
    ? (monthParam as string)
    : `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const [yr, mo] = m.split("-").map((n) => Number.parseInt(n, 10));
  const first = new Date(Date.UTC(yr, mo - 1, 1));
  const daysInMonth = new Date(Date.UTC(yr, mo, 0)).getUTCDate();
  // Monday-first offset (JS getUTCDay: 0=Sun).
  const leading = (first.getUTCDay() + 6) % 7;

  const byDay = new Map<number, CalendarEntry[]>();
  for (const e of entries) {
    if (
      e.dueDate.getUTCFullYear() === yr &&
      e.dueDate.getUTCMonth() === mo - 1
    ) {
      const d = e.dueDate.getUTCDate();
      const list = byDay.get(d) ?? [];
      list.push(e);
      byDay.set(d, list);
    }
  }

  const cells: Array<number | null> = [];
  for (let i = 0; i < leading; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = new Date(Date.UTC(yr, mo - 2, 1));
  const nextMonth = new Date(Date.UTC(yr, mo, 1));
  const fmtMonth = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  const monthTitle = first.toLocaleDateString("de-DE", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <Card>
      <CardHeader title={monthTitle} />
      <CardBody>
        <div className="mb-3 flex items-center justify-between text-xs">
          <Link
            href={hrefWith({ view: "month", month: fmtMonth(prevMonth) })}
            className="rounded border border-border px-2 py-0.5 hover:border-accent"
          >
            ‹ {dict.prevMonth}
          </Link>
          <Link
            href={hrefWith({ view: "month", month: fmtMonth(nextMonth) })}
            className="rounded border border-border px-2 py-0.5 hover:border-accent"
          >
            {dict.nextMonth} ›
          </Link>
        </div>
        <div className="grid grid-cols-7 gap-px rounded-[var(--radius-md)] border border-border bg-border text-xs">
          {dict.weekdays.map((w) => (
            <div
              key={w}
              className="bg-surface px-1 py-1 text-center font-medium text-foreground-subtle"
            >
              {w}
            </div>
          ))}
          {cells.map((d, i) => {
            const list = d ? (byDay.get(d) ?? []) : [];
            return (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length grid cells
                key={i}
                className="min-h-[72px] bg-background p-1 align-top"
              >
                {d ? (
                  <>
                    <div className="mb-0.5 text-right text-[11px] text-foreground-subtle">
                      {d}
                    </div>
                    <ul className="space-y-0.5">
                      {list.slice(0, 3).map((e) => (
                        <li key={e.id}>
                          <Link
                            href={e.href}
                            title={`${dict.moduleLabels[e.module]}: ${e.title || dict.kinds[e.kind]}`}
                            className={`block truncate rounded px-1 py-0.5 text-[11px] ${
                              e.overdue
                                ? "bg-status-high/15 text-status-high"
                                : "bg-surface-raised text-foreground-muted hover:text-foreground"
                            }`}
                          >
                            {e.title || dict.kinds[e.kind]}
                          </Link>
                        </li>
                      ))}
                      {list.length > 3 ? (
                        <li className="px-1 text-[10px] text-foreground-subtle">
                          +{list.length - 3}
                        </li>
                      ) : null}
                    </ul>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}
