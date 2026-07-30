import "server-only";

import { prisma } from "@/lib/prisma";

// The active RiskMatrixVersion is data (ERGO_COMPLIANCE_BY_DESIGN.md
// §3.14), not a code constant — same fail-closed contract as
// getActiveMethodologyVersion (src/lib/scoring/methodology-version.ts).
// Zero active rows is a misconfiguration, not "no matrix selected yet":
// fail closed rather than falling back to some other version or a
// hardcoded default.
export async function getActiveRiskMatrixVersion(): Promise<string> {
  const active = await prisma.riskMatrixVersion.findFirst({
    where: { isActive: true },
  });

  if (!active) {
    throw new Error(
      "No active RiskMatrixVersion found — cannot score a risk finding without one",
    );
  }

  return active.version;
}
