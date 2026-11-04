import type { CmrCategory, CountryCode } from "@/generated/prisma/enums";
import { getActiveLegalReferenceCatalog } from "@/lib/country/legal-reference-catalog-version";
import { lookupLegalReferences } from "@/lib/country/legal-reference-lookup";
import { prisma } from "@/lib/prisma";

// P8 §3.3 substance register (Gefahrstoffverzeichnis / Arbeitsstoffliste).
export type SubstanceRegisterRow = {
  tradeName: string;
  classification: string; // signal word + CMR
  quantityClass: string;
  workAreas: string; // the active-use subjects
  sdsRef: string; // revision date of the current SDS, or "—"
};

export type SubstanceRegisterData = {
  companyName: string;
  siteName: string;
  country: CountryCode;
  isStatutoryRegister: boolean; // true for DE, false for AT (Arbeitsstoffliste)
  legalReferenceCode: string | null;
  rows: SubstanceRegisterRow[];
  excludedLowHazard: { tradeName: string; rationale: string | null }[];
};

const SIGNAL_DE: Record<string, string> = {
  GEFAHR: "Gefahr",
  ACHTUNG: "Achtung",
  NONE: "—",
};

function cmrText(c: {
  carcinogenicCategory: CmrCategory;
  mutagenicCategory: CmrCategory;
  reprotoxicCategory: CmrCategory;
}): string {
  const parts: string[] = [];
  if (c.carcinogenicCategory !== "NONE")
    parts.push(`C ${c.carcinogenicCategory.replace("CAT_", "")}`);
  if (c.mutagenicCategory !== "NONE")
    parts.push(`M ${c.mutagenicCategory.replace("CAT_", "")}`);
  if (c.reprotoxicCategory !== "NONE")
    parts.push(`R ${c.reprotoxicCategory.replace("CAT_", "")}`);
  return parts.join(", ");
}

export async function getSubstanceRegisterData(
  siteId: string,
): Promise<SubstanceRegisterData | null> {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: { company: true },
  });
  if (!site) return null;

  const uses = await prisma.substanceUse.findMany({
    where: { siteId, activeTo: null },
    include: {
      substance: {
        include: {
          safetyDataSheets: {
            where: { supersededAt: null },
            orderBy: { revisionDate: "desc" },
            take: 1,
          },
        },
      },
      workstation: { select: { name: true } },
      process: { select: { name: true } },
      orgUnit: { select: { name: true } },
    },
  });

  // Group by substance; collect its work areas + widest quantity class.
  const bySubstance = new Map<
    string,
    { rows: SubstanceRegisterRow; areas: Set<string> }
  >();
  for (const use of uses) {
    if (use.substance.excludedLowHazard) continue;
    const area =
      use.workstation?.name ?? use.process?.name ?? use.orgUnit?.name ?? "—";
    const existing = bySubstance.get(use.substanceId);
    if (existing) {
      existing.areas.add(area);
      existing.rows.workAreas = [...existing.areas].join(", ");
    } else {
      const sds = use.substance.safetyDataSheets[0];
      bySubstance.set(use.substanceId, {
        areas: new Set([area]),
        rows: {
          tradeName: use.substance.tradeName,
          classification:
            [SIGNAL_DE[use.substance.signalWord] ?? "—", cmrText(use.substance)]
              .filter((x) => x && x !== "—")
              .join(" · ") || "—",
          quantityClass: use.quantityClass,
          workAreas: area,
          sdsRef: sds ? sds.revisionDate.toISOString().slice(0, 10) : "—",
        },
      });
    }
  }

  const excluded = await prisma.substance.findMany({
    where: { companyId: site.companyId, excludedLowHazard: true },
    select: { tradeName: true, excludedLowHazardRationale: true },
    orderBy: { tradeName: "asc" },
  });

  let legalReferenceCode: string | null = null;
  try {
    const catalogVersion = await getActiveLegalReferenceCatalog();
    const refs = await lookupLegalReferences({
      country: site.country,
      topic: "substance-register",
      catalogVersion,
    });
    legalReferenceCode = refs[0]?.code ?? null;
  } catch {
    legalReferenceCode = null;
  }

  return {
    companyName: site.company.name,
    siteName: site.name,
    country: site.country,
    isStatutoryRegister: site.country === "DE",
    legalReferenceCode,
    rows: [...bySubstance.values()]
      .map((v) => v.rows)
      .sort((a, b) => a.tradeName.localeCompare(b.tradeName)),
    excludedLowHazard: excluded.map((e) => ({
      tradeName: e.tradeName,
      rationale: e.excludedLowHazardRationale,
    })),
  };
}
