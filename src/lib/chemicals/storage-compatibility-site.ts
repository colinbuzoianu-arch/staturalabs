import "server-only";

import type {
  CountryCode,
  StorageCompatibilityResult,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import {
  checkZusammenlagerung,
  type StorageCompatibilityRuleLite,
  type ZusammenlagerungFlag,
} from "./storage-compatibility";

// P15 S5b: resolve the TRGS 510 matrix and build the per-storage-location
// overview. DE only has a matrix; AT/CH return hasMatrix=false (honest gap,
// fail-closed §3.15) — never another country's rules.

export async function getActiveStorageCompatibilityCatalog(): Promise<
  string | null
> {
  const active = await prisma.storageCompatibilityCatalogVersion.findFirst({
    where: { isActive: true },
    select: { version: true },
  });
  return active?.version ?? null;
}

function matrixCountryFor(country: CountryCode): string | null {
  // Only DE has a stored Zusammenlagerungs-scheme (TRGS 510). No fallback.
  return country === "DE" ? "DE" : null;
}

async function lookupStorageRules(
  country: CountryCode,
): Promise<StorageCompatibilityRuleLite[]> {
  const matrixCountry = matrixCountryFor(country);
  if (!matrixCountry) return [];
  const version = await getActiveStorageCompatibilityCatalog();
  if (!version) return [];
  const rows = await prisma.storageCompatibilityRule.findMany({
    where: { catalogVersion: version, country: matrixCountry },
    select: {
      lagerklasseA: true,
      lagerklasseB: true,
      result: true,
      conditionNote: true,
      tableRef: true,
    },
  });
  return rows;
}

export type StorageLocationOverview = {
  locationId: string;
  name: string;
  lagerklassen: string[];
  flags: ZusammenlagerungFlag[];
  hasMatrix: boolean;
};

// Group active substance uses by storage location, collect the distinct
// Lagerklassen present (from Substance.lagerklasse), run the check.
export async function getSiteStorageOverview(
  siteId: string,
  country: CountryCode,
): Promise<StorageLocationOverview[]> {
  const rules = await lookupStorageRules(country);
  const locations = await prisma.storageLocation.findMany({
    where: { siteId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      uses: {
        where: { activeTo: null },
        select: { substance: { select: { lagerklasse: true } } },
      },
    },
  });
  return locations.map((loc) => {
    const lagerklassen = [
      ...new Set(
        loc.uses
          .map((u) => u.substance.lagerklasse?.trim())
          .filter((l): l is string => Boolean(l)),
      ),
    ];
    const { flags, hasMatrix } = checkZusammenlagerung(lagerklassen, rules);
    return {
      locationId: loc.id,
      name: loc.name,
      lagerklassen,
      flags,
      hasMatrix,
    };
  });
}

// --- Import (official-import, §1). Minimal reconcile: valid result, non-empty
// classes, no duplicate (country+A+B) pair. No data seeded from recollection. ---
export type StorageCompatibilityImportRow = {
  country: string;
  lagerklasseA: string;
  lagerklasseB: string;
  result: StorageCompatibilityResult;
  conditionNote?: string | null;
  tableRef?: string | null;
};

export async function importStorageCompatibility(
  source: { version: string; label: string },
  rows: StorageCompatibilityImportRow[],
): Promise<{ passed: boolean; errors: string[]; accepted: number }> {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const key = [r.country, r.lagerklasseA, r.lagerklasseB]
      .join("|")
      .toUpperCase();
    if (seen.has(key)) errors.push(`duplicate ${key}`);
    seen.add(key);
    if (!r.lagerklasseA.trim() || !r.lagerklasseB.trim())
      errors.push(`empty class in ${key}`);
    if (!["ALLOWED", "NOT_ALLOWED", "CONDITIONAL"].includes(r.result))
      errors.push(`bad result ${key}`);
  }
  const passed = errors.length === 0;
  await prisma.$transaction(async (tx) => {
    await tx.storageCompatibilityRule.deleteMany({
      where: { catalogVersion: source.version },
    });
    await tx.storageCompatibilityCatalogVersion.upsert({
      where: { version: source.version },
      create: {
        version: source.version,
        label: source.label,
        reconciliationPassed: passed,
        importReport: { errors } as object,
        importedAt: new Date(),
      },
      update: {
        label: source.label,
        reconciliationPassed: passed,
        importReport: { errors } as object,
        importedAt: new Date(),
      },
    });
    if (passed) {
      await tx.storageCompatibilityRule.createMany({
        data: rows.map((r) => ({
          catalogVersion: source.version,
          country: r.country.trim(),
          lagerklasseA: r.lagerklasseA.trim(),
          lagerklasseB: r.lagerklasseB.trim(),
          result: r.result,
          conditionNote: r.conditionNote?.trim() || null,
          tableRef: r.tableRef?.trim() || null,
        })),
      });
    }
  });
  return { passed, errors, accepted: passed ? rows.length : 0 };
}

export async function activateStorageCompatibilityCatalog(
  version: string,
): Promise<void> {
  const row = await prisma.storageCompatibilityCatalogVersion.findUnique({
    where: { version },
    select: { reconciliationPassed: true },
  });
  if (!row)
    throw new Error(`StorageCompatibilityCatalogVersion ${version} not found`);
  if (!row.reconciliationPassed)
    throw new Error(
      `Version ${version} has not passed reconciliation — cannot activate (§1)`,
    );
  await prisma.$transaction([
    prisma.storageCompatibilityCatalogVersion.updateMany({
      where: { isActive: true, NOT: { version } },
      data: { isActive: false },
    }),
    prisma.storageCompatibilityCatalogVersion.update({
      where: { version },
      data: { isActive: true, activatedAt: new Date() },
    }),
  ]);
}
