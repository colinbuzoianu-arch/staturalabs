-- P15 S2b (SLD_P15_GEFAHRSTOFFE_EXTENDED_APPROVED.md §2 S2): confirmed SDS detail.
-- When a user accepts an SdsExtraction draft field by field (S2a), the confirmed
-- data is stored with method "sds-extraction" and the confirming user. This adds:
--   * SafetyDataSheet provenance + the confirmed scalar payload (sections 1/9/14/
--     15 kept as JSON for now; the ones their own slice consumes — S4 cited
--     limits, S5 WGK/Lagerklasse, S6 physical props — get promoted to columns in
--     that slice rather than speculated here).
--   * SdsComponent: the section-3 composition rows (relational, because S3's
--     harmonised-classification check and S4's per-component limits join them).
-- Person-free throughout (SDS are product documents). FKs Restrict (ERGO §3.9).

ALTER TABLE "SafetyDataSheet" ADD COLUMN "confirmedData"     JSONB;
ALTER TABLE "SafetyDataSheet" ADD COLUMN "sourceExtractionId" TEXT;
ALTER TABLE "SafetyDataSheet" ADD COLUMN "extractionMethod"   TEXT;
ALTER TABLE "SafetyDataSheet" ADD COLUMN "confirmedByUserId"  UUID;
CREATE INDEX "SafetyDataSheet_sourceExtractionId_idx" ON "SafetyDataSheet"("sourceExtractionId");
ALTER TABLE "SafetyDataSheet" ADD CONSTRAINT "SafetyDataSheet_sourceExtractionId_fkey"
  FOREIGN KEY ("sourceExtractionId") REFERENCES "SdsExtraction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "SdsComponent" (
    "id"                          TEXT NOT NULL,
    "safetyDataSheetId"           TEXT NOT NULL,
    "name"                        TEXT NOT NULL,
    "casNumber"                   TEXT,
    "ecNumber"                    TEXT,
    "concentration"               TEXT,
    "classification"              TEXT,
    "specificConcentrationLimits" TEXT,
    "mFactor"                     TEXT,
    "acuteToxicityEstimate"       TEXT,
    "createdAt"                   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SdsComponent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SdsComponent_safetyDataSheetId_idx" ON "SdsComponent"("safetyDataSheetId");
CREATE INDEX "SdsComponent_casNumber_idx" ON "SdsComponent"("casNumber");
ALTER TABLE "SdsComponent" ADD CONSTRAINT "SdsComponent_safetyDataSheetId_fkey"
  FOREIGN KEY ("safetyDataSheetId") REFERENCES "SafetyDataSheet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS: child of SafetyDataSheet (itself a Substance descendant). Same parent-
-- EXISTS form the P13 fixpoint generated for descendants; composes with the
-- parent's own policy transitively (P13 §1).
ALTER TABLE "SdsComponent" ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_rls ON "SdsComponent" FOR ALL TO statura_app
  USING (EXISTS (SELECT 1 FROM "SafetyDataSheet" p WHERE p.id = "SdsComponent"."safetyDataSheetId"))
  WITH CHECK (EXISTS (SELECT 1 FROM "SafetyDataSheet" p WHERE p.id = "SdsComponent"."safetyDataSheetId"));
