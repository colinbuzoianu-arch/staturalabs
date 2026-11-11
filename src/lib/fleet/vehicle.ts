import "server-only";

import { recordAuditEvent } from "@/lib/audit/audit-event";
import { prisma } from "@/lib/prisma";

// P14 G4: fleet master gate. Person-free — a Vehicle never holds a driver.
// Company-scoped; optional site/org-unit placement must belong to the company.
// Audited. Retiring a vehicle sets activeTo (never a hard delete; the identifier
// then frees up for a replacement).

export async function createVehicle(input: {
  companyId: string;
  siteId: string | null;
  orgUnitId: string | null;
  identifier: string;
  type: string;
  notes: string | null;
  actorUserId: string | null;
}): Promise<{ id: string }> {
  const identifier = input.identifier.trim();
  const type = input.type.trim();
  if (identifier.length === 0)
    throw new Error("Vehicle identifier is required");
  if (type.length === 0) throw new Error("Vehicle type is required");

  // Site/org-unit (if given) must belong to this company.
  if (input.siteId) {
    const site = await prisma.site.findFirst({
      where: { id: input.siteId, companyId: input.companyId },
      select: { id: true },
    });
    if (!site) throw new Error("Site does not belong to this company");
  }
  if (input.orgUnitId) {
    const ou = await prisma.orgUnit.findFirst({
      where: { id: input.orgUnitId, site: { companyId: input.companyId } },
      select: { id: true },
    });
    if (!ou) throw new Error("Org unit does not belong to this company");
  }

  const vehicle = await prisma.vehicle.create({
    data: {
      companyId: input.companyId,
      siteId: input.siteId,
      orgUnitId: input.orgUnitId,
      identifier,
      type,
      notes: input.notes?.trim() || null,
    },
    select: { id: true },
  });

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "vehicle.create",
    entityType: "Vehicle",
    entityId: vehicle.id,
    companyId: input.companyId,
    siteId: input.siteId,
    diff: { identifier, type },
  });
  return vehicle;
}

// Retire a vehicle (soft — sets activeTo). Scoped to the company.
export async function retireVehicle(input: {
  vehicleId: string;
  companyId: string;
  actorUserId: string | null;
}): Promise<void> {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: input.vehicleId, companyId: input.companyId, activeTo: null },
    select: { id: true, siteId: true },
  });
  if (!vehicle) throw new Error("Vehicle not found or already retired");
  await prisma.vehicle.update({
    where: { id: vehicle.id },
    data: { activeTo: new Date() },
  });
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "vehicle.retire",
    entityType: "Vehicle",
    entityId: vehicle.id,
    companyId: input.companyId,
    siteId: vehicle.siteId,
  });
}

// Link / unlink a Fahrzeugereignis to a vehicle. Both the incident and the
// vehicle must belong to the company (person-free link).
export async function setIncidentVehicle(input: {
  incidentId: string;
  vehicleId: string | null;
  companyId: string;
  actorUserId: string | null;
}): Promise<void> {
  const incident = await prisma.incident.findFirst({
    where: { id: input.incidentId, companyId: input.companyId },
    select: { id: true, siteId: true },
  });
  if (!incident) throw new Error("Incident not found");
  if (input.vehicleId) {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: input.vehicleId, companyId: input.companyId },
      select: { id: true },
    });
    if (!vehicle) throw new Error("Vehicle does not belong to this company");
  }
  await prisma.incident.update({
    where: { id: incident.id },
    data: { vehicleId: input.vehicleId },
  });
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "incident.set_vehicle",
    entityType: "Incident",
    entityId: incident.id,
    companyId: input.companyId,
    siteId: incident.siteId,
    diff: { vehicleId: input.vehicleId },
  });
}
