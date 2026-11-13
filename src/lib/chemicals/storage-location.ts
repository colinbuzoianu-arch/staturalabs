import "server-only";

import type { StorageLocationType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

// P15 S5a: storage-location management (per site). The TRGS 510 Zusammenlagerungs-
// check (S5b) groups substance uses by their storageLocationId. Create resolves a
// name to an existing location (unique per site) or makes a new one — so the
// add-use form can offer "pick or type a new location" without duplicates.

export async function listStorageLocations(siteId: string) {
  return prisma.storageLocation.findMany({
    where: { siteId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, type: true },
  });
}

export async function createStorageLocation(input: {
  siteId: string;
  name: string;
  type?: StorageLocationType;
  notes?: string | null;
}): Promise<string> {
  const name = input.name.trim();
  if (!name) throw new Error("A storage location name is required");
  const existing = await prisma.storageLocation.findFirst({
    where: { siteId: input.siteId, name },
    select: { id: true },
  });
  if (existing) return existing.id;
  const row = await prisma.storageLocation.create({
    data: {
      siteId: input.siteId,
      name,
      type: input.type ?? "OTHER",
      notes: input.notes?.trim() || null,
    },
    select: { id: true },
  });
  return row.id;
}

// Resolve a form submission: an existing id wins; otherwise a typed new name
// creates-or-finds; otherwise null. Guards that an existing id belongs to the site.
export async function resolveStorageLocation(input: {
  siteId: string;
  storageLocationId?: string | null;
  newName?: string | null;
}): Promise<string | null> {
  if (input.storageLocationId) {
    const row = await prisma.storageLocation.findFirst({
      where: { id: input.storageLocationId, siteId: input.siteId },
      select: { id: true },
    });
    if (row) return row.id;
  }
  if (input.newName?.trim()) {
    return createStorageLocation({ siteId: input.siteId, name: input.newName });
  }
  return null;
}
