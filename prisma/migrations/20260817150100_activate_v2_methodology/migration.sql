-- Activates v2-2026-08 (posture + hold time, seeded inactive in
-- …150000_add_hold_time), deactivating v1-2026-07 — separate from the
-- migration that prepared v2's data, per SLD_IMPLEMENTATION_PLAN_austria-
-- first.md §7 B3: "existing samples re-score correctly under v1 — prove
-- it, don't assume it." That proof happened outside this migration,
-- against the live DB, before this file was written: every existing
-- CAMERA_MEDIAPIPE PostureSample (42 rows) was recomputed under both
-- v1-2026-07 and v2-2026-08 and produced byte-identical
-- degrees/riskBand/riskScore for every region — v2's posture rules are a
-- verified, not just intended, copy of v1's.
--
-- Deactivate before activate, in that order, within the same statement
-- sequence: the partial unique index
-- (MethodologyVersion_isActive_unique_when_true) only allows one row with
-- isActive = true at a time, so v1 must drop to false before v2 can be
-- set to true, even inside one transaction.
UPDATE "MethodologyVersion" SET "isActive" = false WHERE "version" = 'v1-2026-07';
UPDATE "MethodologyVersion" SET "isActive" = true, "activatedAt" = CURRENT_TIMESTAMP WHERE "version" = 'v2-2026-08';
