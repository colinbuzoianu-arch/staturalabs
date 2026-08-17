-- B2 of the Austria-first plan (SLD_IMPLEMENTATION_PLAN_austria-first.md
-- §5, §7 B2): lets a PostureSample be created from a manually entered
-- angle (goniometer/tape measure) instead of MediaPipe keypoints.
--
-- AlterTable: "source" added nullable first, backfilled explicitly below,
-- then locked to NOT NULL with no column default — same two-step
-- discipline as AssessmentSession.mode and Site.country: "how was this
-- sample obtained" must always be a real, explicit per-row fact, never
-- something that can ride in silently on a DEFAULT clause
-- (ERGO_COMPLIANCE_BY_DESIGN.md §3.16).
--
-- IF NOT EXISTS: an earlier run of this migration failed partway through
-- (the backfill UPDATE below tripped a pre-existing, unrelated CHECK — see
-- the comment above that UPDATE) after this ADD COLUMN had already landed.
-- Resolved via `prisma migrate resolve --rolled-back`, which only clears
-- Prisma's own bookkeeping and does not touch the database — this column
-- addition itself was never reverted, so this statement must tolerate
-- either starting state (column absent, or already present and NULL from
-- that partial run) rather than assume a clean slate.
ALTER TABLE "PostureSample" ADD COLUMN IF NOT EXISTS "source" "PostureSampleSource";

-- The backfill UPDATE below touches every row in the table, and Postgres
-- re-evaluates EVERY CHECK constraint on a row whenever any column on it
-- is updated — including a constraint added NOT VALID, and including
-- columns the UPDATE doesn't even reference. That collides with
-- PostureSample_validation_completeness_check (added NOT VALID in
-- 20260810120100_add_posture_sample_validation specifically to exempt
-- historical rows backfilled to VALIDATED with no validatedKeypoints/
-- validatedAt/validatedByUserId): NOT VALID only skips the *initial* scan
-- of pre-existing rows at ADD CONSTRAINT time, it does not exempt those
-- rows from ordinary future writes, so this migration's own backfill
-- UPDATE would otherwise fail against exactly the legacy rows that
-- constraint was written to protect (confirmed live: the first attempt at
-- this migration failed with that exact violation). Dropping the
-- constraint here and re-adding it, identically and still NOT VALID, at
-- the end of this migration preserves the exact same guarantee for every
-- future write without re-validating history — it is not a weakening of
-- the check, only a way to survive touching unrelated columns on the same
-- rows it already permanently exempts.
ALTER TABLE "PostureSample" DROP CONSTRAINT IF EXISTS "PostureSample_validation_completeness_check";

-- Explicit backfill: every sample that predates this column came from the
-- MediaPipe capture pipeline — manual entry and imported-model paths did
-- not exist yet.
UPDATE "PostureSample" SET "source" = 'CAMERA_MEDIAPIPE' WHERE "source" IS NULL;

ALTER TABLE "PostureSample" ALTER COLUMN "source" SET NOT NULL;

-- "manualAngles" is the manual-entry equivalent of "keypoints": the raw,
-- immutable input an assessor typed in (one angle per computed
-- BodyRegion, flexion-from-neutral convention), stored regardless of
-- whether that angle matched a ScoringRule. It exists specifically so the
-- read side (buildRegionResults' new MANUAL_ENTRY branch,
-- src/lib/capture/build-region-results.ts) can report a "no-matching-rule"
-- region correctly without ever recomputing — BodyRegionScore only ever
-- holds rows for regions that actually matched a rule (see its own model
-- comment), so an entered-but-unmatched angle has nowhere else to live.
ALTER TABLE "PostureSample" ADD COLUMN "manualAngles" JSONB;

-- "keypoints" stops being required: a MANUAL_ENTRY sample has none — the
-- assessor never touched a camera.
ALTER TABLE "PostureSample" ALTER COLUMN "keypoints" DROP NOT NULL;

-- CheckConstraint: enforces keypoints/manualAngles shape by source, same
-- pattern as ManualInput_value_shape_check. Added as a normal (VALIDATED)
-- constraint, not NOT VALID — every existing row was just backfilled to
-- CAMERA_MEDIAPIPE above and already has keypoints IS NOT NULL (the
-- column was NOT NULL until the statement directly above this one) and
-- manualAngles IS NULL (brand-new column, nothing has written to it yet),
-- so every historical row already satisfies the CAMERA_MEDIAPIPE branch
-- with no exceptions to carve out.
-- IMPORTED_MODEL is included for schema completeness (it mirrors
-- CAMERA_MEDIAPIPE's shape — an imported model would supply keypoints
-- too) even though no code path can create one yet.
ALTER TABLE "PostureSample" ADD CONSTRAINT "PostureSample_source_shape_check" CHECK (
  ("source" = 'CAMERA_MEDIAPIPE' AND "keypoints" IS NOT NULL AND "manualAngles" IS NULL) OR
  ("source" = 'MANUAL_ENTRY' AND "keypoints" IS NULL AND "manualAngles" IS NOT NULL) OR
  ("source" = 'IMPORTED_MODEL' AND "keypoints" IS NOT NULL AND "manualAngles" IS NULL)
);

-- "riskBand" on BodyRegionScore: the camera path never needs this (its
-- read side always recomputes region results live from `keypoints`, the
-- same way it always has — see buildRegionResults' CAMERA_MEDIAPIPE
-- branch, unchanged), so it stays NULL for CAMERA_MEDIAPIPE-sourced rows.
-- The manual-entry write path (createPostureSample,
-- src/lib/capture/create-posture-sample.ts) populates it for every row it
-- creates: it already resolves the matching ScoringRule to get `score`,
-- and persisting that same rule's riskBand alongside it is the only
-- correct way to reconstruct a "scored" RegionResult later without
-- re-deriving a band from `score` alone — NECK's non-monotonic rule set
-- (two different HIGH-band rows with two different riskScore values, see
-- CLAUDE.md "Scoring methodology") makes any reverse score-to-band lookup
-- unreliable, so the band is captured as a persisted fact at write time
-- instead.
ALTER TABLE "BodyRegionScore" ADD COLUMN "riskBand" "RiskBand";

-- Re-add PostureSample_validation_completeness_check, dropped above —
-- identical definition, still NOT VALID, restoring the exact same
-- guarantee (and the exact same historical exemption) it had before this
-- migration touched the table. See the DROP CONSTRAINT comment earlier in
-- this file for why it had to come off in the first place.
ALTER TABLE "PostureSample" ADD CONSTRAINT "PostureSample_validation_completeness_check" CHECK (
  "validationStatus" != 'VALIDATED' OR (
    "validatedKeypoints" IS NOT NULL AND
    "validatedAt" IS NOT NULL AND
    "validatedByUserId" IS NOT NULL
  )
) NOT VALID;
