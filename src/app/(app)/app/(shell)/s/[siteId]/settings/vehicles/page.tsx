import { revalidatePath } from "next/cache";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import { createVehicle, retireVehicle } from "@/lib/fleet/vehicle";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";

// P14 G4: the Fuhrpark register — a company's fleet master (person-free). Create
// + list + retire, with each vehicle's Fahrzeugereignis count (the fleet-level
// incident view). Company-scoped; a vehicle may be placed at this site or left
// company-wide.
export default async function VehiclesPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const { site } = await requireSiteAdministrationAccess(siteId);
  const companyId = site.companyId;
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).settingsVehicles;

  async function createVehicleAction(formData: FormData) {
    "use server";
    const { user, site: s } = await requireSiteAdministrationAccess(siteId);
    const d = getAdministrationDictionary(await getLocale()).settingsVehicles;
    const identifier = formData.get("identifier");
    const type = formData.get("type");
    if (typeof identifier !== "string" || identifier.trim().length === 0) {
      throw new Error(d.identifierRequired);
    }
    if (typeof type !== "string" || type.trim().length === 0) {
      throw new Error(d.typeRequired);
    }
    const atSite = formData.get("atSite") === "on";
    const notes = formData.get("notes");
    await createVehicle({
      companyId: s.companyId,
      siteId: atSite ? siteId : null,
      orgUnitId: null,
      identifier,
      type,
      notes: typeof notes === "string" ? notes : null,
      actorUserId: user.id,
    });
    revalidatePath(`/app/s/${siteId}/settings/vehicles`);
  }

  async function retireVehicleAction(formData: FormData) {
    "use server";
    const { user, site: s } = await requireSiteAdministrationAccess(siteId);
    const id = formData.get("id");
    if (typeof id === "string" && id.length > 0) {
      await retireVehicle({
        vehicleId: id,
        companyId: s.companyId,
        actorUserId: user.id,
      });
    }
    revalidatePath(`/app/s/${siteId}/settings/vehicles`);
  }

  const vehicles = await prisma.vehicle.findMany({
    where: { companyId },
    orderBy: [{ activeTo: "asc" }, { identifier: "asc" }],
    include: {
      site: { select: { name: true } },
      _count: { select: { incidents: true } },
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-foreground-subtle">
          {dict.eyebrow}
        </p>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-foreground">
          {dict.heading}
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">{dict.intro}</p>
      </div>

      <Card>
        <CardHeader title={dict.addTitle} />
        <CardBody>
          <form
            action={createVehicleAction}
            className="flex flex-wrap items-end gap-3 text-sm"
          >
            <label className="flex flex-col gap-1">
              {dict.identifierLabel}
              <input
                name="identifier"
                required
                className="w-40 rounded border border-border bg-background px-2 py-1"
              />
            </label>
            <label className="flex flex-col gap-1">
              {dict.typeLabel}
              <input
                name="type"
                required
                placeholder={dict.typePlaceholder}
                className="w-40 rounded border border-border bg-background px-2 py-1"
              />
            </label>
            <label className="flex flex-col gap-1">
              {dict.notesLabel}
              <input
                name="notes"
                className="w-48 rounded border border-border bg-background px-2 py-1"
              />
            </label>
            <label className="flex items-center gap-2 pb-1.5">
              <input type="checkbox" name="atSite" defaultChecked />
              {dict.atSiteLabel}
            </label>
            <button
              type="submit"
              className="rounded-[var(--radius-md)] bg-accent px-4 py-2 font-medium text-background"
            >
              {dict.addButton}
            </button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={`${dict.listTitle} (${vehicles.length})`} />
        <CardBody>
          {vehicles.length === 0 ? (
            <EmptyState title={dict.empty} />
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-foreground-muted">
                  <th className="py-1 pr-3">{dict.colIdentifier}</th>
                  <th className="py-1 pr-3">{dict.colType}</th>
                  <th className="py-1 pr-3">{dict.colPlacement}</th>
                  <th className="py-1 pr-3 text-right">{dict.colIncidents}</th>
                  <th className="py-1 pr-3">{dict.colStatus}</th>
                  <th className="py-1" />
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v) => {
                  const retired = v.activeTo !== null;
                  return (
                    <tr
                      key={v.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="py-1.5 pr-3 font-medium text-foreground">
                        {v.identifier}
                      </td>
                      <td className="py-1.5 pr-3 text-foreground-muted">
                        {v.type}
                      </td>
                      <td className="py-1.5 pr-3 text-foreground-subtle">
                        {v.site?.name ?? dict.companyWide}
                      </td>
                      <td className="py-1.5 pr-3 text-right text-foreground-muted">
                        {v._count.incidents}
                      </td>
                      <td className="py-1.5 pr-3">
                        <Badge tone={retired ? "neutral" : "low"}>
                          {retired ? dict.retired : dict.active}
                        </Badge>
                      </td>
                      <td className="py-1.5 text-right">
                        {!retired && (
                          <form action={retireVehicleAction}>
                            <input type="hidden" name="id" value={v.id} />
                            <button
                              type="submit"
                              className="text-xs text-foreground-subtle hover:text-status-high hover:underline"
                            >
                              {dict.retireButton}
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
