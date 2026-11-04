import { notFound } from "next/navigation";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { getAccessibleSites } from "@/lib/auth/accessible-sites";
import { requireAdministrationAccess } from "@/lib/auth/require-access";
import { prisma } from "@/lib/prisma";

// P7a DSAR export (plan §7.7): one person's records across the people
// compartment as JSON, for a data-subject access request. Gated the same way
// the register is reached: requireAdministrationAccess (sends super_admin/l3
// to /admin) + the acting admin must administer at least one site of the
// person's company. The export is a people-compartment read, so it is
// audited. It grows to include training records (P7c) and incidents (P10) as
// those are built.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ personId: string }> },
) {
  const { personId } = await params;
  const user = await requireAdministrationAccess();

  const person = await prisma.person.findUnique({
    where: { id: personId },
    include: { assignments: true },
  });
  if (!person) notFound();

  const accessibleSites = await getAccessibleSites(user);
  const canAccess = accessibleSites.some(
    (s) => s.companyId === person.companyId,
  );
  if (!canAccess) notFound();

  await recordAuditEvent({
    actorUserId: user.id,
    action: "person.export",
    entityType: "Person",
    entityId: person.id,
    companyId: person.companyId,
  });

  const payload = {
    exportedAt: new Date().toISOString(),
    person: {
      id: person.id,
      firstName: person.firstName,
      lastName: person.lastName,
      personnelNumber: person.personnelNumber,
      orgUnitId: person.orgUnitId,
      employmentStart: person.employmentStart,
      employmentEnd: person.employmentEnd,
      active: person.active,
      anonymisedAt: person.anonymisedAt,
    },
    assignments: person.assignments,
  };

  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="person-${person.id}.json"`,
    },
  });
}
