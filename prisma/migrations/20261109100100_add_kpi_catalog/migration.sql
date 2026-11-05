-- P12: KPI catalogue + definitions + per-site period figures. RLS on; FKs
-- Restrict; person-free. Single-active catalogue (partial unique index). The v1
-- system KPI set is seeded here (labels are German fallbacks; the UI localises
-- via an i18n map keyed by `key`).

CREATE TABLE "KpiCatalogVersion" (
    "version" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KpiCatalogVersion_pkey" PRIMARY KEY ("version")
);
CREATE UNIQUE INDEX "KpiCatalogVersion_isActive_unique_when_true" ON "KpiCatalogVersion"("isActive") WHERE "isActive" = true;
ALTER TABLE "KpiCatalogVersion" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "KpiDefinition" (
    "id" TEXT NOT NULL,
    "catalogVersion" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "domain" "KpiDomain" NOT NULL,
    "personDerived" BOOLEAN NOT NULL DEFAULT false,
    "higherIsBetter" BOOLEAN NOT NULL DEFAULT false,
    "periodScoped" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "country" "CountryCode",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KpiDefinition_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "KpiDefinition_catalogVersion_key_key" ON "KpiDefinition"("catalogVersion", "key");
CREATE INDEX "KpiDefinition_catalogVersion_idx" ON "KpiDefinition"("catalogVersion");
ALTER TABLE "KpiDefinition" ADD CONSTRAINT "KpiDefinition_catalogVersion_fkey" FOREIGN KEY ("catalogVersion") REFERENCES "KpiCatalogVersion"("version") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KpiDefinition" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "SitePeriodFigures" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "headcount" INTEGER,
    "hoursWorked" INTEGER,
    "setByUserId" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SitePeriodFigures_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SitePeriodFigures_siteId_year_key" ON "SitePeriodFigures"("siteId", "year");
CREATE INDEX "SitePeriodFigures_siteId_idx" ON "SitePeriodFigures"("siteId");
ALTER TABLE "SitePeriodFigures" ADD CONSTRAINT "SitePeriodFigures_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SitePeriodFigures" ENABLE ROW LEVEL SECURITY;

-- Seed the v1 system KPI set (catalogue v1-2026, active).
INSERT INTO "KpiCatalogVersion" ("version","label","isActive","activatedAt")
VALUES ('v1-2026','KPI-Set v1 (2026)', true, CURRENT_TIMESTAMP);

INSERT INTO "KpiDefinition"
  ("id","catalogVersion","key","label","unit","domain","personDerived","higherIsBetter","periodScoped","order")
VALUES
  (gen_random_uuid()::text,'v1-2026','accident-count','Arbeitsunfälle','Anzahl','OSH',false,false,true,10),
  (gen_random_uuid()::text,'v1-2026','accident-rate-1000','Unfallrate je 1.000 Beschäftigte','je 1.000 MA','OSH',false,false,true,20),
  (gen_random_uuid()::text,'v1-2026','accident-rate-million-hours','Unfallrate je 1 Mio. Arbeitsstunden','je 1 Mio. h','OSH',false,false,true,30),
  (gen_random_uuid()::text,'v1-2026','lost-days','Ausfalltage','Tage','OSH',true,false,true,40),
  (gen_random_uuid()::text,'v1-2026','near-miss-ratio','Beinaheunfälle je Arbeitsunfall','Verhältnis','OSH',false,true,true,50),
  (gen_random_uuid()::text,'v1-2026','open-actions','Offene Maßnahmen','Anzahl','CROSS',false,false,false,60),
  (gen_random_uuid()::text,'v1-2026','overdue-actions','Überfällige Maßnahmen','Anzahl','CROSS',false,false,false,70),
  (gen_random_uuid()::text,'v1-2026','action-effectiveness','Wirksamkeitsquote der Maßnahmen','%','CROSS',false,true,false,80),
  (gen_random_uuid()::text,'v1-2026','assessment-completeness','Vollständigkeit der Evaluierungen','%','OSH',false,true,false,90),
  (gen_random_uuid()::text,'v1-2026','overdue-reviews','Überfällige Überprüfungen','Anzahl','OSH',false,false,false,100),
  (gen_random_uuid()::text,'v1-2026','instruction-coverage','Unterweisungsabdeckung','%','OSH',true,true,false,110),
  (gen_random_uuid()::text,'v1-2026','inspection-completion','Begehungsabschlussquote','%','OSH',false,true,true,120),
  (gen_random_uuid()::text,'v1-2026','sds-currency','Aktualität der Sicherheitsdatenblätter','%','OSH',false,true,false,130),
  (gen_random_uuid()::text,'v1-2026','waste-quantity','Abfallmenge','kg','ENVIRONMENT',false,false,true,140),
  (gen_random_uuid()::text,'v1-2026','environmental-significance','Signifikante Umweltaspekte','Anzahl','ENVIRONMENT',false,false,false,150);
