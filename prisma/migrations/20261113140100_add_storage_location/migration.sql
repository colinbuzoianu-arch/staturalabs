-- P15 S5a (SLD_P15_GEFAHRSTOFFE_EXTENDED_APPROVED.md §2 S5): StorageLocation
-- replaces the free-text SubstanceUse.storageLocation. A real entity per site
-- (name + type) so the TRGS 510 Zusammenlagerungs-check (S5b) can list the
-- Lagerklassen present at one location. Existing free-text values are migrated
-- into StorageLocation rows and linked; the old column is kept (deprecated,
-- nullable) rather than dropped, so no data is lost. Person-free. Site-scoped
-- RLS (P13 §1, parent-EXISTS over Site). FK Restrict (ERGO §3.9).

CREATE TABLE "StorageLocation" (
    "id"        TEXT NOT NULL,
    "siteId"    TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "type"      "StorageLocationType" NOT NULL DEFAULT 'OTHER',
    "notes"     TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StorageLocation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StorageLocation_siteId_idx" ON "StorageLocation"("siteId");
CREATE UNIQUE INDEX "StorageLocation_siteId_name_key" ON "StorageLocation"("siteId", "name");
ALTER TABLE "StorageLocation" ADD CONSTRAINT "StorageLocation_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SubstanceUse" ADD COLUMN "storageLocationId" TEXT;
CREATE INDEX "SubstanceUse_storageLocationId_idx" ON "SubstanceUse"("storageLocationId");
ALTER TABLE "SubstanceUse" ADD CONSTRAINT "SubstanceUse_storageLocationId_fkey"
  FOREIGN KEY ("storageLocationId") REFERENCES "StorageLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Migrate existing free-text storage locations into StorageLocation rows
-- (distinct per site), then link each use to its row. The old text column is
-- left in place as a deprecated fallback.
INSERT INTO "StorageLocation"("id", "siteId", "name", "type", "createdAt")
SELECT gen_random_uuid()::text, d."siteId", d.trimmed, 'OTHER', now()
FROM (
  SELECT DISTINCT "siteId", trim("storageLocation") AS trimmed
  FROM "SubstanceUse"
  WHERE "storageLocation" IS NOT NULL AND trim("storageLocation") <> ''
) d;

UPDATE "SubstanceUse" su
SET "storageLocationId" = sl.id
FROM "StorageLocation" sl
WHERE sl."siteId" = su."siteId"
  AND sl.name = trim(su."storageLocation")
  AND su."storageLocation" IS NOT NULL
  AND trim(su."storageLocation") <> '';

ALTER TABLE "StorageLocation" ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_rls ON "StorageLocation" FOR ALL TO statura_app
  USING (EXISTS (SELECT 1 FROM "Site" p WHERE p.id = "StorageLocation"."siteId"))
  WITH CHECK (EXISTS (SELECT 1 FROM "Site" p WHERE p.id = "StorageLocation"."siteId"));
