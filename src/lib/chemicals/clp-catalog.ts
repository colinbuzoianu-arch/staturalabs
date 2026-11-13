import "server-only";

import { prisma } from "@/lib/prisma";

// P15 S1: resolve the active CLP reference catalogue. UNLIKE
// getActiveExposureLimitCatalog (which throws on zero active rows), this returns
// null when no catalogue is active yet — a deliberately-modeled, legitimate
// state: S1 says the per-substance statement entry "keeps the format validation
// for codes not yet in the catalogue", so lookups degrade to code-format
// validation rather than failing. The fail-closed contract lives on ACTIVATION
// instead (activateClpCatalog + the isActive => reconciliationPassed DB CHECK):
// a version may not go live until its official import reconciles.
export async function getActiveClpCatalogVersion(): Promise<string | null> {
  const active = await prisma.clpCatalogVersion.findFirst({
    where: { isActive: true },
    select: { version: true },
  });
  return active?.version ?? null;
}

export type ClpStatementLookup = {
  code: string;
  kind: string;
  textEn: string;
  textDe: string;
  sourceRef: string;
  catalogVersion: string;
};

// Resolve one statement code against the active catalogue. Returns null when no
// catalogue is active or the code is not in it (the caller then falls back to
// code-format validation). Never invents a wording.
export async function lookupClpStatement(
  code: string,
): Promise<ClpStatementLookup | null> {
  const version = await getActiveClpCatalogVersion();
  if (!version) return null;
  const row = await prisma.clpStatement.findUnique({
    where: {
      catalogVersion_code: {
        catalogVersion: version,
        code: code.trim().toUpperCase(),
      },
    },
    select: {
      code: true,
      kind: true,
      textEn: true,
      textDe: true,
      sourceRef: true,
      catalogVersion: true,
    },
  });
  return row ?? null;
}
