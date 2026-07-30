-- Migration A of 5 for the process/risk/action register
-- (SLD_IMPLEMENTATION_PLAN_demo-loop.md M2). Enums only, no tables, no
-- columns: a brand-new enum value can never be referenced (in a CHECK, a
-- seed INSERT, a NOT NULL column, etc.) in the same migration that adds
-- it — Postgres requires the enum-creation migration to be applied first,
-- separately. Same rule already documented in CLAUDE.md's "known gotchas"
-- and followed for AssessmentMode/CameraAngle/PlatformRole earlier.
-- CreateEnum
CREATE TYPE "OrgUnitType" AS ENUM ('PLANT', 'DEPARTMENT', 'AREA', 'LINE');

-- CreateEnum
CREATE TYPE "ProcessStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "HazardCategory" AS ENUM (
  'PHYSICAL_MECHANICAL', 'NOISE', 'VIBRATION', 'LIGHTING', 'CLIMATE_THERMAL',
  'CHEMICAL', 'DUST_PARTICULATE', 'BIOLOGICAL', 'ERGONOMIC_MSD',
  'PSYCHOSOCIAL', 'ELECTRICAL', 'FIRE_EXPLOSION', 'RADIATION'
);

-- CreateEnum
CREATE TYPE "RiskAssessmentStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'IMPLEMENTED', 'VERIFIED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "HierarchyOfControl" AS ENUM (
  'ELIMINATION', 'SUBSTITUTION', 'ENGINEERING_CONTROL',
  'ADMINISTRATIVE_CONTROL', 'PPE'
);

-- CreateEnum
CREATE TYPE "VerificationOutcome" AS ENUM ('EFFECTIVE', 'PARTIALLY_EFFECTIVE', 'NOT_EFFECTIVE');
