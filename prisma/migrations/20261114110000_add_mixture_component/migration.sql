-- P16 §3.1 slice 2: mixture composition. MixtureComponent on a Substance — the
-- input the CLP/physical/WGK engines need. Filled automatically from the confirmed
-- SDS section 3 (P15 SdsComponent) or entered/corrected in the composition editor.
-- Concentration is an EXACT value OR a range (min/max %); a CHECK forbids setting
-- both (exact XOR range; neither = unknown, reported by the data-readiness panel).
-- Engines use the CONSERVATIVE end of a range (documented in
-- CHEMISTRY_ENGINE_NOTES). Per component, where known: classification, SCLs,
-- M-factor, ATE per route, WGK, and a link to the ReferenceSubstance by CAS.
-- Child of Substance → company-scoped via the parent (parent-EXISTS RLS).

CREATE TABLE "MixtureComponent" (
    "id"                          TEXT NOT NULL,
    "substanceId"                 TEXT NOT NULL,
    "referenceSubstanceId"        TEXT,
    "casNumber"                   TEXT,
    "name"                        TEXT NOT NULL,
    "concentrationExactPct"       DOUBLE PRECISION,
    "concentrationMinPct"         DOUBLE PRECISION,
    "concentrationMaxPct"         DOUBLE PRECISION,
    "classification"              TEXT,
    "specificConcentrationLimits" TEXT,
    "mFactor"                     DOUBLE PRECISION,
    "ateOral"                     DOUBLE PRECISION,
    "ateDermal"                   DOUBLE PRECISION,
    "ateInhalation"               DOUBLE PRECISION,
    "wgk"                         INTEGER,
    "source"                      TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt"                   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"                   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MixtureComponent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MixtureComponent_substanceId_idx" ON "MixtureComponent"("substanceId");
CREATE INDEX "MixtureComponent_referenceSubstanceId_idx" ON "MixtureComponent"("referenceSubstanceId");
ALTER TABLE "MixtureComponent" ADD CONSTRAINT "MixtureComponent_concentration_shape_check" CHECK (
  NOT ("concentrationExactPct" IS NOT NULL AND ("concentrationMinPct" IS NOT NULL OR "concentrationMaxPct" IS NOT NULL))
);
ALTER TABLE "MixtureComponent" ADD CONSTRAINT "MixtureComponent_substanceId_fkey"
  FOREIGN KEY ("substanceId") REFERENCES "Substance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MixtureComponent" ADD CONSTRAINT "MixtureComponent_referenceSubstanceId_fkey"
  FOREIGN KEY ("referenceSubstanceId") REFERENCES "ReferenceSubstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MixtureComponent" ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_rls ON "MixtureComponent" FOR ALL TO statura_app
  USING (EXISTS (SELECT 1 FROM "Substance" p WHERE p.id = "MixtureComponent"."substanceId"))
  WITH CHECK (EXISTS (SELECT 1 FROM "Substance" p WHERE p.id = "MixtureComponent"."substanceId"));
