-- P7d §B.1: RoleAssignment + backfill of the existing roles with NO change in
-- effective access. company_admin → (COMPANY, null); site_admin → one (SITE,
-- siteId) row per existing SiteAssignment. super_admin/l3_support are
-- platform-level (above tenancy) and are intentionally NOT given rows — their
-- access stays in the role switch, unchanged. RLS on; scopeId is a plain
-- column (no FK). Hand-added CHECK: scopeId null exactly for COMPANY/SELF.

CREATE TABLE "RoleAssignment" (
    "id" TEXT NOT NULL,
    "platformUserId" UUID NOT NULL,
    "role" "PlatformRole" NOT NULL,
    "scopeType" "ScopeType" NOT NULL,
    "scopeId" TEXT,
    "grantedByUserId" UUID,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "RoleAssignment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RoleAssignment_platformUserId_idx" ON "RoleAssignment"("platformUserId");
CREATE INDEX "RoleAssignment_scopeType_scopeId_idx" ON "RoleAssignment"("scopeType", "scopeId");
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_platformUserId_fkey" FOREIGN KEY ("platformUserId") REFERENCES "PlatformUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- scopeId present exactly when the scope needs one (SITE / ORG_UNIT).
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_scope_shape_check"
  CHECK (
    (("scopeType" IN ('COMPANY', 'SELF')) AND "scopeId" IS NULL)
    OR (("scopeType" IN ('SITE', 'ORG_UNIT')) AND "scopeId" IS NOT NULL)
  );
ALTER TABLE "RoleAssignment" ENABLE ROW LEVEL SECURITY;

-- Backfill: company_admin → COMPANY-scope row.
INSERT INTO "RoleAssignment" ("id", "platformUserId", "role", "scopeType", "scopeId", "grantedAt")
SELECT gen_random_uuid()::text, u."id", 'COMPANY_ADMIN', 'COMPANY', NULL, CURRENT_TIMESTAMP
FROM "PlatformUser" u
WHERE u."role" = 'COMPANY_ADMIN';

-- Backfill: site_admin → one SITE-scope row per existing SiteAssignment.
INSERT INTO "RoleAssignment" ("id", "platformUserId", "role", "scopeType", "scopeId", "grantedAt")
SELECT gen_random_uuid()::text, sa."userId", 'SITE_ADMIN', 'SITE', sa."siteId", CURRENT_TIMESTAMP
FROM "SiteAssignment" sa
JOIN "PlatformUser" u ON u."id" = sa."userId"
WHERE u."role" = 'SITE_ADMIN';
