-- P1 of the platform-modules restructure plan
-- (SLD_RESTRUCTURE_PLAN_platform-modules.md §2.2 rule 9, §2.4). Two additive
-- tables, both with RLS enabled (no policy — same owner-bypass posture as
-- every other table in this schema until the non-owner runtime role lands;
-- see CLAUDE.md "known gotchas"). Nothing here touches the assessment chain
-- or holds person data: actorUserId / enabledByUserId are PlatformUser
-- account ids only (§3.1/§3.13), never a shop-floor worker.
--
-- The CompanyModule enable-all seed references ModuleKey, which is why the
-- enum lives in the previous migration (20261031120000_add_module_key_enum).
--
-- No hand-added CHECK/partial-index constructs in this migration, so nothing
-- extra to re-verify beyond "both tables exist with RLS" and "every existing
-- company has all 14 module rows."

-- CreateTable: CompanyModule (per-company module entitlement, §2.4)
CREATE TABLE "CompanyModule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "moduleKey" "ModuleKey" NOT NULL,
    "enabledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enabledByUserId" UUID,

    CONSTRAINT "CompanyModule_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CompanyModule_companyId_moduleKey_key" ON "CompanyModule"("companyId", "moduleKey");
CREATE INDEX "CompanyModule_companyId_idx" ON "CompanyModule"("companyId");
ALTER TABLE "CompanyModule" ADD CONSTRAINT "CompanyModule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanyModule" ENABLE ROW LEVEL SECURITY;

-- CreateTable: AuditEvent (global append-only audit log, §2.2 rule 9,
-- ERGO_COMPLIANCE_BY_DESIGN.md §3.18(d)). Deliberately NO foreign keys:
-- the audit log outlives the entity it describes, so companyId/siteId/
-- entityId/actorUserId are plain columns, not relations.
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actorUserId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "companyId" TEXT,
    "siteId" TEXT,
    "diff" JSONB,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditEvent_entityType_entityId_idx" ON "AuditEvent"("entityType", "entityId");
CREATE INDEX "AuditEvent_companyId_idx" ON "AuditEvent"("companyId");
CREATE INDEX "AuditEvent_siteId_idx" ON "AuditEvent"("siteId");
CREATE INDEX "AuditEvent_actorUserId_idx" ON "AuditEvent"("actorUserId");
ALTER TABLE "AuditEvent" ENABLE ROW LEVEL SECURITY;

-- Seed: enable every module for every EXISTING company (the plan's "all
-- modules enabled for demo/dev companies"). Today the only companies in the
-- DB are the dev fixture, the demo fixture and a throwaway test company — all
-- internal — so enabling everything is correct. A future real customer gets
-- its entitlement set explicitly by super_admin at onboarding, not by this
-- backfill. ON CONFLICT keeps the statement safe against the unique
-- (companyId, moduleKey) index.
INSERT INTO "CompanyModule" ("id", "companyId", "moduleKey", "enabledAt")
SELECT gen_random_uuid()::text, c."id", m."key", CURRENT_TIMESTAMP
FROM "Company" c
CROSS JOIN (SELECT unnest(enum_range(NULL::"ModuleKey")) AS "key") m
ON CONFLICT ("companyId", "moduleKey") DO NOTHING;
