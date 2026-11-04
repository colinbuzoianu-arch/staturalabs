-- P7d §C: retention catalogue + company settings + Person legal-hold columns +
-- the founder-approved seed (catalogue v1-2026-11 + platform-default company
-- policy). No statutory rows (none exist for instruction records in AT/DE);
-- the rows are NO_STATUTORY_PERIOD with the §14 ASchG / §12 ArbSchG proof
-- basis. RLS on new tables. Hand-added CHECK: STATUTORY rows need a period +
-- source.

-- Person legal-hold columns
ALTER TABLE "Person"
  ADD COLUMN "legalHold" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "legalHoldReason" TEXT,
  ADD COLUMN "legalHoldSetByUserId" UUID;

-- CreateTable: RetentionRuleCatalogVersion
CREATE TABLE "RetentionRuleCatalogVersion" (
    "version" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RetentionRuleCatalogVersion_pkey" PRIMARY KEY ("version")
);
CREATE UNIQUE INDEX "RetentionRuleCatalogVersion_isActive_unique_when_true" ON "RetentionRuleCatalogVersion"("isActive") WHERE "isActive" = true;
ALTER TABLE "RetentionRuleCatalogVersion" ENABLE ROW LEVEL SECURITY;

-- CreateTable: RetentionRule
CREATE TABLE "RetentionRule" (
    "id" TEXT NOT NULL,
    "catalogVersion" TEXT NOT NULL,
    "country" "CountryCode" NOT NULL,
    "recordType" "RetentionRecordType" NOT NULL,
    "basis" "RetentionBasis" NOT NULL,
    "minRetention" TEXT,
    "trigger" "RetentionTrigger" NOT NULL,
    "sourceUrl" TEXT,
    "consolidatedVersion" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "verificationMethod" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RetentionRule_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RetentionRule_catalogVersion_country_recordType_key" ON "RetentionRule"("catalogVersion", "country", "recordType");
CREATE INDEX "RetentionRule_catalogVersion_country_idx" ON "RetentionRule"("catalogVersion", "country");
ALTER TABLE "RetentionRule" ADD CONSTRAINT "RetentionRule_catalogVersion_fkey" FOREIGN KEY ("catalogVersion") REFERENCES "RetentionRuleCatalogVersion"("version") ON DELETE RESTRICT ON UPDATE CASCADE;
-- STATUTORY rows must carry a period and a source (§C.2).
ALTER TABLE "RetentionRule" ADD CONSTRAINT "RetentionRule_statutory_shape_check"
  CHECK ("basis" <> 'STATUTORY' OR ("minRetention" IS NOT NULL AND "sourceUrl" IS NOT NULL));
ALTER TABLE "RetentionRule" ENABLE ROW LEVEL SECURITY;

-- CreateTable: CompanyRetentionSetting
CREATE TABLE "CompanyRetentionSetting" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "recordType" "RetentionRecordType" NOT NULL,
    "retention" TEXT NOT NULL,
    "trigger" "RetentionTrigger" NOT NULL,
    "setByUserId" UUID,
    "setAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompanyRetentionSetting_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CompanyRetentionSetting_companyId_recordType_key" ON "CompanyRetentionSetting"("companyId", "recordType");
CREATE INDEX "CompanyRetentionSetting_companyId_idx" ON "CompanyRetentionSetting"("companyId");
ALTER TABLE "CompanyRetentionSetting" ENABLE ROW LEVEL SECURITY;

-- Seed catalogue v1-2026-11 (active). Source URLs reuse the P3 verified
-- ASchG §14 / ArbSchG §12 rows; verificationMethod mirror (AT) / official (DE).
INSERT INTO "RetentionRuleCatalogVersion" ("version","label","isActive","activatedAt")
VALUES ('v1-2026-11','Aufbewahrungsfristen v1 (2026-11)', true, CURRENT_TIMESTAMP);

INSERT INTO "RetentionRule" ("id","catalogVersion","country","recordType","basis","minRetention","trigger","sourceUrl","consolidatedVersion","verifiedAt","verifiedBy","verificationMethod","notes")
VALUES
('rr-at-tr','v1-2026-11','AT','TRAINING_RECORD','NO_STATUTORY_PERIOD',NULL,'END_OF_EMPLOYMENT','https://www.ris.bka.gv.at/','ASchG §14',TIMESTAMP '2026-11-04','Colin Buzoianu','mirror','Nachweispflicht nach § 14 ASchG, keine gesetzliche Aufbewahrungsfrist. Frist nach Unternehmensrichtlinie.'),
('rr-de-tr','v1-2026-11','DE','TRAINING_RECORD','NO_STATUTORY_PERIOD',NULL,'END_OF_EMPLOYMENT','https://www.gesetze-im-internet.de/arbschg/','ArbSchG §12',TIMESTAMP '2026-11-04','Colin Buzoianu','official','Dokumentationspflicht (§ 12 ArbSchG, DGUV Vorschrift 1 § 4), keine gesetzliche Aufbewahrungsfrist. Frist nach Unternehmensrichtlinie.'),
('rr-at-p','v1-2026-11','AT','PERSON','NO_STATUTORY_PERIOD',NULL,'END_OF_EMPLOYMENT',NULL,NULL,TIMESTAMP '2026-11-04','Colin Buzoianu','mirror','Keine gesetzliche Frist; folgt den verknuepften Nachweisen.'),
('rr-de-p','v1-2026-11','DE','PERSON','NO_STATUTORY_PERIOD',NULL,'END_OF_EMPLOYMENT',NULL,NULL,TIMESTAMP '2026-11-04','Colin Buzoianu','official','Keine gesetzliche Frist; folgt den verknuepften Nachweisen.'),
('rr-at-pa','v1-2026-11','AT','PERSON_ASSIGNMENT','NO_STATUTORY_PERIOD',NULL,'END_OF_EMPLOYMENT',NULL,NULL,TIMESTAMP '2026-11-04','Colin Buzoianu','mirror','Keine gesetzliche Frist; folgt den verknuepften Nachweisen.'),
('rr-de-pa','v1-2026-11','DE','PERSON_ASSIGNMENT','NO_STATUTORY_PERIOD',NULL,'END_OF_EMPLOYMENT',NULL,NULL,TIMESTAMP '2026-11-04','Colin Buzoianu','official','Keine gesetzliche Frist; folgt den verknuepften Nachweisen.'),
('rr-at-ts','v1-2026-11','AT','TRAINING_SESSION','NO_STATUTORY_PERIOD',NULL,'RECORD_DATE',NULL,NULL,TIMESTAMP '2026-11-04','Colin Buzoianu','mirror','Keine gesetzliche Frist; folgt den verknuepften Nachweisen.'),
('rr-de-ts','v1-2026-11','DE','TRAINING_SESSION','NO_STATUTORY_PERIOD',NULL,'RECORD_DATE',NULL,NULL,TIMESTAMP '2026-11-04','Colin Buzoianu','official','Keine gesetzliche Frist; folgt den verknuepften Nachweisen.');

-- Platform default company policy for every EXISTING company:
--   TRAINING_RECORD: 10 years after end of employment
--   PERSON (no linked records): 1 year after end of employment
INSERT INTO "CompanyRetentionSetting" ("id","companyId","recordType","retention","trigger")
SELECT gen_random_uuid()::text, c."id", 'TRAINING_RECORD', 'P10Y', 'END_OF_EMPLOYMENT' FROM "Company" c
ON CONFLICT ("companyId","recordType") DO NOTHING;
INSERT INTO "CompanyRetentionSetting" ("id","companyId","recordType","retention","trigger")
SELECT gen_random_uuid()::text, c."id", 'PERSON', 'P1Y', 'END_OF_EMPLOYMENT' FROM "Company" c
ON CONFLICT ("companyId","recordType") DO NOTHING;
