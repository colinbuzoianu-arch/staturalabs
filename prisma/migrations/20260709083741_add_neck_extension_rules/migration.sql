-- Adds NECK backward-extension coverage to v1-2026-07. Pure addition — no
-- existing row is touched. Before this, NECK only had thresholds for 0°
-- and above (forward flexion); a genuinely normal backward-tilted neck had
-- no matching rule at all. angleMin/angleMax use the same [min, max)
-- convention as every other rule.
--
-- The full NECK rule set is now non-monotonic around 0° (magnitude rises
-- in both directions, same shape as ELBOW's rule set) and has two rows
-- each for MODERATE and HIGH — one on each side of neutral, with different
-- riskScores for the two HIGH rows (3 forward, 4 backward). That's
-- intentional: ScoringRule has no uniqueness constraint on
-- (methodologyVersion, bodyRegion, riskBand) for exactly this reason (see
-- the model doc comment in schema.prisma) — matchScoringRule does a real
-- per-row range check, not a band lookup, so this doesn't create ambiguity
-- as long as the ranges themselves stay disjoint (verified: 25 forward
-- HIGH, [10,25) forward MODERATE, [0,10) LOW, [-10,0) backward MODERATE,
-- [-20,-10) backward ELEVATED, backward HIGH below -20 — no overlaps).
INSERT INTO "ScoringRule" ("id", "methodologyVersion", "bodyRegion", "riskBand", "riskScore", "angleMin", "angleMax") VALUES
  (gen_random_uuid()::text, 'v1-2026-07', 'NECK', 'MODERATE', 2, -10, 0),
  (gen_random_uuid()::text, 'v1-2026-07', 'NECK', 'ELEVATED', 3, -20, -10),
  (gen_random_uuid()::text, 'v1-2026-07', 'NECK', 'HIGH', 4, NULL, -20);
