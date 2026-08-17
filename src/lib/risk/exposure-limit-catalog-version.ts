import "server-only";

import { prisma } from "@/lib/prisma";

// The active ExposureLimitCatalogVersion is data
// (ERGO_COMPLIANCE_BY_DESIGN.md §3.15), not a code constant — same
// fail-closed contract as getActiveMethodologyVersion
// (src/lib/scoring/methodology-version.ts) and getActiveRiskMatrixVersion
// (src/lib/risk/matrix-version.ts). Zero active rows is a
// misconfiguration, not "no catalog selected yet": fail closed rather
// than falling back to some other version or a hardcoded default.
export async function getActiveExposureLimitCatalog(): Promise<string> {
  const active = await prisma.exposureLimitCatalogVersion.findFirst({
    where: { isActive: true },
  });

  if (!active) {
    throw new Error(
      "No active ExposureLimitCatalogVersion found — cannot resolve exposure limits without one",
    );
  }

  return active.version;
}
