-- H2 of the hazards-and-environment plan
-- (SLD_IMPLEMENTATION_PLAN_hazards-and-environment.md §4): zone-based
-- posture rating (low/medium/high per body zone). Enum-only migration
-- first, per the standing gotcha — a brand-new enum type can't be
-- referenced (in a column, a CHECK, a seed INSERT) in the same migration
-- that creates it. The PostureZoneRule/PostureZoneScore tables and the
-- v3-2026-10 seed land in the next migration.

-- CreateEnum
CREATE TYPE "BodyZone" AS ENUM ('HEAD_NECK', 'TRUNK', 'SHOULDERS_ARMS', 'HANDS_WRISTS', 'LEGS_KNEES');

-- CreateEnum
CREATE TYPE "ZoneLoadLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "ExposureShare" AS ENUM ('RARE', 'OCCASIONAL', 'PREDOMINANT');
