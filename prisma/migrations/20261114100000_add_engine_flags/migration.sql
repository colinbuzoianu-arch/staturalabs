-- P16 §2 slice 1: three-state engine flags + the VALIDATED review guard.
-- Each prepared chemistry engine (P15 §3) has a per-tenant state:
--   OFF        — the tenant sees nothing.
--   PREVIEW    — read-only comparison output + a "nicht fachlich geprüft" banner,
--                PDFs watermarked, no "übernehmen".
--   VALIDATED  — may adopt a result into the register; CANNOT be set unless an
--                EngineReview exists for that engine's current version (guarded in
--                src/lib/chemicals/engines/engine-flags.ts and surfaced in the UI).
-- Defaults are resolved from APP_ENVIRONMENT (one resolver, not scattered ifs):
-- production → OFF for new tenants (the demo tenant is set to PREVIEW by its seed,
-- §5); sandbox → PREVIEW (branch prepared, not used yet). Every change is audited.
--
-- EngineFlagSetting is per-tenant (company-scoped RLS). EngineReview is per engine
-- VERSION, not per tenant → global/system, shared-read RLS (P13 §1).

CREATE TYPE "EngineFlagState" AS ENUM ('OFF', 'PREVIEW', 'VALIDATED');

CREATE TABLE "EngineFlagSetting" (
    "id"          TEXT NOT NULL,
    "engineKey"   TEXT NOT NULL,
    "companyId"   TEXT NOT NULL,
    "state"       "EngineFlagState" NOT NULL DEFAULT 'OFF',
    "setByUserId" UUID,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EngineFlagSetting_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EngineFlagSetting_engineKey_companyId_key" ON "EngineFlagSetting"("engineKey", "companyId");
CREATE INDEX "EngineFlagSetting_companyId_idx" ON "EngineFlagSetting"("companyId");
ALTER TABLE "EngineFlagSetting" ADD CONSTRAINT "EngineFlagSetting_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "EngineReview" (
    "id"                   TEXT NOT NULL,
    "engineKey"            TEXT NOT NULL,
    "engineVersion"        TEXT NOT NULL,
    "reviewerName"         TEXT NOT NULL,
    "reviewerQualification" TEXT NOT NULL,
    "reviewedAt"           TIMESTAMP(3) NOT NULL,
    "scope"                TEXT NOT NULL,
    "notes"                TEXT,
    "createdByUserId"      UUID,
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EngineReview_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EngineReview_engineKey_engineVersion_key" ON "EngineReview"("engineKey", "engineVersion");

ALTER TABLE "EngineFlagSetting" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EngineReview" ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_rls ON "EngineFlagSetting" FOR ALL TO statura_app
  USING ("companyId" = ANY(app_company_ids())) WITH CHECK ("companyId" = ANY(app_company_ids()));
CREATE POLICY app_rls ON "EngineReview" FOR ALL TO statura_app USING (true) WITH CHECK (true);
