import type { OperatingInstructionModel } from "@/generated/prisma/models";
import { prisma } from "@/lib/prisma";

// P8 §3.2 Betriebsanweisung lifecycle. createDraft is idempotent per
// (substance, site). isReviewRequired flags an approved instruction whose SDS
// has a newer revision than the one it was built from. The PDF
// generation/archiving on approval lives in the page server action (Node).

export async function createOperatingInstructionDraft(
  substanceId: string,
  siteId: string,
  companyId: string,
): Promise<OperatingInstructionModel> {
  const substance = await prisma.substance.findUnique({
    where: { id: substanceId },
    select: { companyId: true },
  });
  if (!substance || substance.companyId !== companyId) {
    throw new Error("Substance is not in this company");
  }
  const existing = await prisma.operatingInstruction.findFirst({
    where: { substanceId, siteId },
  });
  if (existing) return existing;

  const currentSds = await prisma.safetyDataSheet.findFirst({
    where: { substanceId, supersededAt: null },
    orderBy: { revisionDate: "desc" },
    select: { revisionDate: true },
  });
  return prisma.operatingInstruction.create({
    data: {
      substanceId,
      siteId,
      status: "DRAFT",
      basedOnSdsRevisionDate: currentSds?.revisionDate ?? null,
    },
  });
}

// An approved instruction needs review when the substance's current SDS is
// newer than the revision the instruction was built from (§3.2).
export function isOperatingInstructionReviewRequired(
  oi: {
    status: string;
    basedOnSdsRevisionDate: Date | null;
  },
  currentSdsRevisionDate: Date | null,
): boolean {
  if (oi.status !== "APPROVED") return false;
  if (!currentSdsRevisionDate) return false;
  if (!oi.basedOnSdsRevisionDate) return true;
  return currentSdsRevisionDate > oi.basedOnSdsRevisionDate;
}
