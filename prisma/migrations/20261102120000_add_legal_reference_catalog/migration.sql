-- P3 of the platform-modules restructure plan
-- (SLD_RESTRUCTURE_PLAN_platform-modules.md §4.2, ERGO_COMPLIANCE_BY_DESIGN.md
-- §3.19): the country-scoped legal-reference catalogue the risk module cites
-- per jurisdiction. Table structure only — NO seed data. Per §3.19/§4, no
-- DE/CH (or AT) legal reference is seeded until the founder has verified it
-- against the official consolidated text (the SLD_P3_LEGAL_CATALOGUE_DRAFT.md
-- worksheet). `CountryCode` already exists as an enum, so no enum-first split.
--
-- Hand-added construct to re-verify live after migrate deploy: the partial
-- unique index below (exact mirror of
-- ExposureLimitCatalogVersion_isActive_unique_when_true and
-- MethodologyVersion_isActive_unique_when_true).

-- CreateTable
CREATE TABLE "LegalReferenceCatalogVersion" (
    "version" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalReferenceCatalogVersion_pkey" PRIMARY KEY ("version")
);

-- Partial unique index: at most one active catalogue version. Prisma can't
-- express a filtered index, so it is hand-added here.
CREATE UNIQUE INDEX "LegalReferenceCatalogVersion_isActive_unique_when_true" ON "LegalReferenceCatalogVersion"("isActive") WHERE "isActive" = true;

ALTER TABLE "LegalReferenceCatalogVersion" ENABLE ROW LEVEL SECURITY;

-- CreateTable
CREATE TABLE "LegalReference" (
    "id" TEXT NOT NULL,
    "catalogVersion" TEXT NOT NULL,
    "country" "CountryCode" NOT NULL,
    "topic" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "obligation" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "consolidatedVersion" TEXT,
    "verifiedBy" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalReference_pkey" PRIMARY KEY ("id")
);

-- One row per (catalogVersion, country, code) — no duplicate reference per
-- country per catalogue version; the lookup filters on country + topic.
CREATE UNIQUE INDEX "LegalReference_catalogVersion_country_code_key" ON "LegalReference"("catalogVersion", "country", "code");
CREATE INDEX "LegalReference_catalogVersion_country_topic_idx" ON "LegalReference"("catalogVersion", "country", "topic");

ALTER TABLE "LegalReference" ADD CONSTRAINT "LegalReference_catalogVersion_fkey" FOREIGN KEY ("catalogVersion") REFERENCES "LegalReferenceCatalogVersion"("version") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LegalReference" ENABLE ROW LEVEL SECURITY;
