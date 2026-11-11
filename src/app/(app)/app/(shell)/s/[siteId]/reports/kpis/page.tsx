import { revalidatePath } from "next/cache";
import Link from "next/link";
import type { KpiDomain } from "@/generated/prisma/enums";
import { computeKpis } from "@/lib/analytics/kpi";
import { setSiteWorkforcePeriod } from "@/lib/analytics/workforce-period";
import { canAccessCompany } from "@/lib/auth/rbac";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";

// P12 §7.10 KPI cockpit: site (or whole-company) key figures for a year, with
// the §3.4 min-group-size suppression shown honestly, headcount/hours input for
// the accident-rate denominators, and a CSV export.
export default async function KpiCockpitPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<{ year?: string; scope?: string }>;
}) {
  const { siteId } = await params;
  const sp = await searchParams;
  const { user, site } = await requireSiteAdministrationAccess(siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).kpi;
  const companyId = site.companyId;

  const thisYear = new Date().getUTCFullYear();
  const year = sp.year ? Number.parseInt(sp.year, 10) : thisYear;
  const companyScopeAllowed = canAccessCompany(user, companyId);
  const scope =
    sp.scope === "company" && companyScopeAllowed ? "company" : "site";

  const siteIds =
    scope === "company"
      ? (
          await prisma.site.findMany({
            where: { companyId },
            select: { id: true },
          })
        ).map((s) => s.id)
      : [siteId];

  const [definitions, results, figures] = await Promise.all([
    prisma.kpiDefinition.findMany({
      where: { catalog: { isActive: true } },
      orderBy: { order: "asc" },
    }),
    computeKpis({ siteIds, companyId, year }),
    prisma.siteWorkforcePeriod.findFirst({
      where: {
        siteId,
        orgUnitId: null,
        periodType: "YEAR",
        year,
        periodIndex: 0,
      },
    }),
  ]);
  const byKey = new Map(results.map((r) => [r.key, r]));

  const domainLabel: Record<KpiDomain, string> = {
    OSH: dict.domainOsh,
    ENVIRONMENT: dict.domainEnv,
    CROSS: dict.domainCross,
  };
  const fmtValue = (key: string): string => {
    const r = byKey.get(key);
    if (!r) return dict.notAvailable;
    if (r.suppressed) return dict.suppressed;
    if (r.value === null) return dict.notAvailable;
    return (Math.round(r.value * 100) / 100).toLocaleString(locale);
  };

  async function setFiguresAction(formData: FormData) {
    "use server";
    const { user: actor, site: s } =
      await requireSiteAdministrationAccess(siteId);
    const y = formData.get("year");
    const hc = formData.get("headcount");
    const hrs = formData.get("hoursWorked");
    const num = (v: FormDataEntryValue | null) =>
      typeof v === "string" && v.trim().length > 0
        ? Number.parseInt(v, 10)
        : null;
    await setSiteWorkforcePeriod({
      siteId,
      companyId: s.companyId,
      orgUnitId: null,
      periodType: "YEAR",
      year: typeof y === "string" ? Number.parseInt(y, 10) : thisYear,
      periodIndex: 0,
      headcount: num(hc),
      hoursWorked: num(hrs),
      actorUserId: actor.id,
    });
    revalidatePath(`/app/s/${siteId}/reports/kpis`);
  }

  const scopeHref = (sc: string) =>
    `/app/s/${siteId}/reports/kpis?year=${year}&scope=${sc}`;
  const yearHref = (y: number) =>
    `/app/s/${siteId}/reports/kpis?year=${y}&scope=${scope}`;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
      <div>
        <p className="font-technical text-xs uppercase tracking-[0.2em] text-foreground-subtle">
          {dict.eyebrow}
        </p>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-foreground">
          {dict.heading}
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">{dict.intro}</p>
      </div>

      {/* Year + scope + export controls */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Link
          href={yearHref(year - 1)}
          className="rounded border border-border px-2 py-0.5 hover:border-accent"
        >
          ‹ {year - 1}
        </Link>
        <span className="rounded bg-accent px-2 py-0.5 font-medium text-background">
          {dict.yearLabel} {year}
        </span>
        <Link
          href={yearHref(year + 1)}
          className="rounded border border-border px-2 py-0.5 hover:border-accent"
        >
          {year + 1} ›
        </Link>
        {companyScopeAllowed && (
          <>
            <span className="mx-2 text-foreground-subtle">·</span>
            <Link
              href={scopeHref("site")}
              className={
                scope === "site"
                  ? "rounded bg-accent px-2 py-0.5 text-background"
                  : "rounded border border-border px-2 py-0.5 hover:border-accent"
              }
            >
              {dict.scopeSite}
            </Link>
            <Link
              href={scopeHref("company")}
              className={
                scope === "company"
                  ? "rounded bg-accent px-2 py-0.5 text-background"
                  : "rounded border border-border px-2 py-0.5 hover:border-accent"
              }
            >
              {dict.scopeCompany}
            </Link>
          </>
        )}
        <span className="mx-2 text-foreground-subtle">·</span>
        <a
          href={`/api/sites/${siteId}/kpis?year=${year}&scope=${scope}`}
          className="rounded border border-border px-2 py-0.5 text-accent hover:border-accent"
        >
          {dict.exportCsv}
        </a>
      </div>

      {/* KPI table */}
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-foreground-muted">
            <th className="py-1 pr-4">{dict.colKpi}</th>
            <th className="py-1 pr-4 text-right">{dict.colValue}</th>
            <th className="py-1 pr-4">{dict.colUnit}</th>
            <th className="py-1 pr-4">{dict.colDomain}</th>
          </tr>
        </thead>
        <tbody>
          {definitions.map((d) => (
            <tr key={d.key} className="border-b border-border last:border-0">
              <td className="py-1.5 pr-4 text-foreground">
                {dict.kpiLabels[d.key as keyof typeof dict.kpiLabels] ??
                  d.label}
              </td>
              <td className="py-1.5 pr-4 text-right font-medium text-foreground">
                {fmtValue(d.key)}
              </td>
              <td className="py-1.5 pr-4 text-foreground-subtle">{d.unit}</td>
              <td className="py-1.5 pr-4 text-foreground-subtle">
                {domainLabel[d.domain]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Headcount & hours input (this site, this year) */}
      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="font-heading text-sm font-bold">
          {dict.figuresHeading}
        </h2>
        <p className="text-xs text-foreground-subtle">{dict.figuresIntro}</p>
        <form
          action={setFiguresAction}
          className="flex flex-wrap items-end gap-3 text-sm"
        >
          <input type="hidden" name="year" value={year} />
          <label className="flex flex-col gap-1">
            {dict.headcountLabel}
            <input
              type="number"
              min="0"
              name="headcount"
              defaultValue={figures?.headcount ?? ""}
              className="w-32 rounded border border-border bg-background px-2 py-1"
            />
          </label>
          <label className="flex flex-col gap-1">
            {dict.hoursLabel}
            <input
              type="number"
              min="0"
              name="hoursWorked"
              defaultValue={figures?.hoursWorked ?? ""}
              className="w-40 rounded border border-border bg-background px-2 py-1"
            />
          </label>
          <button
            type="submit"
            className="rounded-[var(--radius-md)] bg-accent px-4 py-2 font-medium text-background"
          >
            {dict.saveFigures}
          </button>
        </form>
      </section>
    </div>
  );
}
