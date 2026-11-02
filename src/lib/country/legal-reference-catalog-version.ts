import "server-only";

import { prisma } from "@/lib/prisma";

// The active LegalReferenceCatalogVersion is data
// (ERGO_COMPLIANCE_BY_DESIGN.md §3.19), not a code constant — same
// fail-closed contract as getActiveExposureLimitCatalog
// (src/lib/risk/exposure-limit-catalog-version.ts). Zero active rows is a
// misconfiguration, not "no catalogue selected yet": fail closed rather than
// falling back to some other version or a hardcoded default.
//
// Note: today there is no active catalogue at all (nothing seeded until the
// founder verifies the SLD_P3_LEGAL_CATALOGUE_DRAFT.md rows), so every caller
// must be prepared for this to throw — which is why the hub/statutory-document
// generalisation that consumes it is NOT wired until a verified catalogue
// exists. Callers that merely want to *display* references treat a throw as
// "no legal catalogue configured for this market yet" (an honest gap), never
// as a reason to show another country's references.
export async function getActiveLegalReferenceCatalog(): Promise<string> {
  const active = await prisma.legalReferenceCatalogVersion.findFirst({
    where: { isActive: true },
  });

  if (!active) {
    throw new Error(
      "No active LegalReferenceCatalogVersion found — cannot resolve legal references without one",
    );
  }

  return active.version;
}
