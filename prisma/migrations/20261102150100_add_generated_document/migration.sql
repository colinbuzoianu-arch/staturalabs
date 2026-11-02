-- P4 (§2.2 rule 4, §7.2): GeneratedDocument — the archive row every PDF route
-- writes. No seed. CountryCode + GeneratedDocumentType already exist. RLS
-- enabled (owner-bypass posture, as every table). The unique index is the
-- dedup/never-overwrite guarantee: identical content for one (site, type)
-- reuses the row, different content is a new row.
CREATE TABLE "GeneratedDocument" (
    "id" TEXT NOT NULL,
    "type" "GeneratedDocumentType" NOT NULL,
    "companyId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "country" "CountryCode" NOT NULL,
    "generatedByUserId" UUID,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "versions" JSONB,
    "sha256" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,

    CONSTRAINT "GeneratedDocument_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GeneratedDocument_siteId_type_sha256_key" ON "GeneratedDocument"("siteId", "type", "sha256");
CREATE INDEX "GeneratedDocument_siteId_type_idx" ON "GeneratedDocument"("siteId", "type");
CREATE INDEX "GeneratedDocument_companyId_idx" ON "GeneratedDocument"("companyId");
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GeneratedDocument" ENABLE ROW LEVEL SECURITY;
