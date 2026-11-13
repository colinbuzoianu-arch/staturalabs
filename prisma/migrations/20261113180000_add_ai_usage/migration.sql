-- P15 S8 (SLD_P15_GEFAHRSTOFFE_EXTENDED_APPROVED.md §2 S8): AI entitlement + cost
-- control. The "KI-Funktionen Gefahrstoffe" entitlement is the existing
-- chemicals.ai feature flag (P13 §2.5, toggled per tenant in /admin/flags,
-- default OFF). This adds per-tenant USAGE METERING (calls + tokens by feature
-- and month) and an optional monthly CAP; when the cap is reached AI pauses and
-- manual entry keeps working. Person-free (company-scoped counters, no worker
-- data). Company-scoped RLS (P13 §1).

CREATE TABLE "AiUsageCounter" (
    "id"           TEXT NOT NULL,
    "companyId"    TEXT NOT NULL,
    "periodYear"   INTEGER NOT NULL,
    "periodMonth"  INTEGER NOT NULL,
    "feature"      TEXT NOT NULL,
    "calls"        INTEGER NOT NULL DEFAULT 0,
    "inputTokens"  BIGINT NOT NULL DEFAULT 0,
    "outputTokens" BIGINT NOT NULL DEFAULT 0,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiUsageCounter_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AiUsageCounter_company_period_feature_key"
  ON "AiUsageCounter"("companyId", "periodYear", "periodMonth", "feature");
CREATE INDEX "AiUsageCounter_companyId_idx" ON "AiUsageCounter"("companyId");
ALTER TABLE "AiUsageCounter" ADD CONSTRAINT "AiUsageCounter_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AiUsageCap" (
    "companyId"       TEXT NOT NULL,
    "monthlyCallCap"  INTEGER,
    "monthlyTokenCap" BIGINT,
    "updatedByUserId" UUID,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiUsageCap_pkey" PRIMARY KEY ("companyId")
);
ALTER TABLE "AiUsageCap" ADD CONSTRAINT "AiUsageCap_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AiUsageCounter" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AiUsageCap" ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_rls ON "AiUsageCounter" FOR ALL TO statura_app
  USING ("companyId" = ANY(app_company_ids())) WITH CHECK ("companyId" = ANY(app_company_ids()));
CREATE POLICY app_rls ON "AiUsageCap" FOR ALL TO statura_app
  USING ("companyId" = ANY(app_company_ids())) WITH CHECK ("companyId" = ANY(app_company_ids()));
