-- Sicherheitsinformationen slice 4 — enums only (standing gotcha: a new enum
-- value cannot be referenced in the migration that adds it).
--
-- BROADCAST_NOTICE: the printable notice-board version, archived in the
-- content-addressed GeneratedDocument archive like every other generated PDF.
-- BROADCAST_CONFIRMATION: the retention record type for the per-person
-- confirmation list. POLICY_DEFAULT, 5 years from publication — there is NO
-- statutory period for proof that information was passed on (same honest
-- finding as the instruction records in P7d §C), so no STATUTORY row is seeded.

ALTER TYPE "GeneratedDocumentType" ADD VALUE 'BROADCAST_NOTICE';
ALTER TYPE "RetentionRecordType" ADD VALUE 'BROADCAST_CONFIRMATION';
