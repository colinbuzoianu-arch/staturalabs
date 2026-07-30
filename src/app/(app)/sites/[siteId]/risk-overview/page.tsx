import Link from "next/link";
import type { HazardCategory } from "@/generated/prisma/enums";
import { requireSiteAccess } from "@/lib/auth/require-access";
import { getDashboardDictionary } from "@/lib/i18n/dictionaries/dashboard";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";
import { riskBandRank, worstRiskBand } from "@/lib/risk/band-severity";

// Site rollup (SLD_IMPLEMENTATION_PLAN_demo-loop.md M6, demo step 10):
// workstations ranked by highest band, findings by hazard category, open
// actions, overdue actions, actions awaiting verification. Read-only,
// same requireSiteAccess every other page in this tree already uses.
export default async function SiteRiskOverviewPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const { site } = await requireSiteAccess(siteId);
  const locale = await getLocale();
  const dict = getDashboardDictionary(locale).siteRiskOverviewPage;
  const hazardCategoryLabels =
    getDashboardDictionary(locale).hazardCategoryLabels;
  const actionStatusLabels = getDashboardDictionary(locale).actionStatusLabels;

  const [workstations, findings, actions] = await Promise.all([
    prisma.workstation.findMany({
      where: { siteId },
      orderBy: { name: "asc" },
      include: {
        riskAssessments: {
          where: { status: "APPROVED" },
          orderBy: { assessedAt: "desc" },
          take: 1,
          include: { findings: { select: { riskBand: true } } },
        },
      },
    }),
    prisma.riskFinding.findMany({
      where: { riskAssessment: { siteId } },
      select: { hazard: { select: { category: true } } },
    }),
    prisma.action.findMany({
      where: { siteId, status: { notIn: ["VERIFIED", "CANCELLED"] } },
      include: {
        riskFinding: {
          include: {
            riskAssessment: { include: { workstation: true, process: true } },
          },
        },
        assessmentSession: { include: { workstation: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const workstationBands = workstations
    .map((workstation) => {
      const latest = workstation.riskAssessments[0];
      const band = latest
        ? worstRiskBand(latest.findings.map((f) => f.riskBand))
        : null;
      return { workstation, band, assessedAt: latest?.assessedAt ?? null };
    })
    .sort((a, b) => {
      if (a.band === null && b.band === null) return 0;
      if (a.band === null) return 1;
      if (b.band === null) return -1;
      return riskBandRank(b.band) - riskBandRank(a.band);
    });

  const findingsByCategory = new Map<HazardCategory, number>();
  for (const finding of findings) {
    const category = finding.hazard.category;
    findingsByCategory.set(
      category,
      (findingsByCategory.get(category) ?? 0) + 1,
    );
  }
  const findingsByCategoryRows = [...findingsByCategory.entries()].sort(
    (a, b) => b[1] - a[1],
  );

  const now = new Date();

  const actionRows = actions.map((action) => ({
    id: action.id,
    title: action.title,
    status: action.status,
    dueDate: action.dueDate,
    subject:
      action.riskFinding?.riskAssessment.workstation?.name ??
      action.riskFinding?.riskAssessment.process?.name ??
      action.assessmentSession?.workstation.name ??
      "",
  }));
  const overdueActionRows = actionRows.filter(
    (a) => a.dueDate !== null && a.dueDate < now,
  );
  const awaitingVerificationRows = actionRows.filter(
    (a) => a.status === "IMPLEMENTED",
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-12">
      <p className="text-sm text-border">
        <Link href="/sites" className="hover:text-accent">
          {dict.breadcrumbSites}
        </Link>{" "}
        /{" "}
        <Link href={`/sites/${site.id}`} className="hover:text-accent">
          {site.name}
        </Link>{" "}
        / {dict.heading}
      </p>

      <div className="flex flex-col gap-1">
        <p className="font-technical text-xs uppercase tracking-[0.2em] text-border">
          {dict.eyebrow}
        </p>
        <h1 className="font-heading text-2xl font-bold">{dict.heading}</h1>
        <Link
          href={`/sites/${site.id}`}
          className="text-sm text-border hover:text-accent"
        >
          {dict.backToSite}
        </Link>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-bold">
          {dict.workstationsByBandHeading}
        </h2>
        {workstationBands.every((w) => w.band === null) ? (
          <p className="text-sm text-border">{dict.workstationsByBandEmpty}</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="py-1 pr-4">{dict.colWorkstation}</th>
                <th className="py-1 pr-4">{dict.colBand}</th>
                <th className="py-1">{dict.colAssessedAt}</th>
              </tr>
            </thead>
            <tbody>
              {workstationBands.map(({ workstation, band, assessedAt }) => (
                <tr
                  key={workstation.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="py-1 pr-4">
                    <Link
                      href={`/workstations/${workstation.id}/risk`}
                      className="underline hover:text-accent"
                    >
                      {workstation.name}
                    </Link>
                  </td>
                  <td className="py-1 pr-4">{band ?? dict.noAssessment}</td>
                  <td className="py-1">
                    {assessedAt ? assessedAt.toISOString() : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-bold">
          {dict.findingsByCategoryHeading}
        </h2>
        {findingsByCategoryRows.length === 0 ? (
          <p className="text-sm text-border">{dict.findingsByCategoryEmpty}</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="py-1 pr-4">{dict.colCategory}</th>
                <th className="py-1">{dict.colCount}</th>
              </tr>
            </thead>
            <tbody>
              {findingsByCategoryRows.map(([category, count]) => (
                <tr
                  key={category}
                  className="border-b border-border last:border-0"
                >
                  <td className="py-1 pr-4">
                    {hazardCategoryLabels[category]}
                  </td>
                  <td className="py-1">{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <ActionTable
        heading={dict.openActionsHeading}
        actions={actionRows}
        dict={dict}
        actionStatusLabels={actionStatusLabels}
      />
      <ActionTable
        heading={dict.overdueActionsHeading}
        actions={overdueActionRows}
        dict={dict}
        actionStatusLabels={actionStatusLabels}
      />
      <ActionTable
        heading={dict.awaitingVerificationHeading}
        actions={awaitingVerificationRows}
        dict={dict}
        actionStatusLabels={actionStatusLabels}
      />
    </div>
  );
}

function ActionTable({
  heading,
  actions,
  dict,
  actionStatusLabels,
}: {
  heading: string;
  actions: Array<{
    id: string;
    title: string;
    status: "OPEN" | "IN_PROGRESS" | "IMPLEMENTED" | "VERIFIED" | "CANCELLED";
    dueDate: Date | null;
    subject: string;
  }>;
  dict: {
    actionsEmpty: string;
    colTitle: string;
    colSubject: string;
    colDue: string;
    colStatus: string;
    viewLink: string;
  };
  actionStatusLabels: Record<
    "OPEN" | "IN_PROGRESS" | "IMPLEMENTED" | "VERIFIED" | "CANCELLED",
    string
  >;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-heading text-lg font-bold">{heading}</h2>
      {actions.length === 0 ? (
        <p className="text-sm text-border">{dict.actionsEmpty}</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="py-1 pr-4">{dict.colTitle}</th>
              <th className="py-1 pr-4">{dict.colSubject}</th>
              <th className="py-1 pr-4">{dict.colDue}</th>
              <th className="py-1 pr-4">{dict.colStatus}</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody>
            {actions.map((action) => (
              <tr
                key={action.id}
                className="border-b border-border last:border-0"
              >
                <td className="py-1 pr-4">{action.title}</td>
                <td className="py-1 pr-4">{action.subject}</td>
                <td className="py-1 pr-4">
                  {action.dueDate
                    ? action.dueDate.toISOString().slice(0, 10)
                    : ""}
                </td>
                <td className="py-1 pr-4">
                  {actionStatusLabels[action.status]}
                </td>
                <td className="py-1">
                  <Link
                    href={`/administration/actions/${action.id}`}
                    className="underline hover:text-accent"
                  >
                    {dict.viewLink}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
