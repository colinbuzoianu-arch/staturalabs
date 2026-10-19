-- H2 (SLD_IMPLEMENTATION_PLAN_hazards-and-environment.md §4.2): the
-- PostureZoneRule/PostureZoneScore tables and a NEW methodology version
-- v3-2026-10 that copies every v2-2026-08 rule forward unchanged and adds
-- the 45 zone rules. Seeded INACTIVE here; activation is a separate
-- migration (20261016130200_activate_v3_methodology) applied only AFTER a
-- live re-score parity check proves every existing sample scores
-- identically under v2 and v3 — the same two-step discipline as B3.

-- CreateTable
CREATE TABLE "PostureZoneRule" (
    "id" TEXT NOT NULL,
    "methodologyVersion" TEXT NOT NULL,
    "zone" "BodyZone" NOT NULL,
    "level" "ZoneLoadLevel" NOT NULL,
    "share" "ExposureShare" NOT NULL,
    "riskBand" "RiskBand" NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostureZoneRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PostureZoneRule_methodologyVersion_zone_level_share_key" ON "PostureZoneRule"("methodologyVersion", "zone", "level", "share");
CREATE INDEX "PostureZoneRule_methodologyVersion_idx" ON "PostureZoneRule"("methodologyVersion");
ALTER TABLE "PostureZoneRule" ADD CONSTRAINT "PostureZoneRule_methodologyVersion_fkey" FOREIGN KEY ("methodologyVersion") REFERENCES "MethodologyVersion"("version") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PostureZoneRule" ENABLE ROW LEVEL SECURITY;

-- CreateTable
CREATE TABLE "PostureZoneScore" (
    "id" TEXT NOT NULL,
    "postureSampleId" TEXT NOT NULL,
    "zone" "BodyZone" NOT NULL,
    "level" "ZoneLoadLevel" NOT NULL,
    "share" "ExposureShare" NOT NULL,
    "riskBand" "RiskBand" NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "methodologyVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostureZoneScore_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PostureZoneScore_postureSampleId_zone_key" ON "PostureZoneScore"("postureSampleId", "zone");
CREATE INDEX "PostureZoneScore_postureSampleId_idx" ON "PostureZoneScore"("postureSampleId");
ALTER TABLE "PostureZoneScore" ADD CONSTRAINT "PostureZoneScore_postureSampleId_fkey" FOREIGN KEY ("postureSampleId") REFERENCES "PostureSample"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PostureZoneScore" ENABLE ROW LEVEL SECURITY;

-- Seed v3-2026-10, INACTIVE. Activation is deferred to the next migration,
-- after the parity check.
INSERT INTO "MethodologyVersion" ("version", "isActive", "activatedAt")
VALUES ('v3-2026-10', false, CURRENT_TIMESTAMP);

-- Copy every v2-2026-08 rule forward VERBATIM (INSERT ... SELECT, not
-- re-typed literals) so the parity check can prove the copy is faithful.
-- New ids; same values; methodologyVersion rewritten to v3. None of these
-- tables has a CHECK constraint, so the "Postgres re-evaluates CHECKs on
-- touched rows" gotcha B2/B3 hit doesn't apply here.
INSERT INTO "ScoringRule" ("id", "methodologyVersion", "bodyRegion", "riskBand", "riskScore", "angleMin", "angleMax", "createdAt")
SELECT gen_random_uuid()::text, 'v3-2026-10', "bodyRegion", "riskBand", "riskScore", "angleMin", "angleMax", CURRENT_TIMESTAMP
FROM "ScoringRule" WHERE "methodologyVersion" = 'v2-2026-08';

INSERT INTO "HoldTimeRule" ("id", "methodologyVersion", "postureRiskBand", "maxHoldSeconds", "createdAt")
SELECT gen_random_uuid()::text, 'v3-2026-10', "postureRiskBand", "maxHoldSeconds", CURRENT_TIMESTAMP
FROM "HoldTimeRule" WHERE "methodologyVersion" = 'v2-2026-08';

INSERT INTO "ManualHandlingRule" ("id", "methodologyVersion", "riskBand", "riskScore", "minKg", "maxKg", "createdAt")
SELECT gen_random_uuid()::text, 'v3-2026-10', "riskBand", "riskScore", "minKg", "maxKg", CURRENT_TIMESTAMP
FROM "ManualHandlingRule" WHERE "methodologyVersion" = 'v2-2026-08';

INSERT INTO "RepetitionRule" ("id", "methodologyVersion", "riskBand", "riskScore", "minReps", "maxReps", "createdAt")
SELECT gen_random_uuid()::text, 'v3-2026-10', "riskBand", "riskScore", "minReps", "maxReps", CURRENT_TIMESTAMP
FROM "RepetitionRule" WHERE "methodologyVersion" = 'v2-2026-08';

-- The 45 zone rules (founder-authored, not CC-invented — §4.2/§8). Base
-- table for every zone:
--   LOW   level: LOW(1) at every share.
--   MED   level: LOW(1) rare / MODERATE(2) occasional / ELEVATED(3) predominant.
--   HIGH  level: MODERATE(2) rare / ELEVATED(3) occasional / HIGH(4) predominant.
-- Exception for TRUNK and SHOULDERS_ARMS: HIGH level + OCCASIONAL share is
-- HIGH(4), not ELEVATED(3) — heavy bending and overhead work are the
-- classic back/shoulder injury causes even when only occasional.
INSERT INTO "PostureZoneRule" ("id", "methodologyVersion", "zone", "level", "share", "riskBand", "riskScore", "createdAt") VALUES
  -- HEAD_NECK (base)
  (gen_random_uuid()::text, 'v3-2026-10', 'HEAD_NECK', 'LOW', 'RARE', 'LOW', 1, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'v3-2026-10', 'HEAD_NECK', 'LOW', 'OCCASIONAL', 'LOW', 1, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'v3-2026-10', 'HEAD_NECK', 'LOW', 'PREDOMINANT', 'LOW', 1, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'v3-2026-10', 'HEAD_NECK', 'MEDIUM', 'RARE', 'LOW', 1, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'v3-2026-10', 'HEAD_NECK', 'MEDIUM', 'OCCASIONAL', 'MODERATE', 2, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'v3-2026-10', 'HEAD_NECK', 'MEDIUM', 'PREDOMINANT', 'ELEVATED', 3, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'v3-2026-10', 'HEAD_NECK', 'HIGH', 'RARE', 'MODERATE', 2, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'v3-2026-10', 'HEAD_NECK', 'HIGH', 'OCCASIONAL', 'ELEVATED', 3, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'v3-2026-10', 'HEAD_NECK', 'HIGH', 'PREDOMINANT', 'HIGH', 4, CURRENT_TIMESTAMP),
  -- HANDS_WRISTS (base)
  (gen_random_uuid()::text, 'v3-2026-10', 'HANDS_WRISTS', 'LOW', 'RARE', 'LOW', 1, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'v3-2026-10', 'HANDS_WRISTS', 'LOW', 'OCCASIONAL', 'LOW', 1, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'v3-2026-10', 'HANDS_WRISTS', 'LOW', 'PREDOMINANT', 'LOW', 1, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'v3-2026-10', 'HANDS_WRISTS', 'MEDIUM', 'RARE', 'LOW', 1, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'v3-2026-10', 'HANDS_WRISTS', 'MEDIUM', 'OCCASIONAL', 'MODERATE', 2, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'v3-2026-10', 'HANDS_WRISTS', 'MEDIUM', 'PREDOMINANT', 'ELEVATED', 3, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'v3-2026-10', 'HANDS_WRISTS', 'HIGH', 'RARE', 'MODERATE', 2, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'v3-2026-10', 'HANDS_WRISTS', 'HIGH', 'OCCASIONAL', 'ELEVATED', 3, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'v3-2026-10', 'HANDS_WRISTS', 'HIGH', 'PREDOMINANT', 'HIGH', 4, CURRENT_TIMESTAMP),
  -- LEGS_KNEES (base)
  (gen_random_uuid()::text, 'v3-2026-10', 'LEGS_KNEES', 'LOW', 'RARE', 'LOW', 1, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'v3-2026-10', 'LEGS_KNEES', 'LOW', 'OCCASIONAL', 'LOW', 1, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'v3-2026-10', 'LEGS_KNEES', 'LOW', 'PREDOMINANT', 'LOW', 1, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'v3-2026-10', 'LEGS_KNEES', 'MEDIUM', 'RARE', 'LOW', 1, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'v3-2026-10', 'LEGS_KNEES', 'MEDIUM', 'OCCASIONAL', 'MODERATE', 2, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'v3-2026-10', 'LEGS_KNEES', 'MEDIUM', 'PREDOMINANT', 'ELEVATED', 3, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'v3-2026-10', 'LEGS_KNEES', 'HIGH', 'RARE', 'MODERATE', 2, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'v3-2026-10', 'LEGS_KNEES', 'HIGH', 'OCCASIONAL', 'ELEVATED', 3, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'v3-2026-10', 'LEGS_KNEES', 'HIGH', 'PREDOMINANT', 'HIGH', 4, CURRENT_TIMESTAMP),
  -- TRUNK (exception: HIGH+OCCASIONAL -> HIGH)
  (gen_random_uuid()::text, 'v3-2026-10', 'TRUNK', 'LOW', 'RARE', 'LOW', 1, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'v3-2026-10', 'TRUNK', 'LOW', 'OCCASIONAL', 'LOW', 1, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'v3-2026-10', 'TRUNK', 'LOW', 'PREDOMINANT', 'LOW', 1, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'v3-2026-10', 'TRUNK', 'MEDIUM', 'RARE', 'LOW', 1, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'v3-2026-10', 'TRUNK', 'MEDIUM', 'OCCASIONAL', 'MODERATE', 2, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'v3-2026-10', 'TRUNK', 'MEDIUM', 'PREDOMINANT', 'ELEVATED', 3, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'v3-2026-10', 'TRUNK', 'HIGH', 'RARE', 'MODERATE', 2, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'v3-2026-10', 'TRUNK', 'HIGH', 'OCCASIONAL', 'HIGH', 4, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'v3-2026-10', 'TRUNK', 'HIGH', 'PREDOMINANT', 'HIGH', 4, CURRENT_TIMESTAMP),
  -- SHOULDERS_ARMS (exception: HIGH+OCCASIONAL -> HIGH)
  (gen_random_uuid()::text, 'v3-2026-10', 'SHOULDERS_ARMS', 'LOW', 'RARE', 'LOW', 1, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'v3-2026-10', 'SHOULDERS_ARMS', 'LOW', 'OCCASIONAL', 'LOW', 1, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'v3-2026-10', 'SHOULDERS_ARMS', 'LOW', 'PREDOMINANT', 'LOW', 1, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'v3-2026-10', 'SHOULDERS_ARMS', 'MEDIUM', 'RARE', 'LOW', 1, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'v3-2026-10', 'SHOULDERS_ARMS', 'MEDIUM', 'OCCASIONAL', 'MODERATE', 2, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'v3-2026-10', 'SHOULDERS_ARMS', 'MEDIUM', 'PREDOMINANT', 'ELEVATED', 3, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'v3-2026-10', 'SHOULDERS_ARMS', 'HIGH', 'RARE', 'MODERATE', 2, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'v3-2026-10', 'SHOULDERS_ARMS', 'HIGH', 'OCCASIONAL', 'HIGH', 4, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'v3-2026-10', 'SHOULDERS_ARMS', 'HIGH', 'PREDOMINANT', 'HIGH', 4, CURRENT_TIMESTAMP);
