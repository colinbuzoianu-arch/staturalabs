import { computeKpis } from "@/lib/analytics/kpi";
import { canAccessCompany } from "@/lib/auth/rbac";
import { requireSiteAccess } from "@/lib/auth/require-access";
import { prisma } from "@/lib/prisma";

// P12 §7.10: KPI CSV export for a site (or whole company) and year. Same
// requireSiteAccess gate the cockpit uses; company scope only when the user can
// access the whole company. Person-derived suppressed cells export as the same
// "n<5" sentinel they show on screen — never the underlying number.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const { siteId } = await params;
  const { user, site } = await requireSiteAccess(siteId);
  const url = new URL(request.url);
  const year = Number.parseInt(
    url.searchParams.get("year") ?? String(new Date().getUTCFullYear()),
    10,
  );
  const scope =
    url.searchParams.get("scope") === "company" &&
    canAccessCompany(user, site.companyId)
      ? "company"
      : "site";

  const siteIds =
    scope === "company"
      ? (
          await prisma.site.findMany({
            where: { companyId: site.companyId },
            select: { id: true },
          })
        ).map((s) => s.id)
      : [siteId];

  const [definitions, results] = await Promise.all([
    prisma.kpiDefinition.findMany({
      where: { catalog: { isActive: true } },
      orderBy: { order: "asc" },
    }),
    computeKpis({ siteIds, companyId: site.companyId, year }),
  ]);
  const byKey = new Map(results.map((r) => [r.key, r]));

  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows = [["key", "label", "value", "unit", "domain"].join(",")];
  for (const d of definitions) {
    const r = byKey.get(d.key);
    const value = !r
      ? ""
      : r.suppressed
        ? "n<5"
        : r.value === null
          ? ""
          : String(Math.round(r.value * 100) / 100);
    rows.push(
      [esc(d.key), esc(d.label), esc(value), esc(d.unit), esc(d.domain)].join(
        ",",
      ),
    );
  }
  const csv = `﻿${rows.join("\r\n")}\r\n`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="statura-kpis-${scope}-${year}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
