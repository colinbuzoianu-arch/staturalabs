-- P8 slice 6 §3.4. Enums only (standing gotcha: a new enum value can't be
-- referenced in the same migration that adds it). SDS + SUBSTANCE_USE get
-- seeded rows in v2-2026-11; the two SUBSTANCE_EXPOSURE_* values are reserved
-- for P10 (no rows seeded now) so the design stays right. LAST_USE is the new
-- trigger both substance record types use.
ALTER TYPE "RetentionRecordType" ADD VALUE IF NOT EXISTS 'SDS';
ALTER TYPE "RetentionRecordType" ADD VALUE IF NOT EXISTS 'SUBSTANCE_USE';
ALTER TYPE "RetentionRecordType" ADD VALUE IF NOT EXISTS 'SUBSTANCE_EXPOSURE_KM';
ALTER TYPE "RetentionRecordType" ADD VALUE IF NOT EXISTS 'SUBSTANCE_EXPOSURE_R';
ALTER TYPE "RetentionTrigger" ADD VALUE IF NOT EXISTS 'LAST_USE';
