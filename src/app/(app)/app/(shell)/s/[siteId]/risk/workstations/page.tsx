import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { requireSiteAccess } from "@/lib/auth/require-access";
import { prisma } from "@/lib/prisma";

// Risk module › Arbeitsplätze: the site's workstations, each linking to its
// assessment hub (SLD_RESTRUCTURE_PLAN_platform-modules.md §6). Read-only
// list; workstations are created in the internal /admin tool.
export default async function WorkstationsListPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const { site } = await requireSiteAccess(siteId);

  const [workstations, floorPlanCount] = await Promise.all([
    prisma.workstation.findMany({
      where: { siteId },
      select: {
        id: true,
        name: true,
        location: true,
        orgUnit: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.floorPlan.count({ where: { siteId } }),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-foreground-subtle">
          {site.name} · Gefährdungsbeurteilung
        </p>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-foreground">
          Arbeitsplätze
        </h1>
      </div>

      {/* Lagepläne prominently surfaced here (not just the small cockpit
          link): the floor plan is where workstations are placed and read on a
          site map. */}
      <Card>
        <CardHeader
          title="Lagepläne"
          description={
            floorPlanCount > 0
              ? `${floorPlanCount} ${floorPlanCount === 1 ? "Lageplan" : "Lagepläne"} · Arbeitsplätze auf dem Lageplan platzieren und verwalten`
              : "Noch kein Lageplan hochgeladen — Lageplan hochladen und Arbeitsplätze darauf platzieren"
          }
          action={
            <Link href={`/app/s/${siteId}/risk/floor-plan`}>
              <Button variant="secondary" size="sm">
                Lagepläne verwalten →
              </Button>
            </Link>
          }
        />
      </Card>

      <Card>
        <CardHeader
          title="Arbeitsplätze"
          description="Zum Hub für Evaluierung, Ergonomie und Maßnahmen"
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
                    <span className="text-foreground-subtle">
                      {[w.orgUnit?.name, w.location]
                        .filter(Boolean)
                        .join(" · ")}
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
