-- B8d (SLD_NEXT_STEPS_B8b-B8f.md): a repetition-count sub-score, closing
-- the "REPETITION_COUNT is captured, displayed, and read by nothing" gap
-- — with posture, hold-time, and manual-handling all scored, a high-rep
-- low-load task showed three green sub-scores and nothing catching the
-- false negative. No new enum needed (RiskBand already exists), so this
-- is a single additive migration, same shape as B8's ManualHandlingRule
-- migration.
--
-- Seeded directly under the currently-active 'v2-2026-08'
-- MethodologyVersion, per the plan's explicit "folded into the same v2
-- methodology version" instruction — a brand-new capability with no
-- historical row to preserve parity against, so a direct INSERT is
-- sufficient.
--
-- Thresholds are SLD's own, independently designed and inspired by ISO
-- 11228-3's general "higher repetition frequency raises risk" principle —
-- NOT a reproduction of ISO 11228-3's own frequency (repetitions/minute)
-- tables or EN 1005-5's OCRA-derived multiplier method, both of which
-- need cycle-time/recovery-time data this app doesn't collect in v1 (see
-- schema.prisma's doc comment on RepetitionRule for the full arm's-length
-- framing, and the plan's own explicit "no frequency calculation
-- introduced" scope boundary). Scores REPETITION_COUNT directly as reps
-- per task cycle.

-- CreateTable
CREATE TABLE "RepetitionRule" (
    "id" TEXT NOT NULL,
    "methodologyVersion" TEXT NOT NULL,
    "riskBand" "RiskBand" NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "minReps" DOUBLE PRECISION,
    "maxReps" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepetitionRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RepetitionRule_methodologyVersion_idx" ON "RepetitionRule"("methodologyVersion");

-- AddForeignKey
ALTER TABLE "RepetitionRule" ADD CONSTRAINT "RepetitionRule_methodologyVersion_fkey" FOREIGN KEY ("methodologyVersion") REFERENCES "MethodologyVersion"("version") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RepetitionRule" ENABLE ROW LEVEL SECURITY;

-- Seed: [minReps, maxReps) inclusive-min/exclusive-max, same convention as
-- ManualHandlingRule's kg ranges. riskScore follows the same 1/2/3/4
-- LOW/MODERATE/ELEVATED/HIGH scale ManualHandlingRule's own rows use.
INSERT INTO "RepetitionRule" ("id", "methodologyVersion", "riskBand", "riskScore", "minReps", "maxReps") VALUES
  (gen_random_uuid()::text, 'v2-2026-08', 'LOW', 1, 0, 30),
  (gen_random_uuid()::text, 'v2-2026-08', 'MODERATE', 2, 30, 60),
  (gen_random_uuid()::text, 'v2-2026-08', 'ELEVATED', 3, 60, 120),
  (gen_random_uuid()::text, 'v2-2026-08', 'HIGH', 4, 120, NULL);
