-- P15 S1 (SLD_P15_GEFAHRSTOFFE_EXTENDED_APPROVED.md §2 S1): CLP reference data,
-- imported from official sources only (verificationMethod = "official-import",
-- §1). Four global/system catalogues, versioned per CLP ATP:
--   * ClpStatement             — the H/P/EUH phrase catalogue (CLP Annex III/IV),
--                                official DE + EN wording.
--   * ClpLabelElementRule      — hazard class/category -> pictogram + signal word
--                                (CLP Annex I/V), stored as data, not hard-coded.
--   * ClpHarmonisedClassification — CLP Annex VI Table 3 harmonised entries.
--
-- A catalogue version is created INACTIVE and may be activated ONLY after the
-- automated reconciliation gate passes (§1: row counts vs. source, zero parse
-- errors, CAS checksum, unit whitelist, no duplicate keys; PDF-only sources need
-- two agreeing extraction passes). The importer (src/lib/chemicals/clp-import.ts)
-- is the ONLY write path — no row is ever seeded from model recollection
-- (§0.7 / §7). Lookups degrade to code-format validation while no active
-- catalogue exists (S1: "keep the format validation for codes not yet in the
-- catalogue"), so an empty catalogue is a legitimate state, not a fault.
--
-- All four are global reference tables (no companyId): RLS enabled with the
-- shared-read policy (FOR ALL TO statura_app USING(true)) — same contract as
-- ExposureLimit / LegalReference / ScoringRule (P13 §1). Activation stays
-- super_admin-only at the app layer (ERGO §3.14). FKs Restrict (ERGO §3.9).
-- All referenced enums (SubstanceStatementKind, GhsPictogram,
-- SubstanceSignalWord) pre-exist (P8), so no enum-first split is needed.

CREATE TABLE "ClpCatalogVersion" (
    "version"              TEXT NOT NULL,
    "label"                TEXT NOT NULL,
    "atpReference"         TEXT,
    "sourceUrl"            TEXT,
    "isActive"             BOOLEAN NOT NULL DEFAULT false,
    "reconciliationPassed" BOOLEAN NOT NULL DEFAULT false,
    "importReport"         JSONB,
    "importedAt"           TIMESTAMP(3),
    "activatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClpCatalogVersion_pkey" PRIMARY KEY ("version")
);
-- At most one active catalogue version (fail-closed single-active contract,
-- same as MethodologyVersion / ExposureLimitCatalogVersion). Prisma can't
-- express a partial unique index, so it is hand-added here.
CREATE UNIQUE INDEX "ClpCatalogVersion_isActive_unique_when_true"
  ON "ClpCatalogVersion"("isActive") WHERE "isActive" = true;
-- A version may be active only once reconciliation has passed (§1).
ALTER TABLE "ClpCatalogVersion" ADD CONSTRAINT "ClpCatalogVersion_active_requires_reconciliation_check"
  CHECK ("isActive" = false OR "reconciliationPassed" = true);

CREATE TABLE "ClpStatement" (
    "id"             TEXT NOT NULL,
    "catalogVersion" TEXT NOT NULL,
    "kind"           "SubstanceStatementKind" NOT NULL,
    "code"           TEXT NOT NULL,
    "textEn"         TEXT NOT NULL,
    "textDe"         TEXT NOT NULL,
    "sourceRef"      TEXT NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClpStatement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ClpStatement_catalogVersion_code_key" ON "ClpStatement"("catalogVersion", "code");
CREATE INDEX "ClpStatement_catalogVersion_kind_idx" ON "ClpStatement"("catalogVersion", "kind");
-- Same code-shape CHECK as SubstanceStatement (P8) so the catalogue and the
-- per-substance statements speak one validated vocabulary.
ALTER TABLE "ClpStatement" ADD CONSTRAINT "ClpStatement_code_shape_check" CHECK (
  ("kind" = 'H' AND "code" ~ '^H[2-4][0-9]{2}[A-Za-z]{0,3}$')
  OR ("kind" = 'EUH' AND "code" ~ '^EUH[0-9]{3}[A-Za-z]?$')
  OR ("kind" = 'P' AND "code" ~ '^P[1-5][0-9]{2}(\+P[1-5][0-9]{2})*$')
);
ALTER TABLE "ClpStatement" ADD CONSTRAINT "ClpStatement_catalogVersion_fkey"
  FOREIGN KEY ("catalogVersion") REFERENCES "ClpCatalogVersion"("version") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ClpLabelElementRule" (
    "id"                  TEXT NOT NULL,
    "catalogVersion"      TEXT NOT NULL,
    "hazardClass"         TEXT NOT NULL,
    "hazardCategory"      TEXT NOT NULL,
    "pictogram"           "GhsPictogram",
    "signalWord"          "SubstanceSignalWord",
    "hazardStatementCode" TEXT,
    "sourceRef"           TEXT NOT NULL,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClpLabelElementRule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ClpLabelElementRule_catalogVersion_idx" ON "ClpLabelElementRule"("catalogVersion");
ALTER TABLE "ClpLabelElementRule" ADD CONSTRAINT "ClpLabelElementRule_catalogVersion_fkey"
  FOREIGN KEY ("catalogVersion") REFERENCES "ClpCatalogVersion"("version") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ClpHarmonisedClassification" (
    "id"             TEXT NOT NULL,
    "catalogVersion" TEXT NOT NULL,
    "indexNumber"    TEXT NOT NULL,
    "name"           TEXT NOT NULL,
    "casNumber"      TEXT,
    "ecNumber"       TEXT,
    "classification" JSONB NOT NULL,
    "sourceRef"      TEXT NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClpHarmonisedClassification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ClpHarmonisedClassification_catalogVersion_casNumber_idx" ON "ClpHarmonisedClassification"("catalogVersion", "casNumber");
CREATE INDEX "ClpHarmonisedClassification_catalogVersion_ecNumber_idx" ON "ClpHarmonisedClassification"("catalogVersion", "ecNumber");
ALTER TABLE "ClpHarmonisedClassification" ADD CONSTRAINT "ClpHarmonisedClassification_catalogVersion_fkey"
  FOREIGN KEY ("catalogVersion") REFERENCES "ClpCatalogVersion"("version") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS: global reference tables, shared-read (P13 §1 global_tables contract).
ALTER TABLE "ClpCatalogVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ClpStatement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ClpLabelElementRule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ClpHarmonisedClassification" ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_rls ON "ClpCatalogVersion" FOR ALL TO statura_app USING (true) WITH CHECK (true);
CREATE POLICY app_rls ON "ClpStatement" FOR ALL TO statura_app USING (true) WITH CHECK (true);
CREATE POLICY app_rls ON "ClpLabelElementRule" FOR ALL TO statura_app USING (true) WITH CHECK (true);
CREATE POLICY app_rls ON "ClpHarmonisedClassification" FOR ALL TO statura_app USING (true) WITH CHECK (true);
