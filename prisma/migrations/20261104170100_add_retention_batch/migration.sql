-- P7d §C.4: proposal batches + per-company auto-execute config. RLS on all.
-- RetentionBatchItem cascades from its batch; personId is a plain column.

CREATE TABLE "RetentionBatch" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "status" "RetentionBatchStatus" NOT NULL DEFAULT 'PROPOSED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedByUserId" UUID,
    "approvedAt" TIMESTAMP(3),
    CONSTRAINT "RetentionBatch_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RetentionBatch_companyId_status_idx" ON "RetentionBatch"("companyId", "status");
ALTER TABLE "RetentionBatch" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "RetentionBatchItem" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "maturedAt" TIMESTAMP(3) NOT NULL,
    "anonymisedAt" TIMESTAMP(3),
    CONSTRAINT "RetentionBatchItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RetentionBatchItem_batchId_idx" ON "RetentionBatchItem"("batchId");
ALTER TABLE "RetentionBatchItem" ADD CONSTRAINT "RetentionBatchItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "RetentionBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RetentionBatchItem" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "CompanyRetentionConfig" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "autoExecute" BOOLEAN NOT NULL DEFAULT false,
    "updatedByUserId" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompanyRetentionConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CompanyRetentionConfig_companyId_key" ON "CompanyRetentionConfig"("companyId");
ALTER TABLE "CompanyRetentionConfig" ENABLE ROW LEVEL SECURITY;
