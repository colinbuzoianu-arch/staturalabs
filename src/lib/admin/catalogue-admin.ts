import "server-only";

import { recordAuditEvent } from "@/lib/audit/audit-event";
import { prisma } from "@/lib/prisma";

// P13 §2.3: super-admin catalogue version control. One place to see and
// activate the single-active-version catalogues, each keeping its fail-closed
// contract (ERGO §3.14): activation is super-admin-only, never leaves zero
// active (deactivate + activate in one transaction), and is the ONLY write here
// — authoring/seeding stays in migrations. Table/column names come from this
// whitelisted config (never user input), so the raw SQL is safe.

export type CatalogueConfig = {
  key: string;
  versionTable: string;
  childTable: string;
  childFk: string;
  hasLabel: boolean;
  provenance: boolean; // child rows carry verifiedBy/verifiedAt
};

export const CATALOGUES: readonly CatalogueConfig[] = [
  {
    key: "methodology",
    versionTable: "MethodologyVersion",
    childTable: "ScoringRule",
    childFk: "methodologyVersion",
    hasLabel: false,
    provenance: false,
  },
  {
    key: "risk-matrix",
    versionTable: "RiskMatrixVersion",
    childTable: "RiskMatrixCell",
    childFk: "matrixVersion",
    hasLabel: true,
    provenance: false,
  },
  {
    key: "exposure-limit",
    versionTable: "ExposureLimitCatalogVersion",
    childTable: "ExposureLimit",
    childFk: "catalogVersion",
    hasLabel: true,
    provenance: false,
  },
  {
    key: "legal-reference",
    versionTable: "LegalReferenceCatalogVersion",
    childTable: "LegalReference",
    childFk: "catalogVersion",
    hasLabel: true,
    provenance: true,
  },
  {
    key: "typical-measure",
    versionTable: "TypicalMeasureCatalogVersion",
    childTable: "TypicalMeasure",
    childFk: "catalogVersion",
    hasLabel: true,
    provenance: false,
  },
  {
    key: "retention",
    versionTable: "RetentionRuleCatalogVersion",
    childTable: "RetentionRule",
    childFk: "catalogVersion",
    hasLabel: true,
    provenance: true,
  },
  {
    key: "incident-notification",
    versionTable: "IncidentNotificationCatalogVersion",
    childTable: "IncidentNotificationRule",
    childFk: "catalogVersion",
    hasLabel: true,
    provenance: true,
  },
  {
    key: "legal-requirement",
    versionTable: "LegalRequirementCatalogVersion",
    childTable: "LegalRequirement",
    childFk: "catalogVersion",
    hasLabel: true,
    provenance: false,
  },
  {
    key: "kpi",
    versionTable: "KpiCatalogVersion",
    childTable: "KpiDefinition",
    childFk: "catalogVersion",
    hasLabel: true,
    provenance: false,
  },
];

export type CatalogueVersionRow = {
  version: string;
  label: string | null;
  isActive: boolean;
  activatedAt: Date;
  rowCount: number;
  verifiedBy: string | null;
  verifiedAt: Date | null;
};

function configFor(key: string): CatalogueConfig {
  const c = CATALOGUES.find((x) => x.key === key);
  if (!c) throw new Error(`Unknown catalogue ${key}`);
  return c;
}

export async function listCatalogueVersions(
  key: string,
): Promise<CatalogueVersionRow[]> {
  const c = configFor(key);
  const labelSel = c.hasLabel ? '"label"' : 'NULL::text AS "label"';
  const versions = (await prisma.$queryRawUnsafe(
    `SELECT "version", ${labelSel}, "isActive", "activatedAt" FROM "${c.versionTable}" ORDER BY "activatedAt" DESC`,
  )) as {
    version: string;
    label: string | null;
    isActive: boolean;
    activatedAt: Date;
  }[];

  const out: CatalogueVersionRow[] = [];
  for (const v of versions) {
    const countRows = (await prisma.$queryRawUnsafe(
      `SELECT count(*)::int AS n FROM "${c.childTable}" WHERE "${c.childFk}" = $1`,
      v.version,
    )) as { n: number }[];
    let verifiedBy: string | null = null;
    let verifiedAt: Date | null = null;
    if (c.provenance) {
      const prov = (await prisma.$queryRawUnsafe(
        `SELECT "verifiedBy", "verifiedAt" FROM "${c.childTable}" WHERE "${c.childFk}" = $1 AND "verifiedAt" IS NOT NULL ORDER BY "verifiedAt" DESC LIMIT 1`,
        v.version,
      )) as { verifiedBy: string | null; verifiedAt: Date | null }[];
      verifiedBy = prov[0]?.verifiedBy ?? null;
      verifiedAt = prov[0]?.verifiedAt ?? null;
    }
    out.push({
      version: v.version,
      label: v.label,
      isActive: v.isActive,
      activatedAt: v.activatedAt,
      rowCount: countRows[0]?.n ?? 0,
      verifiedBy,
      verifiedAt,
    });
  }
  return out;
}

// Activate a version: deactivate the current active and activate the target in
// one transaction (never zero active). Verifies the target exists first.
export async function activateCatalogueVersion(input: {
  key: string;
  version: string;
  actorUserId: string;
}): Promise<void> {
  const c = configFor(input.key);
  await prisma.$transaction(async (tx) => {
    const exists = (await tx.$queryRawUnsafe(
      `SELECT 1 FROM "${c.versionTable}" WHERE "version" = $1`,
      input.version,
    )) as unknown[];
    if (exists.length === 0) {
      throw new Error(
        `Version ${input.version} not found in ${c.versionTable}`,
      );
    }
    await tx.$executeRawUnsafe(
      `UPDATE "${c.versionTable}" SET "isActive" = false WHERE "isActive" = true`,
    );
    await tx.$executeRawUnsafe(
      `UPDATE "${c.versionTable}" SET "isActive" = true WHERE "version" = $1`,
      input.version,
    );
  });
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "catalogue.activate",
    entityType: c.versionTable,
    entityId: input.version,
    diff: { catalogue: c.key, version: input.version },
  });
}
