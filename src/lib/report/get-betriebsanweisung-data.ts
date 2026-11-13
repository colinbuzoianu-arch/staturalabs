import type {
  CmrCategory,
  GhsPictogram,
  RiskAssessmentStatus,
} from "@/generated/prisma/enums";
import type { BaAiDraft } from "@/lib/chemicals/operating-instruction-draft";
import { getActiveLegalReferenceCatalog } from "@/lib/country/legal-reference-catalog-version";
import { lookupLegalReferences } from "@/lib/country/legal-reference-lookup";
import { prisma } from "@/lib/prisma";

// P8 §3.2 data for one Betriebsanweisung (by OperatingInstruction id).
export type BetriebsanweisungData = {
  companyName: string;
  siteName: string;
  country: string;
  status: RiskAssessmentStatus;
  approvedByName: string | null;
  approvedAt: Date | null;
  substance: {
    tradeName: string;
    manufacturer: string | null;
    signalWord: string;
    carcinogenicCategory: CmrCategory;
    mutagenicCategory: CmrCategory;
    reprotoxicCategory: CmrCategory;
  };
  pictograms: GhsPictogram[];
  hStatements: { code: string; text: string | null }[];
  currentSdsRevisionDate: Date | null;
  uses: { subject: string; purpose: string; exposureRoutes: string[] }[];
  legalReferenceCode: string | null;
  aiDraft: BaAiDraft | null;
};

export async function getBetriebsanweisungData(
  operatingInstructionId: string,
): Promise<BetriebsanweisungData | null> {
  const oi = await prisma.operatingInstruction.findUnique({
    where: { id: operatingInstructionId },
    include: {
      site: { include: { company: true } },
      substance: {
        include: {
          pictograms: true,
          statements: true,
          safetyDataSheets: { orderBy: { revisionDate: "desc" } },
          uses: {
            include: {
              workstation: { select: { name: true } },
              process: { select: { name: true } },
              orgUnit: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  if (!oi) return null;

  let approvedByName: string | null = null;
  if (oi.approvedByUserId) {
    const u = await prisma.platformUser.findUnique({
      where: { id: oi.approvedByUserId },
      select: { name: true },
    });
    approvedByName = u?.name ?? null;
  }

  // Legal anchor for the country (§3.2 — from the catalogue, never hard-coded).
  let legalReferenceCode: string | null = null;
  try {
    const catalogVersion = await getActiveLegalReferenceCatalog();
    const refs = await lookupLegalReferences({
      country: oi.site.country,
      topic: "substance-operating-instruction",
      catalogVersion,
    });
    legalReferenceCode = refs[0]?.code ?? null;
  } catch {
    legalReferenceCode = null;
  }

  const currentSds =
    oi.substance.safetyDataSheets.find((s) => s.supersededAt === null) ?? null;

  return {
    companyName: oi.site.company.name,
    siteName: oi.site.name,
    country: oi.site.country,
    status: oi.status,
    approvedByName,
    approvedAt: oi.approvedAt,
    substance: {
      tradeName: oi.substance.tradeName,
      manufacturer: oi.substance.manufacturer,
      signalWord: oi.substance.signalWord,
      carcinogenicCategory: oi.substance.carcinogenicCategory,
      mutagenicCategory: oi.substance.mutagenicCategory,
      reprotoxicCategory: oi.substance.reprotoxicCategory,
    },
    pictograms: oi.substance.pictograms.map((p) => p.pictogram),
    hStatements: oi.substance.statements
      .filter((s) => s.kind === "H")
      .map((s) => ({ code: s.code, text: s.text })),
    currentSdsRevisionDate: currentSds?.revisionDate ?? null,
    aiDraft: (oi.aiDraft as BaAiDraft | null) ?? null,
    uses: oi.substance.uses
      .filter((u) => u.activeTo === null)
      .map((u) => ({
        subject:
          u.workstation?.name ?? u.process?.name ?? u.orgUnit?.name ?? "—",
        purpose: u.purpose,
        exposureRoutes: u.exposureRoutes,
      })),
    legalReferenceCode,
  };
}
