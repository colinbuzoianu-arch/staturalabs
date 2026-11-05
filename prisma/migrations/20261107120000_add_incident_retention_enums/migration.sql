-- P10e §B: new RetentionRecordType values, enum-first (standing gotcha — can't
-- be referenced in the same migration that adds them). No new trigger needed
-- (RECORD_DATE and END_OF_EMPLOYMENT already exist).
ALTER TYPE "RetentionRecordType" ADD VALUE 'INCIDENT';
ALTER TYPE "RetentionRecordType" ADD VALUE 'INCIDENT_HEALTH';
ALTER TYPE "RetentionRecordType" ADD VALUE 'FIRST_AID_RECORD';
