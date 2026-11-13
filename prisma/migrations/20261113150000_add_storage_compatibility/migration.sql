-- P15 S5b (SLD_P15_GEFAHRSTOFFE_EXTENDED_APPROVED.md §2 S5): TRGS 510
-- Zusammenlagerung. Substance.lagerklasse (per product, from SDS section 15/7 or
-- manual entry) + a versioned official-import compatibility matrix. The per-
-- location check (src/lib/chemicals/storage-compatibility.ts) lists the
-- Lagerklassen present at a StorageLocation and flags disallowed/conditional
-- combinations with the TRGS 510 table reference. A SUGGESTED Lagerklasse from
-- the classification is NOT computed in Phase 1 (judgment). DE only — AT/CH sites
-- show "keine Zusammenlagerungsregel hinterlegt", fail-closed (§3.15). No matrix
-- data is seeded (the TRGS 510 table is a founder/official step; nothing from
-- recollection, §0.7/§7). Global tables, shared-read RLS (P13 §1). The enum type
-- is created and used only in this migration's own column (no CHECK/seed
-- referencing its values), so no enum-first split is needed.

CREATE TYPE "StorageCompatibilityResult" AS ENUM ('ALLOWED', 'NOT_ALLOWED', 'CONDITIONAL');

ALTER TABLE "Substance" ADD COLUMN "lagerklasse" TEXT;

CREATE TABLE "StorageCompatibilityCatalogVersion" (
    "version"              TEXT NOT NULL,
    "label"                TEXT NOT NULL,
    "isActive"             BOOLEAN NOT NULL DEFAULT false,
    "reconciliationPassed" BOOLEAN NOT NULL DEFAULT false,
    "importReport"         JSONB,
    "importedAt"           TIMESTAMP(3),
    "activatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StorageCompatibilityCatalogVersion_pkey" PRIMARY KEY ("version")
);
CREATE UNIQUE INDEX "StorageCompatibilityCatalogVersion_isActive_unique_when_true"
  ON "StorageCompatibilityCatalogVersion"("isActive") WHERE "isActive" = true;
ALTER TABLE "StorageCompatibilityCatalogVersion" ADD CONSTRAINT "StorageCompatibilityCatalogVersion_active_requires_reconciliation_check"
  CHECK ("isActive" = false OR "reconciliationPassed" = true);

CREATE TABLE "StorageCompatibilityRule" (
    "id"             TEXT NOT NULL,
    "catalogVersion" TEXT NOT NULL,
    "country"        TEXT NOT NULL DEFAULT 'DE',
    "lagerklasseA"   TEXT NOT NULL,
    "lagerklasseB"   TEXT NOT NULL,
    "result"         "StorageCompatibilityResult" NOT NULL,
    "conditionNote"  TEXT,
    "tableRef"       TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StorageCompatibilityRule_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StorageCompatibilityRule_version_country_pair_key"
  ON "StorageCompatibilityRule"("catalogVersion", "country", "lagerklasseA", "lagerklasseB");
CREATE INDEX "StorageCompatibilityRule_catalogVersion_country_idx" ON "StorageCompatibilityRule"("catalogVersion", "country");
ALTER TABLE "StorageCompatibilityRule" ADD CONSTRAINT "StorageCompatibilityRule_catalogVersion_fkey"
  FOREIGN KEY ("catalogVersion") REFERENCES "StorageCompatibilityCatalogVersion"("version") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StorageCompatibilityCatalogVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StorageCompatibilityRule" ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_rls ON "StorageCompatibilityCatalogVersion" FOR ALL TO statura_app USING (true) WITH CHECK (true);
CREATE POLICY app_rls ON "StorageCompatibilityRule" FOR ALL TO statura_app USING (true) WITH CHECK (true);
