import "server-only";

import type { CountryCode } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import {
  type ExposureLimitReconciliationReport,
  jurisdictionForCountry,
  reconcileSubstanceExposureLimits,
  type SubstanceExposureLimitImportRow,
} from "./substance-exposure-limit-reconciliation";

// P15 S4: resolve + look up occupational exposure limits. Returns null when no
// catalogue is active yet (display degrades to an honest "no limit loaded"
// gap) — the fail-closed contract is on ACTIVATION instead
// (isActive ⇒ reconciliationPassed). NEVER falls back across jurisdictions
// (ERGO §3.15): a site's country gets its own jurisdiction's rows; EU rows are
// returned separately as supplementary, never merged into a national number.

export async function getActiveSubstanceExposureLimitCatalog(): Promise<
  string | null
> {
  const active = await prisma.substanceExposureLimitCatalogVersion.findFirst({
    where: { isActive: true },
    select: { version: true },
  });
  return active?.version ?? null;
}

export type ExposureLimitRow = {
  jurisdiction: string;
  substanceName: string;
  limitType: string;
  value: number | null;
  unit: string | null;
  averagingPeriod: string | null;
  excursionFactor: number | null;
  notations: string[];
  binding: boolean | null;
  sourceName: string;
  sourceUrl: string | null;
  sourceStand: string | null;
};

async function lookupByJurisdiction(
  version: string,
  jurisdiction: string,
  casNumber: string | null,
  ecNumber: string | null,
): Promise<ExposureLimitRow[]> {
  const idMatch: { casNumber?: string; ecNumber?: string }[] = [];
  if (casNumber) idMatch.push({ casNumber });
  if (ecNumber) idMatch.push({ ecNumber });
  if (idMatch.length === 0) return [];
  const rows = await prisma.substanceExposureLimit.findMany({
    where: { catalogVersion: version, jurisdiction, OR: idMatch },
    orderBy: [{ limitType: "asc" }, { averagingPeriod: "asc" }],
    select: {
      jurisdiction: true,
      substanceName: true,
      limitType: true,
      value: true,
      unit: true,
      averagingPeriod: true,
      excursionFactor: true,
      notations: true,
      binding: true,
      sourceName: true,
      sourceUrl: true,
      sourceStand: true,
    },
  });
  return rows;
}

// National (site-country) limits first, EU supplementary — never merged. Returns
// empty arrays (not a throw) when there is no active catalogue or no row.
export async function lookupExposureLimitsForCountry(input: {
  country: CountryCode;
  casNumber: string | null;
  ecNumber: string | null;
}): Promise<{
  jurisdiction: string | null;
  national: ExposureLimitRow[];
  eu: ExposureLimitRow[];
}> {
  const version = await getActiveSubstanceExposureLimitCatalog();
  const jurisdiction = jurisdictionForCountry(input.country);
  if (!version) return { jurisdiction, national: [], eu: [] };
  const national = jurisdiction
    ? await lookupByJurisdiction(
        version,
        jurisdiction,
        input.casNumber,
        input.ecNumber,
      )
    : [];
  const eu = await lookupByJurisdiction(
    version,
    "EU",
    input.casNumber,
    input.ecNumber,
  );
  return { jurisdiction, national, eu };
}

// --- Import (the one write path, §1) ---
export type ExposureLimitImportSource = {
  version: string;
  label: string;
  expectedRows?: number | null;
};

export async function importSubstanceExposureLimits(
  source: ExposureLimitImportSource,
  rows: (SubstanceExposureLimitImportRow & {
    excursionFactor?: number | null;
    notations?: string[];
    binding?: boolean | null;
    sourceUrl?: string | null;
    sourceStand?: string | null;
    rowRef?: string | null;
    notes?: string | null;
  })[],
): Promise<ExposureLimitReconciliationReport> {
  const report = reconcileSubstanceExposureLimits(rows, {
    expectedRows: source.expectedRows ?? null,
  });

  await prisma.$transaction(async (tx) => {
    await tx.substanceExposureLimit.deleteMany({
      where: { catalogVersion: source.version },
    });
    await tx.substanceExposureLimitCatalogVersion.upsert({
      where: { version: source.version },
      create: {
        version: source.version,
        label: source.label,
        isActive: false,
        reconciliationPassed: report.passed,
        importReport: report as unknown as object,
        importedAt: new Date(),
      },
      update: {
        label: source.label,
        reconciliationPassed: report.passed,
        importReport: report as unknown as object,
        importedAt: new Date(),
      },
    });
    if (report.passed) {
      await tx.substanceExposureLimit.createMany({
        data: rows.map((r) => ({
          catalogVersion: source.version,
          jurisdiction: r.jurisdiction.trim(),
          casNumber: r.casNumber?.trim() || null,
          ecNumber: r.ecNumber?.trim() || null,
          substanceName: r.substanceName.trim(),
          limitType: r.limitType.trim(),
          value: r.value ?? null,
          unit: r.unit?.trim() || null,
          averagingPeriod: r.averagingPeriod?.trim() || null,
          excursionFactor: r.excursionFactor ?? null,
          notations: r.notations ?? [],
          binding: r.binding ?? null,
          sourceName: r.sourceName.trim(),
          sourceUrl: r.sourceUrl?.trim() || null,
          sourceStand: r.sourceStand?.trim() || null,
          rowRef: r.rowRef?.trim() || null,
          notes: r.notes?.trim() || null,
        })),
      });
    }
  });

  return report;
}

export async function activateSubstanceExposureLimitCatalog(
  version: string,
): Promise<void> {
  const row = await prisma.substanceExposureLimitCatalogVersion.findUnique({
    where: { version },
    select: { reconciliationPassed: true },
  });
  if (!row)
    throw new Error(
      `SubstanceExposureLimitCatalogVersion ${version} not found`,
    );
  if (!row.reconciliationPassed) {
    throw new Error(
      `Version ${version} has not passed reconciliation — cannot activate (§1)`,
    );
  }
  await prisma.$transaction([
    prisma.substanceExposureLimitCatalogVersion.updateMany({
      where: { isActive: true, NOT: { version } },
      data: { isActive: false },
    }),
    prisma.substanceExposureLimitCatalogVersion.update({
      where: { version },
      data: { isActive: true, activatedAt: new Date() },
    }),
  ]);
}
