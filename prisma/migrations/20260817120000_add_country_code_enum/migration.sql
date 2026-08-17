-- B1a of the Austria-first plan (SLD_IMPLEMENTATION_PLAN_austria-first.md
-- §4.3, §7 B1). Enum only, no tables, no columns: a brand-new enum
-- *value* can't be referenced (in a CHECK, a seed INSERT, a NOT NULL
-- column, etc.) in the same migration that adds it — same rule already
-- documented in CLAUDE.md's "known gotchas" and followed for
-- AssessmentMode/CameraAngle/PlatformRole/the process-risk-action enums
-- earlier. Site.country lands in the next migration.
-- CreateEnum
CREATE TYPE "CountryCode" AS ENUM ('AT', 'DE', 'CH', 'RO');
