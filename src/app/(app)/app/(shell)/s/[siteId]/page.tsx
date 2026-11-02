import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { requireSiteAccess } from "@/lib/auth/require-access";
import { prisma } from "@/lib/prisma";

// Cockpit v1 (SLD_RESTRUCTURE_PLAN_platform-modules.md §2.1, §5.1) — the site
// landing inside the sidebar shell. A modest, real overview now (counts +
// workstation list + quick links); the full KPI/overdue cockpit is P4. Links
// into the risk module still point at the (legacy) workstation pages until
// that module migrates — those URLs keep working via their own chrome.
export default async function CockpitPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const { site } = await requireSiteAccess(siteId);

  const [workstations, approvedCount, openActions] = await Promise.all([
    prisma.workstation.findMany({
      where: { siteId },
      select: { id: true, name: true, location: true },
      orderBy: { name: "asc" },
    }),
    prisma.riskAssessment.count({ where: { siteId, status: "APPROVED" } }),
    prisma.action.count({
      where: { siteId, status: { in: ["OPEN", "IN_PROGRESS"] } },
    }),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-foreground-subtle">
          Cockpit
        </p>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-foreground">
          {site.name}
        </h1>
        {site.address ? (
          <p className="text-sm text-foreground-muted">{site.address}</p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi
          label="Arbeitsplätze"
          value={workstations.length}
          tone="foreground"
        />
        <Kpi
          label="Freigegebene Beurteilungen"
          value={approvedCount}
          tone="info"
        />
        <Kpi
          label="Offene Maßnahmen"
          value={openActions}
          tone="accent-secondary"
        />
      </div>

      <Card>
        <CardHeader
          title="Arbeitsplätze"
          description="Zum Arbeitsplatz-Hub für Evaluierung und Ergonomie"
        />
        <CardBody>
          {workstations.length === 0 ? (
            <EmptyState
              title="Noch keine Arbeitsplätze"
              description="Arbeitsplätze werden im internen Admin-Werkzeug angelegt."
            />
          ) : (
            <ul className="divide-y divide-border">
              {workstations.map((w) => (
                <li key={w.id}>
                  <Link
                    href={`/app/s/${siteId}/risk/workstations/${w.id}`}
                    className="flex items-center justify-between gap-3 px-1 py-2.5 text-sm hover:text-accent"
                  >
                    <span className="font-medium text-foreground">
                      {w.name}
                    </span>
                    {w.location ? (
                      <span className="text-foreground-subtle">
                        {w.location}
                      </span>
                    ) : null}
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

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "foreground" | "info" | "accent-secondary";
}) {
  const color =
    tone === "info"
      ? "text-info"
      : tone === "accent-secondary"
        ? "text-accent-secondary"
        : "text-foreground";
  return (
    <Card>
      <CardBody>
        <p className="text-xs text-foreground-subtle">{label}</p>
        <p
          className={`font-[family-name:var(--font-heading)] text-3xl font-bold ${color}`}
        >
          {value}
        </p>
      </CardBody>
    </Card>
  );
}
