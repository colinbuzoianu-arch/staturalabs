import "server-only";

import { prisma } from "@/lib/prisma";

// The active TypicalMeasureCatalogVersion is data, not a code constant — same
// fail-closed contract as getActiveExposureLimitCatalog /
// getActiveLegalReferenceCatalog. Zero active rows is a misconfiguration:
// throw rather than fall back. Callers that merely want to OFFER suggestions
// treat a throw as "no measure catalogue configured" (an empty picker), never
// a reason to invent measures.
export async function getActiveTypicalMeasureCatalog(): Promise<string> {
  const active = await prisma.typicalMeasureCatalogVersion.findFirst({
    where: { isActive: true },
  });
  if (!active) {
    throw new Error(
      "No active TypicalMeasureCatalogVersion found — cannot resolve typical measures without one",
    );
  }
  return active.version;
}
