-- P7d §B.1 (SLD_P7B_DEFERRALS_RESOLVED.md). Enum changes only (standing
-- gotcha): add the three provisionable roles to PlatformRole and create the
-- ScopeType enum. The RoleAssignment table that uses them lands next.
ALTER TYPE "PlatformRole" ADD VALUE 'EHS_SPECIALIST';
ALTER TYPE "PlatformRole" ADD VALUE 'MANAGER';
ALTER TYPE "PlatformRole" ADD VALUE 'EMPLOYEE';
CREATE TYPE "ScopeType" AS ENUM ('COMPANY', 'SITE', 'ORG_UNIT', 'SELF');
