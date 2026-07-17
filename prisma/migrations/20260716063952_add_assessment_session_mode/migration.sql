-- Adds AssessmentSession.mode (§3.11, ERGO_COMPLIANCE_BY_DESIGN.md): an
-- explicit, always-recorded field for which capture regime produced a
-- session's data, never inferable or defaulted implicitly. CONTINUOUS is a
-- real enum value now but has no implementation anywhere in the app yet —
-- see createAssessmentSession() (src/lib/assessment-session/create-
-- assessment-session.ts), which throws if asked to create one.
--
-- Brand-new enum type, so (unlike ALTER TYPE ... ADD VALUE on an existing
-- enum) it can be created and used in the same migration/transaction —
-- same as PlatformRole/CameraAngle etc. in earlier migrations. No two-step
-- split needed here.
-- CreateEnum
CREATE TYPE "AssessmentMode" AS ENUM ('SCHEDULED', 'CONTINUOUS');

-- AlterTable: add the column nullable, with no default yet. The backfill
-- below is therefore a real, explicit statement this migration makes, not
-- something riding along on a DEFAULT clause — "the default was scheduled"
-- is exactly the kind of implicit assumption this field exists to
-- eliminate, so it doesn't get to sneak back in via the backfill either.
ALTER TABLE "AssessmentSession" ADD COLUMN "mode" "AssessmentMode";

-- Explicit backfill: every session that predates this column was, in
-- fact, a scheduled/discrete capture — continuous mode has no
-- implementation to have produced any of these rows.
UPDATE "AssessmentSession" SET "mode" = 'SCHEDULED';

-- Now that every existing row has a value, lock the column down: NOT NULL,
-- with SCHEDULED as the default for future inserts that don't specify a
-- mode (createAssessmentSession still gates CONTINUOUS at the application
-- layer regardless of what the column default allows).
ALTER TABLE "AssessmentSession" ALTER COLUMN "mode" SET NOT NULL;
ALTER TABLE "AssessmentSession" ALTER COLUMN "mode" SET DEFAULT 'SCHEDULED';
