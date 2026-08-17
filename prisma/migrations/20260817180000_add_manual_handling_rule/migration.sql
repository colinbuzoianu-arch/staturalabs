-- B8 of the Austria-first plan (SLD_IMPLEMENTATION_PLAN_austria-first.md
-- §7 B8): a manual-handling load-weight sub-score, closing the "LOAD_
-- WEIGHT_KG / PUSH_FORCE_N / PULL_FORCE_N are captured and read by
-- nothing" gap. No new enum needed (RiskBand already exists), so this is
-- a single additive migration — no enum-only-migration-first split
-- required, same as B3's HoldTimeRule.
--
-- Seeded directly under the currently-active 'v2-2026-08'
-- MethodologyVersion, per the plan's explicit "folded into the same v2
-- methodology version" instruction — not a new version bump. Unlike B3's
-- ScoringRule/HoldTimeRule activation (which needed a verbatim-copy +
-- parity-proof dance because v1 already had posture rows that had to
-- keep scoring identically), this is a brand-new capability with no
-- historical row to preserve parity against, so a direct INSERT is
-- sufficient — there is nothing to "not break."
--
-- Thresholds are SLD's own, independently designed and inspired by ISO
-- 11228-1's commonly-cited ~25 kg reference mass under ideal conditions
-- (corroborated via web search against multiple independent secondary
-- sources describing the standard's content, since the standard itself is
-- a paid ISO publication with no free-to-verify primary source the way
-- VOLV/RIS was for B4 — see schema.prisma's doc comment on
-- ManualHandlingRule for the full arm's-length framing) — NOT a
-- reproduction of ISO 11228-1's own Recommended Mass Limit tables or the
-- Revised NIOSH Lifting Equation.

-- CreateTable
CREATE TABLE "ManualHandlingRule" (
    "id" TEXT NOT NULL,
    "methodologyVersion" TEXT NOT NULL,
    "riskBand" "RiskBand" NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "minKg" DOUBLE PRECISION,
    "maxKg" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManualHandlingRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ManualHandlingRule_methodologyVersion_idx" ON "ManualHandlingRule"("methodologyVersion");

-- AddForeignKey
ALTER TABLE "ManualHandlingRule" ADD CONSTRAINT "ManualHandlingRule_methodologyVersion_fkey" FOREIGN KEY ("methodologyVersion") REFERENCES "MethodologyVersion"("version") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ManualHandlingRule" ENABLE ROW LEVEL SECURITY;

-- Seed: [minKg, maxKg) inclusive-min/exclusive-max, same convention as
-- ScoringRule's angle ranges. riskScore follows the same 1/2/3/4 LOW/
-- MODERATE/ELEVATED/HIGH scale ScoringRule's own SHOULDER rows already
-- use (not RiskMatrixCell's separate probability×severity scale, which
-- is a different vocabulary for a different chain).
INSERT INTO "ManualHandlingRule" ("id", "methodologyVersion", "riskBand", "riskScore", "minKg", "maxKg") VALUES
  (gen_random_uuid()::text, 'v2-2026-08', 'LOW', 1, 0, 10),
  (gen_random_uuid()::text, 'v2-2026-08', 'MODERATE', 2, 10, 15),
  (gen_random_uuid()::text, 'v2-2026-08', 'ELEVATED', 3, 15, 25),
  (gen_random_uuid()::text, 'v2-2026-08', 'HIGH', 4, 25, NULL);
