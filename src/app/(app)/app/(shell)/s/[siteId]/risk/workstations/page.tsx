import { revalidatePath } from "next/cache";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/misc";
import { PlatformRole } from "@/generated/prisma/enums";
import {
  requireSiteAccess,
  requireSiteAdministrationAccess,
} from "@/lib/auth/require-access";
import { prisma } from "@/lib/prisma";

// Risk module › Arbeitsplätze: the site's workstations, each linking to its
// assessment hub (SLD_RESTRUCTURE_PLAN_platform-modules.md §6). A site/company
// admin can add workstations here (previously only possible in the internal
// /admin tool); the create action is gated by requireSiteAdministrationAccess.
export default async function WorkstationsListPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const { user, site } = await requireSiteAccess(siteId);
  const canManage =
    user.role === PlatformRole.COMPANY_ADMIN ||
    user.role === PlatformRole.SITE_ADMIN;

  async function createWorkstationAction(formData: FormData) {
    "use server";
    await requireSiteAdministrationAccess(siteId);
    const name = formData.get("name");
    const location = formData.get("location");
    if (typeof name !== "string" || name.trim().length === 0) return;
    await prisma.workstation.create({
      data: {
        siteId,
        name: name.trim(),
        location:
          typeof location === "string" && location.trim().length > 0
            ? location.trim()
            : null,
      },
    });
    revalidatePath(`/app/s/${siteId}/risk/workstations`);
  }

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

      {canManage && (
        <Card>
          <CardHeader
            title="Arbeitsplatz hinzufügen"
            description="Neuen Arbeitsplatz an diesem Standort anlegen"
          />
          <CardBody>
            <form
              action={createWorkstationAction}
              className="flex flex-wrap items-end gap-3"
            >
              <div className="flex flex-col gap-1">
                <Label htmlFor="ws-name">Bezeichnung</Label>
                <Input
                  id="ws-name"
                  name="name"
                  required
                  placeholder="z. B. Montageplatz 3"
                  className="w-64"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="ws-location">Ort / Bereich (optional)</Label>
                <Input
                  id="ws-location"
                  name="location"
                  placeholder="z. B. Halle 2, Linie A"
                  className="w-64"
                />
              </div>
              <Button type="submit">Anlegen</Button>
            </form>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Arbeitsplätze"
          description="Zum Hub für Evaluierung, Ergonomie und Maßnahmen"
        />
        <CardBody>
          {workstations.length === 0 ? (
            <EmptyState
              title="Noch keine Arbeitsplätze"
              description={
                canManage
                  ? "Legen Sie oben den ersten Arbeitsplatz an."
                  : "An diesem Standort sind noch keine Arbeitsplätze angelegt."
              }
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
