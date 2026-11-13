import "server-only";

import type {
  GhsPictogram,
  SubstanceSignalWord,
} from "@/generated/prisma/enums";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { prisma } from "@/lib/prisma";
import { inferStatementKind, isValidStatementCode } from "./clp-code-format";
import type { ConfirmedSdsData } from "./sds-extraction-schema";

// P15 S2b: confirm an SDS extraction draft. The user has reviewed and (possibly)
// edited the values; this persists them as the authoritative confirmed SDS data
// (method "sds-extraction", the confirming user recorded) in one transaction:
//   * supersede the current SDS, create the new SafetyDataSheet revision;
//   * create the section-3 SdsComponent rows;
//   * replace the substance's classification from the SDS (signal word,
//     pictograms, H/P/EUH statements) — the supplier's current classification is
//     authoritative. Malformed codes are skipped, never persisted (one validated
//     vocabulary with the CLP catalogue — clp-code-format).
// A newer revisionDate automatically makes existing Betriebsanweisungen show
// "Überprüfung erforderlich" (P8, via the revision-date comparison) — no extra
// write needed here.

const VALID_PICTOGRAMS = new Set<GhsPictogram>([
  "GHS01",
  "GHS02",
  "GHS03",
  "GHS04",
  "GHS05",
  "GHS06",
  "GHS07",
  "GHS08",
  "GHS09",
]);

function mapSignalWord(raw: string | null): SubstanceSignalWord | null {
  if (!raw) return null;
  const t = raw.trim().toLowerCase();
  if (t.includes("gefahr") || t === "danger") return "GEFAHR";
  if (t.includes("achtung") || t === "warning") return "ACHTUNG";
  if (t.includes("kein") || t === "none") return "NONE";
  return null;
}

export type ConfirmSdsResult = {
  safetyDataSheetId: string;
  componentCount: number;
  statementCount: number;
  pictogramCount: number;
};

export async function confirmSdsExtraction(input: {
  extractionId: string;
  companyId: string;
  substanceId: string;
  actorUserId: string;
  revisionDate: Date;
  confirmed: ConfirmedSdsData;
}): Promise<ConfirmSdsResult> {
  const extraction = await prisma.sdsExtraction.findFirst({
    where: { id: input.extractionId, companyId: input.companyId },
    select: { id: true, status: true },
  });
  if (!extraction) throw new Error("SdsExtraction not found in company");
  if (extraction.status !== "PENDING_REVIEW") {
    throw new Error(
      `SdsExtraction is ${extraction.status}, not PENDING_REVIEW`,
    );
  }
  const substance = await prisma.substance.findFirst({
    where: { id: input.substanceId, companyId: input.companyId },
    select: { id: true },
  });
  if (!substance) throw new Error("Substance not found in company");

  const c = input.confirmed;
  const signalWord = mapSignalWord(c.signalWord);
  const pictograms = [
    ...new Set(c.pictograms.map((p) => p.trim().toUpperCase())),
  ].filter((p): p is GhsPictogram => VALID_PICTOGRAMS.has(p as GhsPictogram));
  const statements = c.statementCodes
    .map((code) => code.trim().toUpperCase())
    .map((code) => ({ code, kind: inferStatementKind(code) }))
    .filter(
      (s): s is { code: string; kind: NonNullable<typeof s.kind> } =>
        s.kind !== null,
    )
    .filter((s) => isValidStatementCode(s.kind, s.code));

  const result = await prisma.$transaction(async (tx) => {
    await tx.safetyDataSheet.updateMany({
      where: { substanceId: input.substanceId, supersededAt: null },
      data: { supersededAt: new Date() },
    });
    const sds = await tx.safetyDataSheet.create({
      data: {
        substanceId: input.substanceId,
        version: c.version?.trim() || null,
        revisionDate: input.revisionDate,
        language: (c.language?.trim() || "de").toLowerCase(),
        supplier: c.supplier?.trim() || null,
        confirmedData: c as unknown as object,
        sourceExtractionId: input.extractionId,
        extractionMethod: "sds-extraction",
        confirmedByUserId: input.actorUserId,
      },
      select: { id: true },
    });

    if (c.components.length > 0) {
      await tx.sdsComponent.createMany({
        data: c.components
          .filter((comp) => (comp.name ?? "").trim().length > 0)
          .map((comp) => ({
            safetyDataSheetId: sds.id,
            name: (comp.name ?? "").trim(),
            casNumber: comp.casNumber?.trim() || null,
            ecNumber: comp.ecNumber?.trim() || null,
            concentration: comp.concentration?.trim() || null,
            classification: comp.classification?.trim() || null,
            specificConcentrationLimits:
              comp.specificConcentrationLimits?.trim() || null,
            mFactor: comp.mFactor?.trim() || null,
            acuteToxicityEstimate: comp.acuteToxicityEstimate?.trim() || null,
          })),
      });
    }

    // Replace the substance's classification from the SDS, and set the
    // Lagerklasse (TRGS 510, S5b) from section 15 when the SDS states one.
    const substanceUpdate: {
      signalWord?: SubstanceSignalWord;
      lagerklasse?: string;
    } = {};
    if (signalWord) substanceUpdate.signalWord = signalWord;
    if (c.lagerklasse?.trim())
      substanceUpdate.lagerklasse = c.lagerklasse.trim();
    if (Object.keys(substanceUpdate).length > 0) {
      await tx.substance.update({
        where: { id: input.substanceId },
        data: substanceUpdate,
      });
    }
    await tx.substancePictogram.deleteMany({
      where: { substanceId: input.substanceId },
    });
    if (pictograms.length > 0) {
      await tx.substancePictogram.createMany({
        data: pictograms.map((pictogram) => ({
          substanceId: input.substanceId,
          pictogram,
        })),
      });
    }
    await tx.substanceStatement.deleteMany({
      where: { substanceId: input.substanceId },
    });
    if (statements.length > 0) {
      await tx.substanceStatement.createMany({
        data: statements.map((s) => ({
          substanceId: input.substanceId,
          kind: s.kind,
          code: s.code,
        })),
      });
    }

    await tx.sdsExtraction.update({
      where: { id: input.extractionId },
      data: {
        status: "CONFIRMED",
        confirmedByUserId: input.actorUserId,
        confirmedAt: new Date(),
        substanceId: input.substanceId,
      },
    });

    return {
      safetyDataSheetId: sds.id,
      componentCount: c.components.filter(
        (comp) => (comp.name ?? "").trim().length > 0,
      ).length,
      statementCount: statements.length,
      pictogramCount: pictograms.length,
    };
  });

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "sds_extraction.confirm",
    entityType: "SdsExtraction",
    entityId: input.extractionId,
    companyId: input.companyId,
    diff: {
      substanceId: input.substanceId,
      safetyDataSheetId: result.safetyDataSheetId,
      components: result.componentCount,
      statements: result.statementCount,
    },
  });

  return result;
}

// Load the previous current SDS's confirmed payload for the revision diff.
export async function getPreviousConfirmedSds(
  substanceId: string,
  companyId: string,
): Promise<ConfirmedSdsData | null> {
  const substance = await prisma.substance.findFirst({
    where: { id: substanceId, companyId },
    select: { id: true },
  });
  if (!substance) return null;
  const sds = await prisma.safetyDataSheet.findFirst({
    where: { substanceId, supersededAt: null },
    orderBy: { revisionDate: "desc" },
    select: { confirmedData: true },
  });
  return (sds?.confirmedData as ConfirmedSdsData | null) ?? null;
}
