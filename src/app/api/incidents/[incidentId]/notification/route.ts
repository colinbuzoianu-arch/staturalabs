import { renderToBuffer } from "@react-pdf/renderer";
import { notFound } from "next/navigation";
import { createElement } from "react";
import { requireSiteAccess } from "@/lib/auth/require-access";
import { resolveNotificationCountryPack } from "@/lib/incidents/notification-availability";
import { prisma } from "@/lib/prisma";
import { archiveGeneratedDocument } from "@/lib/report/archive-generated-document";
import { getIncidentNotificationData } from "@/lib/report/get-incident-notification-data";
import { IncidentNotificationDocument } from "@/lib/report/IncidentNotificationDocument";

// P10d §D.4: the pre-filled statutory-notification data sheet for an incident.
// Resource-first gate (fetch the incident, resolve its site, then requireSite-
// Access — the exact fail-closed pattern the dashboard uses), then country-gate
// fail-closed (AT/DE verified packs; CH/RO → 400, never a silent guess §3.15).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ incidentId: string }> },
) {
  const { incidentId } = await params;
  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    select: { siteId: true, site: { select: { country: true } } },
  });
  if (!incident) notFound();
  const { user, site } = await requireSiteAccess(incident.siteId);

  if (!resolveNotificationCountryPack(site.country)) {
    return Response.json(
      {
        error: `Statutory notification support is not available for country ${site.country} — no verified country pack.`,
      },
      { status: 400 },
    );
  }

  const data = await getIncidentNotificationData(incidentId);
  if (!data) notFound();

  const buffer = await renderToBuffer(
    createElement(IncidentNotificationDocument, { data }) as Parameters<
      typeof renderToBuffer
    >[0],
  );

  try {
    await archiveGeneratedDocument({
      type: "INCIDENT_NOTIFICATION",
      companyId: site.companyId,
      siteId: site.id,
      title: data.incident.title,
      country: site.country,
      generatedByUserId: user.id,
      versions: null,
      buffer,
    });
  } catch (error) {
    console.error("Failed to archive incident notification:", error);
  }

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="statura-unfallmeldung-${incidentId}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
