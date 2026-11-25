-- P17 §5 (SLD_P17_TENANT_ROLES_APPROVED.md): accounts for all employees,
-- including people without a company e-mail.
--
-- 1) Tenant switch "Mitarbeitenden-Konten aktivieren" — default OFF, so a
--    company can run with EHS roles only until it decides otherwise. Every
--    provisioning path is fail-closed on it (src/lib/people/employee-account.ts).
-- 2) Person.email — optional work e-mail, people-compartment data. It only
--    decides the provisioning path (invite vs. access code). No FK anywhere
--    near the assessment chain, same as every other person column.
-- 3) EmployeeAccessCode — the one-time "personnel number + code" claim. Only
--    the SHA-256 hash of the code is stored (the plaintext is shown once on the
--    hand-over sheet), single-use via usedAt, expiring via expiresAt.
--
-- Hand-added constructs to re-verify live after `migrate deploy`:
--   * EmployeeAccessCode: RLS enabled + policy app_rls (company GUC root),
--     unique index on "codeHash", FK to Person ON DELETE RESTRICT.
--   * Person: new index on "platformUserId".

ALTER TABLE "Company" ADD COLUMN "employeeAccountsEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Person" ADD COLUMN "email" TEXT;
CREATE INDEX "Person_platformUserId_idx" ON "Person"("platformUserId");

CREATE TABLE "EmployeeAccessCode" (
    "id"              TEXT NOT NULL,
    "companyId"       TEXT NOT NULL,
    "personId"        TEXT NOT NULL,
    "platformUserId"  UUID NOT NULL,
    "codeHash"        TEXT NOT NULL,
    "expiresAt"       TIMESTAMP(3) NOT NULL,
    "usedAt"          TIMESTAMP(3),
    "revokedAt"       TIMESTAMP(3),
    "createdByUserId" UUID,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmployeeAccessCode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmployeeAccessCode_codeHash_key" ON "EmployeeAccessCode"("codeHash");
CREATE INDEX "EmployeeAccessCode_companyId_idx" ON "EmployeeAccessCode"("companyId");
CREATE INDEX "EmployeeAccessCode_personId_idx" ON "EmployeeAccessCode"("personId");
ALTER TABLE "EmployeeAccessCode" ADD CONSTRAINT "EmployeeAccessCode_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Company-scoped root table (P13 §1 pattern: companyId against the GUC set by
-- the runtime role). The redemption path itself runs as the owner connection
-- (it is unauthenticated by definition — the code IS the credential).
ALTER TABLE "EmployeeAccessCode" ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_rls ON "EmployeeAccessCode" FOR ALL TO statura_app
  USING ("companyId" = ANY (app_company_ids()))
  WITH CHECK ("companyId" = ANY (app_company_ids()));
