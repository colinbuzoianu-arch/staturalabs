import type {
  CmrCategory,
  ExposureRoute,
  GhsPictogram,
  PhysicalState,
  SubstanceQuantityClass,
  SubstanceSignalWord,
  SubstanceStatementKind,
} from "@/generated/prisma/enums";
import type { SubstanceModel } from "@/generated/prisma/models";
import { prisma } from "@/lib/prisma";

// P8 substance write gates (SLD_P8_GEFAHRSTOFFE_APPROVED.md). Person-free, so
// no AuditEvent requirement (unlike the people compartment). No `server-only`
// — the pages gate the caller; these own the invariants.

export async function createSubstance(input: {
  companyId: string;
  tradeName: string;
  manufacturer?: string | null;
  casNumber?: string | null;
  ecNumber?: string | null;
  physicalState: PhysicalState;
  signalWord: SubstanceSignalWord;
  carcinogenicCategory: CmrCategory;
  mutagenicCategory: CmrCategory;
  reprotoxicCategory: CmrCategory;
}): Promise<SubstanceModel> {
  return prisma.substance.create({
    data: {
      companyId: input.companyId,
      tradeName: input.tradeName.trim(),
      manufacturer: input.manufacturer?.trim() || null,
      casNumber: input.casNumber?.trim() || null,
      ecNumber: input.ecNumber?.trim() || null,
      physicalState: input.physicalState,
      signalWord: input.signalWord,
      carcinogenicCategory: input.carcinogenicCategory,
      mutagenicCategory: input.mutagenicCategory,
      reprotoxicCategory: input.reprotoxicCategory,
    },
  });
}

async function assertSubstanceInCompany(
  substanceId: string,
  companyId: string,
): Promise<void> {
  const s = await prisma.substance.findUnique({
    where: { id: substanceId },
    select: { companyId: true },
  });
  if (!s || s.companyId !== companyId) {
    throw new Error("Substance is not in this company");
  }
}

// Replace the pictogram set for a substance.
export async function setSubstancePictograms(
  substanceId: string,
  companyId: string,
  pictograms: GhsPictogram[],
): Promise<void> {
  await assertSubstanceInCompany(substanceId, companyId);
  await prisma.$transaction([
    prisma.substancePictogram.deleteMany({ where: { substanceId } }),
    prisma.substancePictogram.createMany({
      data: [...new Set(pictograms)].map((pictogram) => ({
        substanceId,
        pictogram,
      })),
    }),
  ]);
}

export async function addSubstanceStatement(input: {
  substanceId: string;
  companyId: string;
  kind: SubstanceStatementKind;
  code: string;
  text?: string | null;
}): Promise<void> {
  await assertSubstanceInCompany(input.substanceId, input.companyId);
  // The DB CHECK validates the code shape; surface a clean message first.
  await prisma.substanceStatement.create({
    data: {
      substanceId: input.substanceId,
      kind: input.kind,
      code: input.code.trim().toUpperCase(),
      text: input.text?.trim() || null,
    },
  });
}

export async function setSubstitutionCheck(input: {
  substanceId: string;
  companyId: string;
  done: boolean;
  note?: string | null;
}): Promise<void> {
  await assertSubstanceInCompany(input.substanceId, input.companyId);
  await prisma.substance.update({
    where: { id: input.substanceId },
    data: {
      substitutionCheckDone: input.done,
      substitutionCheckNote: input.note?.trim() || null,
      substitutionCheckedAt: input.done ? new Date() : null,
    },
  });
}

// Add an SDS version. Uploading a newer revision supersedes the substance's
// current (non-superseded) sheets (§3.5).
export async function addSdsVersion(input: {
  substanceId: string;
  companyId: string;
  version?: string | null;
  revisionDate: Date;
  language: string;
  supplier?: string | null;
  documentId?: string | null;
}): Promise<void> {
  await assertSubstanceInCompany(input.substanceId, input.companyId);
  await prisma.$transaction([
    prisma.safetyDataSheet.updateMany({
      where: { substanceId: input.substanceId, supersededAt: null },
      data: { supersededAt: new Date() },
    }),
    prisma.safetyDataSheet.create({
      data: {
        substanceId: input.substanceId,
        version: input.version?.trim() || null,
        revisionDate: input.revisionDate,
        language: input.language.trim(),
        supplier: input.supplier?.trim() || null,
        documentId: input.documentId ?? null,
      },
    }),
  ]);
}

export async function addSubstanceUse(input: {
  substanceId: string;
  companyId: string;
  siteId: string;
  workstationId?: string | null;
  processId?: string | null;
  orgUnitId?: string | null;
  purpose: string;
  quantityClass: SubstanceQuantityClass;
  storageLocation?: string | null;
  storageLocationId?: string | null;
  exposureRoutes: ExposureRoute[];
  activeFrom: Date;
}): Promise<void> {
  await assertSubstanceInCompany(input.substanceId, input.companyId);
  const subjects = [
    input.workstationId,
    input.processId,
    input.orgUnitId,
  ].filter(Boolean);
  if (subjects.length !== 1) {
    throw new Error("Exactly one of workstation, process or org unit");
  }
  await prisma.substanceUse.create({
    data: {
      substanceId: input.substanceId,
      siteId: input.siteId,
      workstationId: input.workstationId ?? null,
      processId: input.processId ?? null,
      orgUnitId: input.orgUnitId ?? null,
      purpose: input.purpose.trim(),
      quantityClass: input.quantityClass,
      storageLocation: input.storageLocation?.trim() || null,
      storageLocationId: input.storageLocationId ?? null,
      exposureRoutes: input.exposureRoutes,
      activeFrom: input.activeFrom,
    },
  });
}

export async function endSubstanceUse(
  useId: string,
  companyId: string,
): Promise<void> {
  const use = await prisma.substanceUse.findUnique({
    where: { id: useId },
    select: { substance: { select: { companyId: true } } },
  });
  if (!use || use.substance.companyId !== companyId) return;
  await prisma.substanceUse.update({
    where: { id: useId },
    data: { activeTo: new Date() },
  });
}
