import "server-only";

import { prisma } from "@/lib/prisma";
import type { ConfirmedSdsData } from "../sds-extraction-schema";
import { assessEngineReadiness, type EngineReadiness } from "./data-readiness";

// P16 §3.2: build the per-engine readiness for a product from the DB (composition
// + H-statements + latest confirmed SDS), then assess it with the pure function.
export async function getEngineReadiness(
  substanceId: string,
): Promise<EngineReadiness[]> {
  const sub = await prisma.substance.findUnique({
    where: { id: substanceId },
    include: {
      statements: { select: { kind: true, code: true } },
      mixtureComponents: {
        include: {
          referenceSubstance: {
            include: { properties: { select: { propertyType: true } } },
          },
        },
      },
      safetyDataSheets: {
        where: { supersededAt: null },
        orderBy: { revisionDate: "desc" },
        take: 1,
        select: { confirmedData: true },
      },
    },
  });
  if (!sub)
    return assessEngineReadiness({
      components: [],
      hStatementCodes: [],
      unNumber: null,
      flashPointKnown: false,
    });

  const confirmed = sub.safetyDataSheets[0]?.confirmedData as
    | ConfirmedSdsData
    | null
    | undefined;
  return assessEngineReadiness({
    components: sub.mixtureComponents.map((c) => ({
      hasConcentration:
        c.concentrationExactPct != null ||
        c.concentrationMinPct != null ||
        c.concentrationMaxPct != null,
      hasClassificationOrAte:
        Boolean(c.classification) ||
        c.ateOral != null ||
        c.ateDermal != null ||
        c.ateInhalation != null,
      hasDensity: Boolean(
        c.referenceSubstance?.properties.some(
          (p) => p.propertyType === "DENSITY",
        ),
      ),
      hasWgk: c.wgk != null,
    })),
    hStatementCodes: sub.statements
      .filter((s) => s.kind === "H")
      .map((s) => s.code),
    unNumber: confirmed?.unNumber ?? null,
    flashPointKnown: Boolean(confirmed?.flashPoint),
  });
}
