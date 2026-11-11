import { IncidentType } from "@/generated/prisma/enums";
import { hasPermission } from "@/lib/auth/permissions";
import { requireSiteAccess } from "@/lib/auth/require-access";
import { createIncident } from "@/lib/incidents/incident";

// P14 G6: sync endpoint for the offline quick-capture (Ereignis-Schnellmeldung).
// Creates a person-free Incident via the one incident gate. Gated by
// requireSiteAccess + incidents.write. The client holds captures in a local
// queue while offline and POSTs here on reconnect.

const VALID_TYPES = new Set<string>(Object.values(IncidentType));
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const { siteId } = await params;
  const { user, site } = await requireSiteAccess(siteId);
  if (!hasPermission(user, "incidents.write")) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid-json" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const type = typeof b.type === "string" ? b.type.toUpperCase() : "";
  const title = typeof b.title === "string" ? b.title : "";
  const description = typeof b.description === "string" ? b.description : "";
  const occurredAtRaw = typeof b.occurredAt === "string" ? b.occurredAt : "";

  if (!VALID_TYPES.has(type))
    return Response.json({ error: "invalid-type" }, { status: 400 });
  if (title.trim().length === 0)
    return Response.json({ error: "missing-title" }, { status: 400 });
  if (description.trim().length === 0)
    return Response.json({ error: "missing-description" }, { status: 400 });
  if (!ISO_DATE.test(occurredAtRaw))
    return Response.json({ error: "invalid-date" }, { status: 400 });

  const { id } = await createIncident({
    companyId: site.companyId,
    siteId,
    type: type as IncidentType,
    title,
    description,
    occurredAt: new Date(`${occurredAtRaw}T00:00:00.000Z`),
    actorUserId: user.id,
    reportedByUserId: user.id,
  });

  return Response.json({ id }, { status: 201 });
}
