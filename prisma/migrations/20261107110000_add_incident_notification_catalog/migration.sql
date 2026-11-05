-- P10d §A: statutory notification catalogue + rules, then seed §A.1. RLS on.
-- Single-active partial unique index (the MethodologyVersion pattern). Hand-
-- added CHECK: exactly one of {deadline set, immediate, asSoonAsPossible}.
-- No new enum (CountryCode/IncidentType exist). FKs Restrict.

CREATE TABLE "IncidentNotificationCatalogVersion" (
    "version" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IncidentNotificationCatalogVersion_pkey" PRIMARY KEY ("version")
);
CREATE UNIQUE INDEX "IncidentNotificationCatalogVersion_isActive_unique_when_true" ON "IncidentNotificationCatalogVersion"("isActive") WHERE "isActive" = true;
ALTER TABLE "IncidentNotificationCatalogVersion" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "IncidentNotificationRule" (
    "id" TEXT NOT NULL,
    "catalogVersion" TEXT NOT NULL,
    "country" "CountryCode" NOT NULL,
    "incidentType" "IncidentType" NOT NULL,
    "appliesToFatalOrMass" BOOLEAN NOT NULL DEFAULT false,
    "deadline" TEXT,
    "immediate" BOOLEAN NOT NULL DEFAULT false,
    "asSoonAsPossible" BOOLEAN NOT NULL DEFAULT false,
    "thresholdText" TEXT NOT NULL,
    "clockStartsText" TEXT,
    "legalReferenceId" TEXT NOT NULL,
    "verifiedBy" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "verificationMethod" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IncidentNotificationRule_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "IncidentNotificationRule_catalogVersion_country_incidentType_fatal_key" ON "IncidentNotificationRule"("catalogVersion", "country", "incidentType", "appliesToFatalOrMass");
CREATE INDEX "IncidentNotificationRule_catalogVersion_country_idx" ON "IncidentNotificationRule"("catalogVersion", "country");
CREATE INDEX "IncidentNotificationRule_legalReferenceId_idx" ON "IncidentNotificationRule"("legalReferenceId");
ALTER TABLE "IncidentNotificationRule" ADD CONSTRAINT "IncidentNotificationRule_catalogVersion_fkey" FOREIGN KEY ("catalogVersion") REFERENCES "IncidentNotificationCatalogVersion"("version") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IncidentNotificationRule" ADD CONSTRAINT "IncidentNotificationRule_legalReferenceId_fkey" FOREIGN KEY ("legalReferenceId") REFERENCES "LegalReference"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IncidentNotificationRule" ADD CONSTRAINT "IncidentNotificationRule_exactly_one_timing_check" CHECK (
  (
    (CASE WHEN "deadline" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "immediate" THEN 1 ELSE 0 END) +
    (CASE WHEN "asSoonAsPossible" THEN 1 ELSE 0 END)
  ) = 1
);
ALTER TABLE "IncidentNotificationRule" ENABLE ROW LEVEL SECURITY;

-- Seed §A.1. Catalogue version v1-dach-2026, active. verifiedBy/verifiedAt from
-- the approved doc. CH rows exist but are positioning-only (the ch CountryPack
-- stays verified:false, so the UI never renders them on a live CH site).
INSERT INTO "IncidentNotificationCatalogVersion" ("version","label","isActive","activatedAt")
VALUES ('v1-dach-2026', 'DACH incident-notification rules v1 (AT+DE live, CH positioning, 2026-11-05)', true, CURRENT_TIMESTAMP);

INSERT INTO "IncidentNotificationRule"
  ("id","catalogVersion","country","incidentType","appliesToFatalOrMass","deadline","immediate","asSoonAsPossible","thresholdText","clockStartsText","legalReferenceId","verifiedBy","verifiedAt","verificationMethod","createdAt")
VALUES
  -- AT (§363 Abs. 1 ASVG, 5 days)
  (gen_random_uuid()::text,'v1-dach-2026','AT','ARBEITSUNFALL',false,'P5D',false,false,'Tod oder mehr als 3 Tage völlige/teilweise Arbeitsunfähigkeit','ab dem Unfalltag','legalref-at-n1','Colin Buzoianu','2026-11-05','mirror',CURRENT_TIMESTAMP),
  (gen_random_uuid()::text,'v1-dach-2026','AT','WEGEUNFALL',false,'P5D',false,false,'Tod oder mehr als 3 Tage völlige/teilweise Arbeitsunfähigkeit (sofern versichert)','ab dem Unfalltag','legalref-at-n1','Colin Buzoianu','2026-11-05','mirror',CURRENT_TIMESTAMP),
  (gen_random_uuid()::text,'v1-dach-2026','AT','BERUFSKRANKHEIT_VERDACHT',false,'P5D',false,false,'begründeter Verdacht auf eine Berufskrankheit','ab Kenntnis des Verdachts','legalref-at-n1','Colin Buzoianu','2026-11-05','mirror',CURRENT_TIMESTAMP),
  -- DE (§193 SGB VII, 3 days) + the fatal/mass "sofort" variant
  (gen_random_uuid()::text,'v1-dach-2026','DE','ARBEITSUNFALL',false,'P3D',false,false,'Tod oder mehr als 3 Tage Arbeitsunfähigkeit','ab Kenntnis durch den Arbeitgeber','legalref-de-n1','Colin Buzoianu','2026-11-05','seed-check',CURRENT_TIMESTAMP),
  (gen_random_uuid()::text,'v1-dach-2026','DE','WEGEUNFALL',false,'P3D',false,false,'Tod oder mehr als 3 Tage Arbeitsunfähigkeit','ab Kenntnis durch den Arbeitgeber','legalref-de-n1','Colin Buzoianu','2026-11-05','seed-check',CURRENT_TIMESTAMP),
  (gen_random_uuid()::text,'v1-dach-2026','DE','BERUFSKRANKHEIT_VERDACHT',false,'P3D',false,false,'Anhaltspunkte für eine Berufskrankheit (§ 193 Abs. 2 SGB VII)','ab Kenntnis der Anhaltspunkte','legalref-de-n1','Colin Buzoianu','2026-11-05','seed-check',CURRENT_TIMESTAMP),
  (gen_random_uuid()::text,'v1-dach-2026','DE','ARBEITSUNFALL',true,NULL,true,false,'Tödlicher Unfall oder Massenunfall (mehr als 3 Verletzte mit ärztlicher Behandlung) — sofort/unverzüglich','ab Kenntnis durch den Arbeitgeber','legalref-de-n1','Colin Buzoianu','2026-11-05','mirror',CURRENT_TIMESTAMP),
  -- CH (UVG/VUV, so rasch wie möglich — positioning-only)
  (gen_random_uuid()::text,'v1-dach-2026','CH','ARBEITSUNFALL',false,NULL,false,true,'Unfall mit Behandlungsbedarf oder Arbeitsunfähigkeit','ab Kenntnis durch den Arbeitgeber','legalref-ch-n1','Colin Buzoianu','2026-11-05','mirror',CURRENT_TIMESTAMP),
  (gen_random_uuid()::text,'v1-dach-2026','CH','WEGEUNFALL',false,NULL,false,true,'Nichtberufsunfall (sofern versichert)','ab Kenntnis durch den Arbeitgeber','legalref-ch-n1','Colin Buzoianu','2026-11-05','mirror',CURRENT_TIMESTAMP),
  (gen_random_uuid()::text,'v1-dach-2026','CH','BERUFSKRANKHEIT_VERDACHT',false,NULL,false,true,'Verdacht auf eine Berufskrankheit','ab Kenntnis des Verdachts','legalref-ch-n1','Colin Buzoianu','2026-11-05','mirror',CURRENT_TIMESTAMP);
