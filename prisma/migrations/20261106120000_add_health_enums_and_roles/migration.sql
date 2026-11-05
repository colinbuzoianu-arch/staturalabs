-- P10c: enums + roles first (standing gotcha — a new enum value can't be used
-- in the same migration that adds it, so the PlatformRole CHECK update and the
-- IncidentHealthDetail table land in the next migration).

-- The two remaining §3.3 roles. OCCUPATIONAL_PHYSICIAN holds health_data.*;
-- WORKS_COUNCIL is read-only co-determination.
ALTER TYPE "PlatformRole" ADD VALUE 'OCCUPATIONAL_PHYSICIAN';
ALTER TYPE "PlatformRole" ADD VALUE 'WORKS_COUNCIL';

-- Coarse injury classification (ESAW/GDA-style, hand-authored — NOT a legal
-- code table). Plaintext, for the statutory data sheet and accident KPIs.
CREATE TYPE "InjuryType" AS ENUM (
  'WOUND_LACERATION',
  'BRUISE_CONTUSION',
  'FRACTURE',
  'DISLOCATION_SPRAIN_STRAIN',
  'AMPUTATION',
  'CONCUSSION_INTERNAL_INJURY',
  'BURN_SCALD_FROSTBITE',
  'POISONING_INFECTION',
  'ASPHYXIA_DROWNING',
  'EFFECT_OF_NOISE_VIBRATION',
  'EFFECT_OF_TEMPERATURE_RADIATION',
  'SHOCK',
  'MULTIPLE_INJURIES',
  'OTHER',
  'UNKNOWN'
);

CREATE TYPE "BodyRegionCoarse" AS ENUM (
  'HEAD',
  'NECK',
  'TORSO_BACK',
  'SHOULDER_ARM',
  'HAND_FINGER',
  'HIP_LEG',
  'FOOT_TOE',
  'INTERNAL',
  'MULTIPLE',
  'OTHER',
  'UNKNOWN'
);
