-- H1a of the hazards-and-environment plan
-- (SLD_IMPLEMENTATION_PLAN_hazards-and-environment.md §3.1). The
-- HazardCategoryCheck table: one row per (RiskAssessment, HazardCategory),
-- recording whether each of the 13 hazard categories was considered. This
-- is the ASchG §4/§5 completeness proof — proof that EVERY hazard type was
-- assessed, including "not present" and "not applicable", not just the ones
-- found present.
--
-- Hand-added constructs re-verify against the live DB after
-- `prisma migrate deploy`, per the standing gotcha in CLAUDE.md:
--   1. CHECK "HazardCategoryCheck_rationale_check" (rationale required for
--      NOT_APPLICABLE / CHECKED_NO_HAZARD) — same technique as
--      ManualInput_value_shape_check. Prove it rejects a bad row at the DB
--      level, not only in the app.
--   2. The backfill writes OPEN or HAZARD_PRESENT only — NEVER
--      CHECKED_NO_HAZARD (§8 "no inferred completeness": we didn't check, so
--      we don't claim we did).

-- CreateTable
CREATE TABLE "HazardCategoryCheck" (
    "id" TEXT NOT NULL,
    "riskAssessmentId" TEXT NOT NULL,
    "category" "HazardCategory" NOT NULL,
    "status" "CategoryCheckStatus" NOT NULL,
    "rationale" TEXT,
    "checkedByUserId" UUID,
    "checkedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HazardCategoryCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: one check per category per assessment.
CREATE UNIQUE INDEX "HazardCategoryCheck_riskAssessmentId_category_key" ON "HazardCategoryCheck"("riskAssessmentId", "category");

-- CreateIndex
CREATE INDEX "HazardCategoryCheck_riskAssessmentId_idx" ON "HazardCategoryCheck"("riskAssessmentId");

-- AddForeignKey
ALTER TABLE "HazardCategoryCheck" ADD CONSTRAINT "HazardCategoryCheck_riskAssessmentId_fkey" FOREIGN KEY ("riskAssessmentId") REFERENCES "RiskAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CheckConstraint: a NOT_APPLICABLE ("nicht zutreffend") or
-- CHECKED_NO_HAZARD ("geprüft, keine Gefährdung") status is a claim an
-- Arbeitsinspektor will read, so it can't be recorded without a one-line
-- rationale. OPEN and HAZARD_PRESENT need none (OPEN = not yet assessed;
-- HAZARD_PRESENT is backed by the finding itself). Same pattern as
-- ManualInput_value_shape_check.
ALTER TABLE "HazardCategoryCheck" ADD CONSTRAINT "HazardCategoryCheck_rationale_check" CHECK (
  "status" NOT IN ('NOT_APPLICABLE', 'CHECKED_NO_HAZARD') OR "rationale" IS NOT NULL
);

ALTER TABLE "HazardCategoryCheck" ENABLE ROW LEVEL SECURITY;

-- Backfill: every existing RiskAssessment gets one row per HazardCategory.
-- HAZARD_PRESENT where a RiskFinding of that category already exists under
-- the assessment; OPEN otherwise. NEVER CHECKED_NO_HAZARD — a category with
-- no finding was simply never assessed under the old flow, and claiming it
-- was "checked, no hazard" would fabricate completeness the system can't
-- stand behind (§8). checkedByUserId/checkedAt stay NULL for every
-- backfilled row (there is no human behind a backfilled status), which the
-- rationale CHECK permits since neither backfilled status requires a
-- rationale.
INSERT INTO "HazardCategoryCheck" ("id", "riskAssessmentId", "category", "status", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  ra.id,
  cat.category,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM "RiskFinding" rf
      JOIN "Hazard" h ON h.id = rf."hazardId"
      WHERE rf."riskAssessmentId" = ra.id AND h.category = cat.category
    )
    THEN 'HAZARD_PRESENT'::"CategoryCheckStatus"
    ELSE 'OPEN'::"CategoryCheckStatus"
  END,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "RiskAssessment" ra
CROSS JOIN (SELECT unnest(enum_range(NULL::"HazardCategory")) AS category) cat;
