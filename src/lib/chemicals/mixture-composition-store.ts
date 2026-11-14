import "server-only";

import { recordAuditEvent } from "@/lib/audit/audit-event";
import { prisma } from "@/lib/prisma";
import {
  type CompositionComponentInput,
  parseConcentration,
  validateComposition,
} from "./mixture-composition";
import type { ConfirmedSdsData } from "./sds-extraction-schema";

// P16 §3.1 server ops for mixture composition.

export async function getMixtureComponents(substanceId: string) {
  return prisma.mixtureComponent.findMany({
    where: { substanceId },
    orderBy: { createdAt: "asc" },
  });
}

async function assertSubstanceInCompany(
  substanceId: string,
  companyId: string,
): Promise<void> {
  const s = await prisma.substance.findFirst({
    where: { id: substanceId, companyId },
    select: { id: true },
  });
  if (!s) throw new Error("Substance not in company");
}

// (Re)fill the composition from the confirmed SDS section 3 (SdsComponent). An
// explicit action: replaces all components for the substance with the SDS-derived
// set (source SDS_SECTION_3); the editor then corrects. ATE per route is left
// null (the SDS gives one free-text ATE we don't split) — reported by readiness.
export async function autoFillFromSds(input: {
  substanceId: string;
  companyId: string;
  actorUserId: string;
}): Promise<number> {
  await assertSubstanceInCompany(input.substanceId, input.companyId);
  const sds = await prisma.safetyDataSheet.findFirst({
    where: { substanceId: input.substanceId, supersededAt: null },
    orderBy: { revisionDate: "desc" },
    select: { id: true, components: true },
  });
  const comps = sds?.components ?? [];
  await prisma.$transaction(async (tx) => {
    await tx.mixtureComponent.deleteMany({
      where: { substanceId: input.substanceId },
    });
    for (const c of comps) {
      const conc = parseConcentration(c.concentration);
      const ref = c.casNumber
        ? await tx.referenceSubstance.findUnique({
            where: { casNumber: c.casNumber.trim() },
            select: { id: true },
          })
        : null;
      const mFactor =
        c.mFactor && /^\d+(?:[.,]\d+)?$/.test(c.mFactor.trim())
          ? Number(c.mFactor.replace(",", "."))
          : null;
      await tx.mixtureComponent.create({
        data: {
          substanceId: input.substanceId,
          referenceSubstanceId: ref?.id ?? null,
          casNumber: c.casNumber?.trim() || null,
          name: c.name.trim(),
          concentrationExactPct: conc.exactPct,
          concentrationMinPct: conc.minPct,
          concentrationMaxPct: conc.maxPct,
          classification: c.classification?.trim() || null,
          specificConcentrationLimits:
            c.specificConcentrationLimits?.trim() || null,
          mFactor,
          source: "SDS_SECTION_3",
        },
      });
    }
  });
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "mixture_composition.autofill",
    entityType: "Substance",
    entityId: input.substanceId,
    companyId: input.companyId,
    diff: { components: comps.length },
  });
  return comps.length;
}

export type MixtureComponentEditInput = CompositionComponentInput & {
  classification?: string | null;
  mFactor?: number | null;
  ateOral?: number | null;
  ateDermal?: number | null;
  ateInhalation?: number | null;
  wgk?: number | null;
};

// Replace the composition from the editor (source MANUAL). Validated first.
export async function setMixtureComponents(input: {
  substanceId: string;
  companyId: string;
  actorUserId: string;
  components: MixtureComponentEditInput[];
}): Promise<void> {
  await assertSubstanceInCompany(input.substanceId, input.companyId);
  const { errors } = validateComposition(input.components);
  if (errors.length > 0) throw new Error(errors.join("; "));
  await prisma.$transaction(async (tx) => {
    await tx.mixtureComponent.deleteMany({
      where: { substanceId: input.substanceId },
    });
    for (const c of input.components) {
      if (!c.name?.trim()) continue;
      await tx.mixtureComponent.create({
        data: {
          substanceId: input.substanceId,
          casNumber: c.casNumber?.trim() || null,
          name: c.name.trim(),
          concentrationExactPct: c.concentrationExactPct ?? null,
          concentrationMinPct: c.concentrationMinPct ?? null,
          concentrationMaxPct: c.concentrationMaxPct ?? null,
          classification: c.classification?.trim() || null,
          mFactor: c.mFactor ?? null,
          ateOral: c.ateOral ?? null,
          ateDermal: c.ateDermal ?? null,
          ateInhalation: c.ateInhalation ?? null,
          wgk: c.wgk ?? null,
          source: "MANUAL",
        },
      });
    }
  });
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "mixture_composition.set",
    entityType: "Substance",
    entityId: input.substanceId,
    companyId: input.companyId,
    diff: { components: input.components.length },
  });
}

export type { ConfirmedSdsData };
