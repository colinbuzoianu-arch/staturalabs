-- Migration A of 2 for PostureSample human-validation support. Enum only,
-- no columns: a brand-new enum value can never be referenced (in a CHECK,
-- a NOT NULL column, etc.) in the same migration that adds it — Postgres
-- requires the enum-creation migration to be applied first, separately.
-- Same rule already documented in CLAUDE.md's "known gotchas" and
-- followed for AssessmentMode/OrgUnitType/etc. earlier.
-- CreateEnum
CREATE TYPE "ValidationStatus" AS ENUM ('PENDING_REVIEW', 'VALIDATED');
