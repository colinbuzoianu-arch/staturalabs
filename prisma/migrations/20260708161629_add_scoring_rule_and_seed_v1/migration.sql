-- CreateEnum
CREATE TYPE "RiskBand" AS ENUM ('LOW', 'MODERATE', 'ELEVATED', 'HIGH');

-- CreateTable
CREATE TABLE "ScoringRule" (
    "id" TEXT NOT NULL,
    "methodologyVersion" TEXT NOT NULL,
    "bodyRegion" "BodyRegion" NOT NULL,
    "riskBand" "RiskBand" NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "angleMin" DOUBLE PRECISION,
    "angleMax" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoringRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScoringRule_methodologyVersion_bodyRegion_idx" ON "ScoringRule"("methodologyVersion", "bodyRegion");

ALTER TABLE "ScoringRule" ENABLE ROW LEVEL SECURITY;

-- Seed data: methodologyVersion 'v1-2026-07', founder-authored thresholds.
-- Angles are flexion-from-neutral degrees (0° = upright/anatomical
-- position). Reconciled from the source list onto the schema's BodyRegion
-- enum:
--   TRUNK, NECK        -> used as-is, already exact matches.
--   SHOULDER           -> duplicated onto SHOULDER_LEFT and SHOULDER_RIGHT
--                         (thresholds don't differ by side).
--   KNEE               -> duplicated onto KNEE_LEFT and KNEE_RIGHT, same reason.
--   ELBOW              -> duplicated onto ELBOW_LEFT and ELBOW_RIGHT (see the
--                         previous migration adding those enum values —
--                         elbow was not represented at all before this).
-- ELBOW's HIGH band intentionally has two disjoint rows (angle > 100, and
-- angle < 20): risk at both hyper-flexion and hyper-extension, with LOW as
-- the single safe range in between.
INSERT INTO "ScoringRule" ("id", "methodologyVersion", "bodyRegion", "riskBand", "riskScore", "angleMin", "angleMax") VALUES
  (gen_random_uuid()::text, 'v1-2026-07', 'TRUNK', 'LOW', 1, 0, 20),
  (gen_random_uuid()::text, 'v1-2026-07', 'TRUNK', 'MODERATE', 2, 20, 60),
  (gen_random_uuid()::text, 'v1-2026-07', 'TRUNK', 'HIGH', 3, 60, NULL),

  (gen_random_uuid()::text, 'v1-2026-07', 'NECK', 'LOW', 1, 0, 10),
  (gen_random_uuid()::text, 'v1-2026-07', 'NECK', 'MODERATE', 2, 10, 25),
  (gen_random_uuid()::text, 'v1-2026-07', 'NECK', 'HIGH', 3, 25, NULL),

  (gen_random_uuid()::text, 'v1-2026-07', 'SHOULDER_LEFT', 'LOW', 1, 0, 20),
  (gen_random_uuid()::text, 'v1-2026-07', 'SHOULDER_LEFT', 'MODERATE', 2, 20, 45),
  (gen_random_uuid()::text, 'v1-2026-07', 'SHOULDER_LEFT', 'ELEVATED', 3, 45, 90),
  (gen_random_uuid()::text, 'v1-2026-07', 'SHOULDER_LEFT', 'HIGH', 4, 90, NULL),

  (gen_random_uuid()::text, 'v1-2026-07', 'SHOULDER_RIGHT', 'LOW', 1, 0, 20),
  (gen_random_uuid()::text, 'v1-2026-07', 'SHOULDER_RIGHT', 'MODERATE', 2, 20, 45),
  (gen_random_uuid()::text, 'v1-2026-07', 'SHOULDER_RIGHT', 'ELEVATED', 3, 45, 90),
  (gen_random_uuid()::text, 'v1-2026-07', 'SHOULDER_RIGHT', 'HIGH', 4, 90, NULL),

  (gen_random_uuid()::text, 'v1-2026-07', 'ELBOW_LEFT', 'LOW', 1, 20, 100),
  (gen_random_uuid()::text, 'v1-2026-07', 'ELBOW_LEFT', 'HIGH', 3, 100, NULL),
  (gen_random_uuid()::text, 'v1-2026-07', 'ELBOW_LEFT', 'HIGH', 3, NULL, 20),

  (gen_random_uuid()::text, 'v1-2026-07', 'ELBOW_RIGHT', 'LOW', 1, 20, 100),
  (gen_random_uuid()::text, 'v1-2026-07', 'ELBOW_RIGHT', 'HIGH', 3, 100, NULL),
  (gen_random_uuid()::text, 'v1-2026-07', 'ELBOW_RIGHT', 'HIGH', 3, NULL, 20),

  (gen_random_uuid()::text, 'v1-2026-07', 'KNEE_LEFT', 'LOW', 1, 0, 10),
  (gen_random_uuid()::text, 'v1-2026-07', 'KNEE_LEFT', 'MODERATE', 2, 10, 60),
  (gen_random_uuid()::text, 'v1-2026-07', 'KNEE_LEFT', 'HIGH', 3, 60, NULL),

  (gen_random_uuid()::text, 'v1-2026-07', 'KNEE_RIGHT', 'LOW', 1, 0, 10),
  (gen_random_uuid()::text, 'v1-2026-07', 'KNEE_RIGHT', 'MODERATE', 2, 10, 60),
  (gen_random_uuid()::text, 'v1-2026-07', 'KNEE_RIGHT', 'HIGH', 3, 60, NULL);
