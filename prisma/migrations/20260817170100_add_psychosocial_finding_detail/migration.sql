-- B7 of the Austria-first plan (SLD_IMPLEMENTATION_PLAN_austria-first.md
-- §7 B7): structured psychosocial finding detail (dimension/method/group
-- size/external procedure) plus a second seeded system Hazard for the
-- general ÖNORM EN ISO 10075-1/-3 evaluation (PSYCH-01 "Shift-work load"
-- is a specific finding, not the general four-dimension evaluation this
-- milestone is for).

-- CreateTable
CREATE TABLE "PsychosocialFindingDetail" (
    "id" TEXT NOT NULL,
    "riskFindingId" TEXT NOT NULL,
    "dimension" "PsychosocialDimension" NOT NULL,
    "method" "PsychosocialMethod" NOT NULL,
    "groupSize" INTEGER NOT NULL,
    "externalProcedureName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PsychosocialFindingDetail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PsychosocialFindingDetail_riskFindingId_key" ON "PsychosocialFindingDetail"("riskFindingId");

-- CreateIndex
CREATE INDEX "PsychosocialFindingDetail_riskFindingId_idx" ON "PsychosocialFindingDetail"("riskFindingId");

-- AddForeignKey
ALTER TABLE "PsychosocialFindingDetail" ADD CONSTRAINT "PsychosocialFindingDetail_riskFindingId_fkey" FOREIGN KEY ("riskFindingId") REFERENCES "RiskFinding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CheckConstraint: the group-size floor is conditional, not blanket —
-- Austrian guidance (WKO/Arbeitsinspektion) says QUESTIONNAIRE instruments
-- specifically are unsuitable below 15 employees because anonymity can't
-- be preserved at that scale, and directs smaller operations toward
-- GROUP_DISCUSSION/OBSERVATION/INTERVIEW instead (see the schema.prisma
-- doc comment on PsychosocialFindingDetail, and the locked decision in
-- ERGO_COMPLIANCE_BY_DESIGN.md §5). A GROUP_DISCUSSION/OBSERVATION/
-- INTERVIEW row is legal at any group size ≥ 1; a QUESTIONNAIRE row must
-- be ≥ 15.
ALTER TABLE "PsychosocialFindingDetail" ADD CONSTRAINT "PsychosocialFindingDetail_group_size_check" CHECK (
  "groupSize" >= 1 AND ("method" != 'QUESTIONNAIRE' OR "groupSize" >= 15)
);

ALTER TABLE "PsychosocialFindingDetail" ENABLE ROW LEVEL SECURITY;

-- Seed: a second system Hazard under PSYCHOSOCIAL for the general
-- four-dimension ÖNORM EN ISO 10075-1/-3 evaluation this milestone builds
-- (PSYCH-01 "Shift-work load" stays as its own narrower, specific finding
-- — this is not a replacement for it).
INSERT INTO "Hazard" ("id", "companyId", "category", "code", "name", "description", "isSystem", "updatedAt") VALUES
  (gen_random_uuid()::text, NULL, 'PSYCHOSOCIAL', 'PSYCH-02', 'Psychosocial workplace evaluation', 'General evaluation of arbeitsbedingte psychische Belastungen across the four ÖNORM EN ISO 10075-1/-3 dimensions (task/activity, work organisation, work environment, social climate) — recorded as an aggregate finding via PsychosocialFindingDetail, never per respondent.', true, CURRENT_TIMESTAMP);
