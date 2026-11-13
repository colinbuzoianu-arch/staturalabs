import "server-only";

import { prisma } from "@/lib/prisma";
import {
  type ClpStatementImportRow,
  type ReconciliationReport,
  reconcileClpStatements,
} from "./clp-import-reconciliation";

// P15 S1 / §1: the ONE write path for the CLP phrase catalogue. Data arrives
// only here, only after it reconciles, and always with provenance — never from
// model recollection (§0.7 / §7). The flow is deliberately two-step:
//
//   1. importClpStatements(): run the reconciliation gate, then persist the
//      version INACTIVE with its full import report, reconciliationPassed flag,
//      source URL/ATP reference and importedAt. A failing gate still persists
//      the version + report (so the failure is inspectable) but leaves
//      reconciliationPassed=false, which the DB CHECK uses to forbid activation.
//   2. activateClpCatalog(): flip isActive — guarded by reconciliationPassed at
//      both the app layer (here) and the DB (CHECK), super_admin-only at the
//      call site (ERGO §3.14). Deactivates any other active version in one tx.

export type ClpImportSource = {
  version: string;
  label: string;
  atpReference?: string | null;
  sourceUrl?: string | null;
  expectedRows?: number | null;
  priorExclusions?: { code: string; reason: string }[];
};

export async function importClpStatements(
  source: ClpImportSource,
  rows: ClpStatementImportRow[],
): Promise<ReconciliationReport> {
  const report = reconcileClpStatements(rows, {
    expectedRows: source.expectedRows ?? null,
    priorExclusions: source.priorExclusions,
  });

  await prisma.$transaction(async (tx) => {
    await tx.clpStatement.deleteMany({
      where: { catalogVersion: source.version },
    });
    await tx.clpCatalogVersion.upsert({
      where: { version: source.version },
      create: {
        version: source.version,
        label: source.label,
        atpReference: source.atpReference ?? null,
        sourceUrl: source.sourceUrl ?? null,
        isActive: false,
        reconciliationPassed: report.passed,
        importReport: report as unknown as object,
        importedAt: new Date(),
      },
      update: {
        label: source.label,
        atpReference: source.atpReference ?? null,
        sourceUrl: source.sourceUrl ?? null,
        // Re-importing resets activation: the version must re-reconcile and be
        // re-activated deliberately. isActive is left to activateClpCatalog.
        reconciliationPassed: report.passed,
        importReport: report as unknown as object,
        importedAt: new Date(),
      },
    });

    if (report.passed) {
      await tx.clpStatement.createMany({
        data: rows.map((r) => ({
          catalogVersion: source.version,
          kind: r.kind,
          code: r.code.trim().toUpperCase(),
          textEn: r.textEn.trim(),
          textDe: r.textDe.trim(),
          sourceRef: r.sourceRef.trim(),
        })),
      });
    }
  });

  return report;
}

export async function activateClpCatalog(version: string): Promise<void> {
  const row = await prisma.clpCatalogVersion.findUnique({
    where: { version },
    select: { reconciliationPassed: true },
  });
  if (!row) {
    throw new Error(`ClpCatalogVersion ${version} not found`);
  }
  if (!row.reconciliationPassed) {
    throw new Error(
      `ClpCatalogVersion ${version} has not passed reconciliation — cannot activate (§1)`,
    );
  }
  await prisma.$transaction([
    prisma.clpCatalogVersion.updateMany({
      where: { isActive: true, NOT: { version } },
      data: { isActive: false },
    }),
    prisma.clpCatalogVersion.update({
      where: { version },
      data: { isActive: true, activatedAt: new Date() },
    }),
  ]);
}
