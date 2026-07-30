-- Migration E of 5: Action (from a RiskFinding or an AssessmentSession —
-- exactly one source, HAND-ADDED CHECK below, same technique as
-- ManualInput_value_shape_check and RiskAssessment_exactly_one_subject_
-- check) and ActionStatusEvent (append-only status history, §3.6).
--
-- responsibleUserId/verifiedByUserId/byUserId are plain UUID columns, not
-- FKs to PlatformUser — deliberately, matching the plan spec exactly: the
-- authoritative constraint is application-level (§3.13: PlatformUser or a
-- role label, never a worker identity), not a DB-level FK to auth data.
-- CreateTable
CREATE TABLE "Action" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "riskFindingId" TEXT,
    "assessmentSessionId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "hierarchyOfControl" "HierarchyOfControl",
    "responsibleUserId" UUID,
    "responsibleRoleLabel" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "ActionStatus" NOT NULL DEFAULT 'OPEN',
    "implementedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "verifiedByUserId" UUID,
    "verificationOutcome" "VerificationOutcome",
    "verificationAssessmentId" TEXT,
    "verificationNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Action_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Action_siteId_status_idx" ON "Action"("siteId", "status");

-- CreateIndex
CREATE INDEX "Action_riskFindingId_idx" ON "Action"("riskFindingId");

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_riskFindingId_fkey" FOREIGN KEY ("riskFindingId") REFERENCES "RiskFinding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_assessmentSessionId_fkey" FOREIGN KEY ("assessmentSessionId") REFERENCES "AssessmentSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_verificationAssessmentId_fkey" FOREIGN KEY ("verificationAssessmentId") REFERENCES "RiskAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CheckConstraint
-- Exactly one source: a corrective action comes from either a risk finding
-- or an ergonomic assessment session, never both, never neither.
ALTER TABLE "Action" ADD CONSTRAINT "Action_exactly_one_source_check" CHECK (
  ("riskFindingId" IS NOT NULL AND "assessmentSessionId" IS NULL) OR
  ("riskFindingId" IS NULL AND "assessmentSessionId" IS NOT NULL)
);

ALTER TABLE "Action" ENABLE ROW LEVEL SECURITY;

-- CreateTable
CREATE TABLE "ActionStatusEvent" (
    "id" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "fromStatus" "ActionStatus",
    "toStatus" "ActionStatus" NOT NULL,
    "byUserId" UUID NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActionStatusEvent_actionId_idx" ON "ActionStatusEvent"("actionId");

-- AddForeignKey
ALTER TABLE "ActionStatusEvent" ADD CONSTRAINT "ActionStatusEvent_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ActionStatusEvent" ENABLE ROW LEVEL SECURITY;
