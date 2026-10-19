-- H2 (SLD_IMPLEMENTATION_PLAN_hazards-and-environment.md §4.2): activate
-- v3-2026-10 as the single active methodology, in a SEPARATE migration from
-- the seed — applied only after the re-score parity check.
--
-- Parity proof (run before this migration against the live DB): every
-- v2-2026-08 rule row was confirmed to have a byte-identical-valued
-- v3-2026-10 twin across ScoringRule (35), HoldTimeRule (4),
-- ManualHandlingRule (4) and RepetitionRule (4). Since every score in this
-- engine is a pure function of those rule rows, identical rules guarantee
-- every existing PostureSample re-scores identically under v3 — the v3 copy
-- adds the 45 PostureZoneRule rows and changes nothing else.
--
-- Two statements, in order: clear the current active row first (so the
-- partial unique index MethodologyVersion_isActive_unique_when_true never
-- sees two active rows mid-migration), then set v3 active.
UPDATE "MethodologyVersion" SET "isActive" = false WHERE "isActive" = true;
UPDATE "MethodologyVersion" SET "isActive" = true, "activatedAt" = CURRENT_TIMESTAMP WHERE "version" = 'v3-2026-10';
