-- P15 S6 (SLD_P15_GEFAHRSTOFFE_EXTENDED_APPROVED.md §2 S6): raw-material property
-- database. ReferenceSubstance (CAS-keyed system catalogue) + one property row
-- per value per source (flash/boiling/melting point, density, vapour pressure,
-- water solubility), each with source + conditions. Shown on substances as
-- "Referenzdaten" — NEVER silently replaces SDS values; differences are shown
-- side by side (§2 S6). Sources: PubChem experimental properties (public-domain;
-- records without a resolvable source are skipped) and SDS-confirmed values.
-- Property values are stored VERBATIM as text (never numerically re-parsed), so
-- no value is mis-transcribed (§0.7). Global tables, shared-read RLS (P13 §1).
-- Enum + tables in one migration (no CHECK/seed references the enum's values).

CREATE TYPE "ReferencePropertyType" AS ENUM (
  'FLASH_POINT', 'BOILING_POINT', 'MELTING_POINT', 'DENSITY', 'VAPOR_PRESSURE', 'WATER_SOLUBILITY'
);

CREATE TABLE "ReferenceSubstance" (
    "id"               TEXT NOT NULL,
    "casNumber"        TEXT,
    "ecNumber"         TEXT,
    "nameEn"           TEXT NOT NULL,
    "nameDe"           TEXT,
    "molecularFormula" TEXT,
    "pubchemCid"       INTEGER,
    "source"           TEXT NOT NULL DEFAULT 'PubChem',
    "sourceUrl"        TEXT,
    "importedAt"       TIMESTAMP(3),
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReferenceSubstance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReferenceSubstance_casNumber_key" ON "ReferenceSubstance"("casNumber");
CREATE INDEX "ReferenceSubstance_ecNumber_idx" ON "ReferenceSubstance"("ecNumber");

CREATE TABLE "ReferenceSubstanceProperty" (
    "id"                  TEXT NOT NULL,
    "referenceSubstanceId" TEXT NOT NULL,
    "propertyType"        "ReferencePropertyType" NOT NULL,
    "valueText"           TEXT NOT NULL,
    "sourceName"          TEXT NOT NULL,
    "conditions"          TEXT,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferenceSubstanceProperty_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ReferenceSubstanceProperty_referenceSubstanceId_idx" ON "ReferenceSubstanceProperty"("referenceSubstanceId");
ALTER TABLE "ReferenceSubstanceProperty" ADD CONSTRAINT "ReferenceSubstanceProperty_referenceSubstanceId_fkey"
  FOREIGN KEY ("referenceSubstanceId") REFERENCES "ReferenceSubstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReferenceSubstance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReferenceSubstanceProperty" ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_rls ON "ReferenceSubstance" FOR ALL TO statura_app USING (true) WITH CHECK (true);
CREATE POLICY app_rls ON "ReferenceSubstanceProperty" FOR ALL TO statura_app USING (true) WITH CHECK (true);
