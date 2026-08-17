-- B3 of the Austria-first plan (SLD_IMPLEMENTATION_PLAN_austria-first.md
-- §6, §7 B3): adds the hold-time dimension — closing the "a 2-second
-- reach scores like a 4-hour bend" gap, since v1 only ever scored an
-- instant posture. Deliberately NOT activated by this migration — see the
-- next migration (…150100_activate_v2_methodology) for why the activation
-- step is separate and gated on a live re-scoring parity check.

-- AlterTable: PostureSample.holdDurationSeconds — how long THIS specific
-- captured/entered posture was held, in seconds. Nullable forever (most
-- samples won't record it) — not a two-step NOT NULL backfill like
-- Site.country/PostureSample.source, since there is no "correct" implicit
-- value for historical rows to be backfilled to. NOT the same quantity as
-- ManualInput.DURATION_SECONDS (task-cycle duration) — see both fields'
-- schema.prisma doc comments.
ALTER TABLE "PostureSample" ADD COLUMN "holdDurationSeconds" INTEGER;

-- CreateTable: HoldTimeRule, mirroring ScoringRule's shape/conventions
-- (versioned, methodologyVersion-scoped, Restrict FK) but keyed by the
-- posture's own RiskBand rather than a raw angle range — a deliberately
-- coarser grain, since this is a severity-tier hold-time ceiling, not a
-- region-specific curve. See the schema.prisma model comment for the
-- "independently designed, inspired by ISO 11226, not a reproduction of
-- it" framing — same arm's-length relationship the rest of this scoring
-- engine already has to its reference standards
-- (ERGO_COMPLIANCE_BY_DESIGN.md §3.7).
CREATE TABLE "HoldTimeRule" (
    "id" TEXT NOT NULL,
    "methodologyVersion" TEXT NOT NULL,
    "postureRiskBand" "RiskBand" NOT NULL,
    "maxHoldSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HoldTimeRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HoldTimeRule_methodologyVersion_postureRiskBand_key" ON "HoldTimeRule"("methodologyVersion", "postureRiskBand");

ALTER TABLE "HoldTimeRule" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "HoldTimeRule" ADD CONSTRAINT "HoldTimeRule_methodologyVersion_fkey" FOREIGN KEY ("methodologyVersion") REFERENCES "MethodologyVersion"("version") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed the new methodology version, INACTIVE. §6 requires bumping to a v2
-- that covers posture + hold time TOGETHER as one version (not per-factor
-- versioning) — which means v2 needs its own complete copy of every v1
-- posture rule, not just the new hold-time rules, or every existing
-- capture would stop scoring the moment v2 goes active. isActive stays
-- false here deliberately: activation is a separate migration, gated on
-- proving (outside this migration, against the live DB) that v2 re-scores
-- every existing sample identically to v1 for the posture dimension —
-- "existing samples re-score correctly under v1 — prove it, don't assume
-- it" (§7 B3).
INSERT INTO "MethodologyVersion" ("version", "isActive", "activatedAt") VALUES ('v2-2026-08', false, CURRENT_TIMESTAMP);

-- Copy every v1-2026-07 ScoringRule row forward to v2-2026-08, verbatim.
-- Done as a SELECT-copy rather than re-typed literal values so parity with
-- v1 is guaranteed by construction (whatever v1 actually contains, byte
-- for byte) rather than by manual transcription of 29 rows a second time.
INSERT INTO "ScoringRule" ("id", "methodologyVersion", "bodyRegion", "riskBand", "riskScore", "angleMin", "angleMax")
SELECT gen_random_uuid()::text, 'v2-2026-08', "bodyRegion", "riskBand", "riskScore", "angleMin", "angleMax"
FROM "ScoringRule"
WHERE "methodologyVersion" = 'v1-2026-07';

-- Seed HoldTimeRule for v2-2026-08 — SLD's own independently-designed
-- ceilings (not reproduced ISO 11226 figures, see the CREATE TABLE
-- comment above), progressively shorter as posture severity rises.
-- Exceeding any of them escalates the hold-time sub-score straight to
-- HIGH (matchHoldTimeBand, src/lib/scoring/hold-time.ts) — a posture
-- sustained well past its own severity tier's safe duration is itself the
-- finding, regardless of how close to HIGH the instantaneous angle
-- already was. This is deliberately what closes the "a 2-second reach
-- scores like a 4-hour bend" gap named in the plan (§3): even a LOW-band
-- angle gets a real (generous, but finite) ceiling, precisely so a
-- 4-hour-plus static hold at a near-neutral angle stops being
-- indistinguishable from a 2-second one. HIGH's own ceiling is left
-- null: it's already the worst band, so there's nothing further for
-- hold-time to escalate it to.
INSERT INTO "HoldTimeRule" ("id", "methodologyVersion", "postureRiskBand", "maxHoldSeconds") VALUES
  (gen_random_uuid()::text, 'v2-2026-08', 'LOW', 14400),
  (gen_random_uuid()::text, 'v2-2026-08', 'MODERATE', 1800),
  (gen_random_uuid()::text, 'v2-2026-08', 'ELEVATED', 300),
  (gen_random_uuid()::text, 'v2-2026-08', 'HIGH', NULL);
