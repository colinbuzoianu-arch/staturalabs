-- Migration B of 2 for PostureSample human-validation support.
--
-- Adds a human-review layer on top of the original MediaPipe capture:
-- `keypoints` (the immutable original) is NEVER overwritten — it stays the
-- audit-trail record of exactly what MediaPipe produced. `validatedKeypoints`
-- holds a reviewer's adjusted landmark positions, set only once validation
-- happens (or partially, as a saved-but-not-committed draft — see the CHECK
-- comment below).
--
-- Scoring-pipeline behavior (documented here since this migration is what
-- makes it meaningful): POST /api/posture-samples continues to score from
-- the original `keypoints` and sets validationStatus = 'PENDING_REVIEW' on
-- every new sample it creates. Re-scoring from `validatedKeypoints` once a
-- human has adjusted them is a separate server action, not yet built — a
-- later prompt's job, not this migration's.
--
-- AlterTable: add the columns. validationStatus is added nullable first
-- (no default), backfilled explicitly below, then locked to NOT NULL —
-- same two-step discipline as AssessmentSession.mode, so "existing rows
-- are VALIDATED" is a real statement this migration makes, not something
-- riding along on a DEFAULT clause.
ALTER TABLE "PostureSample" ADD COLUMN "validatedKeypoints" JSONB;
ALTER TABLE "PostureSample" ADD COLUMN "validationStatus" "ValidationStatus";
ALTER TABLE "PostureSample" ADD COLUMN "validatedAt" TIMESTAMP(3);
ALTER TABLE "PostureSample" ADD COLUMN "validatedByUserId" UUID;

-- Explicit backfill: every sample that predates this column was already
-- shown to and confirmed by a human through the old capture confirmation
-- flow (the multi-person skeleton-selection step in the capture UI).
-- Treating those as PENDING_REVIEW would retroactively downgrade data that
-- was already acted on (scored, shown on the dashboard, included in
-- reports) — so they're backfilled straight to VALIDATED, not left to a
-- default. There is no real validatedKeypoints/validatedAt/validatedByUserId
-- for these rows (nothing to backfill them with — no reviewer or adjusted
-- keypoints exist for pre-migration samples), so the CHECK constraint added
-- below is only enforced going forward, from the moment it's added, not
-- retroactively against these already-backfilled rows.
UPDATE "PostureSample" SET "validationStatus" = 'VALIDATED';

ALTER TABLE "PostureSample" ALTER COLUMN "validationStatus" SET NOT NULL;

-- CheckConstraint: VALIDATED requires all three completion fields to be
-- set together — you can't be VALIDATED with only some of them. PENDING_REVIEW
-- is unconstrained by this check: a reviewer may save validatedKeypoints as a
-- draft mid-adjustment (adjusted landmarks saved, but validatedAt/
-- validatedByUserId still null because nothing has been committed yet), or
-- leave all three null (not yet touched at all).
--
-- Added NOT VALID deliberately: the backfill above sets validationStatus =
-- 'VALIDATED' on every historical row with validatedKeypoints/validatedAt/
-- validatedByUserId all still NULL (there is no real reviewer or adjusted
-- keypoints to backfill those with for pre-migration samples — they were
-- reviewed through the old capture confirmation flow, which never recorded
-- any of that). A plain ADD CONSTRAINT validates against every existing row
-- synchronously and would fail the migration outright against that backfilled
-- data. NOT VALID skips that one-time check of pre-existing rows while still
-- enforcing the CHECK on every INSERT/UPDATE from this point forward — the
-- exact Postgres mechanism for retrofitting a constraint onto legacy data
-- that can't satisfy it and never will. There is no follow-up VALIDATE
-- CONSTRAINT to run later: these specific historical rows are a permanent,
-- intentional exception, not a to-do.
ALTER TABLE "PostureSample" ADD CONSTRAINT "PostureSample_validation_completeness_check" CHECK (
  "validationStatus" != 'VALIDATED' OR (
    "validatedKeypoints" IS NOT NULL AND
    "validatedAt" IS NOT NULL AND
    "validatedByUserId" IS NOT NULL
  )
) NOT VALID;
