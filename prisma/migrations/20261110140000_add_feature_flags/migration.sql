-- P13 §2.5: super-admin feature-flag store (per-tenant or global).
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "companyId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "setByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FeatureFlag_key_companyId_key" ON "FeatureFlag"("key", "companyId");
CREATE INDEX "FeatureFlag_companyId_idx" ON "FeatureFlag"("companyId");
ALTER TABLE "FeatureFlag" ENABLE ROW LEVEL SECURITY;
-- Shared-read under the app role (flags aren't tenant-sensitive data); writes
-- go through the super-admin console.
CREATE POLICY app_rls ON "FeatureFlag" FOR ALL TO statura_app USING (true) WITH CHECK (true);
