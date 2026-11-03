-- P6 §6 Gefährdungsbeurteilung extensions (SLD_RESTRUCTURE_PLAN_platform-
-- modules.md). Enum only — the standing gotcha: a new enum value can't be
-- referenced as a column type in the same migration that creates the type.
-- The RiskAssessment columns that use it land in the next migration.

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('ROUTINE', 'NON_ROUTINE');
