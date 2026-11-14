-- P17 §3: company-editable role bundles. The five tenant-role bundles in
-- src/lib/auth/permissions.ts are SYSTEM DEFAULTS; a company admin may override
-- the bundle for the three tenant roles (EHS staff, leader, employee) within
-- code-enforced guardrails (src/lib/auth/company-role-bundle.ts): never health
-- data, never approval/settings for leader/employee, only known permissions.
-- One row per customized (company, role); its presence means "customized" and
-- `permissions` is the FULL effective set (not a delta). No row → system
-- default. `permissions` is TEXT[] of the Permission vocabulary (code
-- constants, not a DB enum — the vocabulary is versioned in code, §P1).
CREATE TABLE "CompanyRoleBundle" (
    "id"              TEXT NOT NULL,
    "companyId"       TEXT NOT NULL,
    "role"            "PlatformRole" NOT NULL,
    "permissions"     TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "updatedByUserId" UUID,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CompanyRoleBundle_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CompanyRoleBundle_companyId_role_key" ON "CompanyRoleBundle"("companyId", "role");
CREATE INDEX "CompanyRoleBundle_companyId_idx" ON "CompanyRoleBundle"("companyId");
ALTER TABLE "CompanyRoleBundle" ADD CONSTRAINT "CompanyRoleBundle_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CompanyRoleBundle" ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_rls ON "CompanyRoleBundle" FOR ALL TO statura_app
  USING ("companyId" = ANY(app_company_ids()))
  WITH CHECK ("companyId" = ANY(app_company_ids()));
