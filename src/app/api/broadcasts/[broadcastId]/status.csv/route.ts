import { notFound, redirect } from "next/navigation";
import { userCan } from "@/lib/auth/company-role-bundle";
import { getCurrentPlatformUser } from "@/lib/auth/current-user";
import { getBroadcastStatus } from "@/lib/broadcasts/status";
import { prisma } from "@/lib/prisma";

// The confirmation list as CSV — the artifact a sender hands to an auditor or
// a works-council meeting.
//
// Scoped by exactly the same resolver the page uses, so the file can never
// contain more than the viewer may see on screen: a leader exports their own
// units, and a works-council viewer gets the aggregate rows only (no names).
//
// XLSX is deliberately not here: the P12 KPI export made the same call (CSV
// now, XLSX deferred), and shipping one format that opens correctly in Excel
// beats two half-tested ones. BOM + CRLF so German Excel reads the umlauts.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ broadcastId: string }> },
) {
  const { broadcastId } = await params;
  const user = await getCurrentPlatformUser();
  if (!user) redirect("/login");
  if (!(await userCan(user, "broadcasts.read"))) notFound();

  const broadcast = await prisma.broadcast.findUnique({
    where: { id: broadcastId },
    select: {
      id: true,
      companyId: true,
      title: true,
      status: true,
      publishedAt: true,
    },
  });
  // Tenant isolation first, then "is there anything to export".
  if (!broadcast || broadcast.companyId !== user.companyId) notFound();
  if (broadcast.status === "DRAFT") notFound();

  const status = await getBroadcastStatus({ broadcastId, viewer: user });
  const rows: string[][] = [];

  if (status.personsSuppressed) {
    // Aggregate-only export (works council): rates, never individuals, with
    // the §3.4 suppression already applied by the resolver.
    rows.push(["Organisationseinheit", "Empfänger", "Bestätigt", "Quote"]);
    for (const row of status.byOrgUnit) {
      rows.push([
        row.label,
        String(row.recipients),
        String(row.confirmed),
        row.confirmationRate === null ? "n<5" : `${row.confirmationRate}`,
      ]);
    }
  } else {
    rows.push([
      "Name",
      "Organisationseinheit",
      "Zugestellt",
      "Gelesen",
      "Bestätigt",
    ]);
    for (const person of status.persons) {
      rows.push([
        person.name,
        person.orgUnitName ?? "",
        person.deliveredAt?.toISOString() ?? "",
        person.readAt?.toISOString() ?? "",
        person.confirmedAt?.toISOString() ?? "",
      ]);
    }
  }

  const escapeCell = (value: string) =>
    /[";\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  const csv = rows.map((r) => r.map(escapeCell).join(";")).join("\r\n");
  const fileName = `sicherheitsinformation-${broadcastId}.csv`;

  return new Response(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
