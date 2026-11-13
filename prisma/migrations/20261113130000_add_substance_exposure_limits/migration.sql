-- P15 S4 (SLD_P15_GEFAHRSTOFFE_EXTENDED_APPROVED.md §2 S4): occupational exposure
-- limits (DACH + EU), SEPARATE from the noise/vibration ExposureLimit. A global
-- official-import catalogue (verificationMethod = "official-import"): AT GKV
-- Anhang I (MAK/TRK), DE TRGS 900 (AGW)/TRGS 910, EU OEL directives (IOELV/
-- BOELV), CH Suva (hidden until CH verified). Per-row provenance (source name +
-- URL + Stand + row reference). `jurisdiction` and `limitType` are TEXT, not
-- enums, deliberately: §4.5 wants the model to accept ANY jurisdiction later
-- (e.g. licensed GESTIS international data) with no schema change. The lookup
-- NEVER falls back across jurisdictions (ERGO §3.15) — a missing value is an
-- honest gap, never another country's number. value/unit nullable: some rows are
-- reference-only (the law requires evaluation but the SDS/substance-specific
-- value is entered manually). A version is activated only after reconciliation
-- (isActive ⇒ reconciliationPassed, same as ClpCatalogVersion). No data is
-- seeded here — the official files are a reachable-source / founder step; nothing
-- from recollection (§0.7/§7). Global tables: shared-read RLS (P13 §1).

CREATE TABLE "SubstanceExposureLimitCatalogVersion" (
    "version"              TEXT NOT NULL,
    "label"                TEXT NOT NULL,
    "isActive"             BOOLEAN NOT NULL DEFAULT false,
    "reconciliationPassed" BOOLEAN NOT NULL DEFAULT false,
    "importReport"         JSONB,
    "importedAt"           TIMESTAMP(3),
    "activatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubstanceExposureLimitCatalogVersion_pkey" PRIMARY KEY ("version")
);
CREATE UNIQUE INDEX "SubstanceExposureLimitCatalogVersion_isActive_unique_when_true"
  ON "SubstanceExposureLimitCatalogVersion"("isActive") WHERE "isActive" = true;
ALTER TABLE "SubstanceExposureLimitCatalogVersion" ADD CONSTRAINT "SubstanceExposureLimitCatalogVersion_active_requires_reconciliation_check"
  CHECK ("isActive" = false OR "reconciliationPassed" = true);

CREATE TABLE "SubstanceExposureLimit" (
    "id"              TEXT NOT NULL,
    "catalogVersion"  TEXT NOT NULL,
    "jurisdiction"    TEXT NOT NULL,
    "casNumber"       TEXT,
    "ecNumber"        TEXT,
    "substanceName"   TEXT NOT NULL,
    "limitType"       TEXT NOT NULL,
    "value"           DOUBLE PRECISION,
    "unit"            TEXT,
    "averagingPeriod" TEXT,
    "excursionFactor" DOUBLE PRECISION,
    "notations"       TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "binding"         BOOLEAN,
    "sourceName"      TEXT NOT NULL,
    "sourceUrl"       TEXT,
    "sourceStand"     TEXT,
    "rowRef"          TEXT,
    "notes"           TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubstanceExposureLimit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SubstanceExposureLimit_catalogVersion_jurisdiction_idx" ON "SubstanceExposureLimit"("catalogVersion", "jurisdiction");
CREATE INDEX "SubstanceExposureLimit_catalogVersion_casNumber_idx" ON "SubstanceExposureLimit"("catalogVersion", "casNumber");
CREATE INDEX "SubstanceExposureLimit_catalogVersion_ecNumber_idx" ON "SubstanceExposureLimit"("catalogVersion", "ecNumber");
ALTER TABLE "SubstanceExposureLimit" ADD CONSTRAINT "SubstanceExposureLimit_catalogVersion_fkey"
  FOREIGN KEY ("catalogVersion") REFERENCES "SubstanceExposureLimitCatalogVersion"("version") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SubstanceExposureLimitCatalogVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SubstanceExposureLimit" ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_rls ON "SubstanceExposureLimitCatalogVersion" FOR ALL TO statura_app USING (true) WITH CHECK (true);
CREATE POLICY app_rls ON "SubstanceExposureLimit" FOR ALL TO statura_app USING (true) WITH CHECK (true);
