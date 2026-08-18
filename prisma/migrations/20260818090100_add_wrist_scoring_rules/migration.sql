-- B8e (SLD_NEXT_STEPS_B8b-B8f.md): WRIST_LEFT/WRIST_RIGHT already exist in
-- the BodyRegion enum (added early, never seeded) — this is the first
-- ScoringRule content for either one, made possible without any camera
-- work at all: manual entry doesn't need a MediaPipe wrist-angle formula
-- (which doesn't exist — see CLAUDE.md's known limitations, Pose
-- Landmarker's single wrist point can't give true wrist deviation, that
-- needs Hand Landmarker), only an assessor typing a measured angle. No
-- enum change here, so no enum-only-migration-first split is needed —
-- WRIST_LEFT/WRIST_RIGHT are pre-existing values.
--
-- Seeded directly under the currently-active 'v2-2026-08'
-- MethodologyVersion — a brand-new capability with no v1 wrist rows to
-- preserve parity against, same reasoning as B8's ManualHandlingRule and
-- B8d's RepetitionRule.
--
-- Thresholds are SLD's own, independently designed and inspired by RULA/
-- REBA-style wrist-posture scoring's general "risk rises with deviation
-- from neutral in either direction" principle (flexion AND extension both
-- penalized, radial/ulnar deviation not modeled — out of scope, this app
-- has no camera or manual-entry path that measures that second axis) —
-- NOT a reproduction of any specific published wrist-angle threshold
-- table. Same two-tier, symmetric-about-neutral shape ELBOW_LEFT/RIGHT
-- already uses in this table (LOW in the middle band, HIGH on both
-- disjoint extremes, same riskScore on both HIGH rows) — deliberately not
-- a four-tier LOW/MODERATE/ELEVATED/HIGH shape, since this app has no
-- stronger basis yet for two intermediate cutoffs on top of the
-- neutral-vs-deviated distinction.
--
-- Angles are flexion-from-neutral degrees (0° = neutral wrist), same
-- convention as every other region — positive values read as flexion,
-- negative as extension, exactly as NECK already establishes for a
-- signed region.
INSERT INTO "ScoringRule" ("id", "methodologyVersion", "bodyRegion", "riskBand", "riskScore", "angleMin", "angleMax") VALUES
  (gen_random_uuid()::text, 'v2-2026-08', 'WRIST_LEFT', 'LOW', 1, -15, 15),
  (gen_random_uuid()::text, 'v2-2026-08', 'WRIST_LEFT', 'HIGH', 3, 15, NULL),
  (gen_random_uuid()::text, 'v2-2026-08', 'WRIST_LEFT', 'HIGH', 3, NULL, -15),
  (gen_random_uuid()::text, 'v2-2026-08', 'WRIST_RIGHT', 'LOW', 1, -15, 15),
  (gen_random_uuid()::text, 'v2-2026-08', 'WRIST_RIGHT', 'HIGH', 3, 15, NULL),
  (gen_random_uuid()::text, 'v2-2026-08', 'WRIST_RIGHT', 'HIGH', 3, NULL, -15);
