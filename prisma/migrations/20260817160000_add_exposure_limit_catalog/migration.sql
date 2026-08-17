-- B4 of the Austria-first plan (SLD_IMPLEMENTATION_PLAN_austria-first.md
-- §4.4/§4.5, §7 B4): the exposure-limit catalog and the two-tier
-- (Auslösewert/Expositionsgrenzwert) fix to ExposureMeasurement. Table
-- structure only — no seed data in this migration. `CountryCode` and
-- `HazardCategory` already exist as enums (added in earlier migrations),
-- so there's no brand-new-enum-value gotcha to split around here.

-- CreateTable
CREATE TABLE "ExposureLimitCatalogVersion" (
    "version" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExposureLimitCatalogVersion_pkey" PRIMARY KEY ("version")
);

-- CreateIndex
-- Partial unique index: at most one row may have isActive = true. Prisma's
-- schema language can't express this (no filtered/partial index support),
-- so it's hand-added here — exact mirror of
-- MethodologyVersion_isActive_unique_when_true
-- (prisma/migrations/20260709055313_add_methodology_version) and
-- RiskMatrixVersion_isActive_unique_when_true
-- (prisma/migrations/20260730120300_add_risk_core).
CREATE UNIQUE INDEX "ExposureLimitCatalogVersion_isActive_unique_when_true" ON "ExposureLimitCatalogVersion"("isActive") WHERE "isActive" = true;

ALTER TABLE "ExposureLimitCatalogVersion" ENABLE ROW LEVEL SECURITY;

-- CreateTable
CREATE TABLE "ExposureLimit" (
    "id" TEXT NOT NULL,
    "catalogVersion" TEXT NOT NULL,
    "country" "CountryCode" NOT NULL,
    "hazardCategory" "HazardCategory" NOT NULL,
    "parameterKey" TEXT NOT NULL,
    "parameterLabel" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "actionValue" DOUBLE PRECISION,
    "limitValue" DOUBLE PRECISION,
    "legalReference" TEXT NOT NULL,
    "legalReferenceUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExposureLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- The actual lookup key (country + hazardCategory + parameterKey) —
-- guarantees no duplicate parameter per country per catalog version, and
-- is exactly what lookupExposureLimits/matchExposureLimits
-- (src/lib/risk/exposure-limit-*.ts) filter on.
CREATE UNIQUE INDEX "ExposureLimit_catalogVersion_country_parameterKey_key" ON "ExposureLimit"("catalogVersion", "country", "parameterKey");

-- CreateIndex
CREATE INDEX "ExposureLimit_catalogVersion_country_hazardCategory_idx" ON "ExposureLimit"("catalogVersion", "country", "hazardCategory");

ALTER TABLE "ExposureLimit" ENABLE ROW LEVEL SECURITY;

-- AddForeignKey
ALTER TABLE "ExposureLimit" ADD CONSTRAINT "ExposureLimit_catalogVersion_fkey" FOREIGN KEY ("catalogVersion") REFERENCES "ExposureLimitCatalogVersion"("version") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: ExposureMeasurement gains the action-value tier and a
-- provenance FK back to whichever catalog row informed the entry (never
-- recomputed against "whatever is active now" — same reasoning as
-- RiskAssessment.matrixVersion). All three genuinely optional forever —
-- a measurement entered before this catalog existed, or for a
-- country/parameter with no catalog row yet, has none of these, which is
-- a legitimate permanent state, not a gap to backfill.
ALTER TABLE "ExposureMeasurement" ADD COLUMN "actionValue" DOUBLE PRECISION;
ALTER TABLE "ExposureMeasurement" ADD COLUMN "actionValueReference" TEXT;
ALTER TABLE "ExposureMeasurement" ADD COLUMN "exposureLimitId" TEXT;

-- CreateIndex
CREATE INDEX "ExposureMeasurement_exposureLimitId_idx" ON "ExposureMeasurement"("exposureLimitId");

-- AddForeignKey
ALTER TABLE "ExposureMeasurement" ADD CONSTRAINT "ExposureMeasurement_exposureLimitId_fkey" FOREIGN KEY ("exposureLimitId") REFERENCES "ExposureLimit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
