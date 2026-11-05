-- P11 Rechtskataster: enums first (standing gotcha — a new enum can't be used
-- in the same migration that adds it).
CREATE TYPE "LegalDomain" AS ENUM ('OSH', 'ENVIRONMENT');
CREATE TYPE "SiteLegalRequirementStatus" AS ENUM ('OPEN', 'APPLICABLE', 'NOT_APPLICABLE');
CREATE TYPE "ComplianceState" AS ENUM (
  'NOT_EVALUATED', 'COMPLIANT', 'PARTIALLY_COMPLIANT', 'NON_COMPLIANT', 'NOT_APPLICABLE'
);
