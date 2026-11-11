-- P14 G1: person-free workforce figures (headcount + hours worked) per site,
-- optional org-unit, and period (month / quarter / year). Supersedes the
-- annual-only, site-only SitePeriodFigures — the P12 accident-rate denominators
-- now come from here, aggregated per year. Rows are AGGREGATES (a figure), never
-- Person records: no FK into the people compartment (ERGO §3.18).
--
-- periodIndex is NOT NULL and carries 0 for a YEAR row (so the unique indexes
-- below never see a NULL in that column); a hand-added CHECK enforces its range
-- by periodType. The two partial unique indexes give "one row per
-- site+orgUnit+period" without depending on a specific Postgres NULLS-NOT-DISTINCT
-- version (orgUnitId is legitimately NULL for a whole-site figure). Both are
-- hand-added and invisible to Prisma (same pattern as the other partial indexes
-- in this schema).

CREATE TABLE "SiteWorkforcePeriod" (
    "id"          TEXT NOT NULL,
    "siteId"      TEXT NOT NULL,
    "orgUnitId"   TEXT,
    "periodType"  "WorkforcePeriodType" NOT NULL,
    "year"        INTEGER NOT NULL,
    "periodIndex" INTEGER NOT NULL,
    "headcount"   INTEGER,
    "hoursWorked" INTEGER,
    "setByUserId" UUID,
    "setAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SiteWorkforcePeriod_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SiteWorkforcePeriod"
  ADD CONSTRAINT "SiteWorkforcePeriod_period_shape_check" CHECK (
       ("periodType" = 'YEAR'    AND "periodIndex" = 0)
    OR ("periodType" = 'QUARTER' AND "periodIndex" BETWEEN 1 AND 4)
    OR ("periodType" = 'MONTH'   AND "periodIndex" BETWEEN 1 AND 12)
  );

ALTER TABLE "SiteWorkforcePeriod"
  ADD CONSTRAINT "SiteWorkforcePeriod_figures_nonneg_check" CHECK (
       ("headcount"   IS NULL OR "headcount"   >= 0)
   AND ("hoursWorked" IS NULL OR "hoursWorked" >= 0)
  );

CREATE INDEX "SiteWorkforcePeriod_siteId_year_idx" ON "SiteWorkforcePeriod"("siteId", "year");
CREATE INDEX "SiteWorkforcePeriod_orgUnitId_idx" ON "SiteWorkforcePeriod"("orgUnitId");

CREATE UNIQUE INDEX "SiteWorkforcePeriod_site_period_unique"
  ON "SiteWorkforcePeriod"("siteId", "periodType", "year", "periodIndex")
  WHERE "orgUnitId" IS NULL;
CREATE UNIQUE INDEX "SiteWorkforcePeriod_orgunit_period_unique"
  ON "SiteWorkforcePeriod"("siteId", "orgUnitId", "periodType", "year", "periodIndex")
  WHERE "orgUnitId" IS NOT NULL;

ALTER TABLE "SiteWorkforcePeriod"
  ADD CONSTRAINT "SiteWorkforcePeriod_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SiteWorkforcePeriod"
  ADD CONSTRAINT "SiteWorkforcePeriod_orgUnitId_fkey"
  FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SiteWorkforcePeriod" ENABLE ROW LEVEL SECURITY;
-- Site-scoped RLS (P13 §1): the row's site must be visible to the session.
CREATE POLICY app_rls ON "SiteWorkforcePeriod" FOR ALL TO statura_app
  USING      (EXISTS (SELECT 1 FROM "Site" s WHERE s.id = "SiteWorkforcePeriod"."siteId"))
  WITH CHECK (EXISTS (SELECT 1 FROM "Site" s WHERE s.id = "SiteWorkforcePeriod"."siteId"));

-- Carry forward the existing annual figures as YEAR rows, then drop the old
-- table (its RLS policy drops with it). One source of truth from here on.
INSERT INTO "SiteWorkforcePeriod"
  ("id", "siteId", "orgUnitId", "periodType", "year", "periodIndex",
   "headcount", "hoursWorked", "setByUserId", "setAt", "updatedAt", "createdAt")
SELECT gen_random_uuid()::text, "siteId", NULL, 'YEAR', "year", 0,
       "headcount", "hoursWorked", "setByUserId", "updatedAt", "updatedAt", "createdAt"
FROM "SitePeriodFigures";

DROP TABLE "SitePeriodFigures";
