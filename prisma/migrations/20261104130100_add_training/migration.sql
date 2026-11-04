-- P7c Unterweisungen tables (plan §7.6). People-compartment proof-of-
-- instruction. No FK into the assessment chain (legalReferenceId is a plain
-- column). RLS on all three. FKs Restrict (§3.9).

CREATE TABLE "TrainingRequirementType" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "title" TEXT NOT NULL,
    "contentOutline" TEXT,
    "recurrenceMonths" INTEGER,
    "legalReferenceId" TEXT,
    "deliveryMethod" "TrainingDeliveryMethod" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingRequirementType_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TrainingRequirementType_companyId_idx" ON "TrainingRequirementType"("companyId");
ALTER TABLE "TrainingRequirementType" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "TrainingSession" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "requirementTypeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "instructor" TEXT NOT NULL,
    "topics" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TrainingSession_companyId_idx" ON "TrainingSession"("companyId");
CREATE INDEX "TrainingSession_requirementTypeId_idx" ON "TrainingSession"("requirementTypeId");
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_requirementTypeId_fkey" FOREIGN KEY ("requirementTypeId") REFERENCES "TrainingRequirementType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrainingSession" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "TrainingRecord" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "requirementTypeId" TEXT NOT NULL,
    "trainingSessionId" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "method" "TrainingDeliveryMethod" NOT NULL,
    "confirmation" "TrainingConfirmation" NOT NULL,
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingRecord_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TrainingRecord_personId_idx" ON "TrainingRecord"("personId");
CREATE INDEX "TrainingRecord_requirementTypeId_idx" ON "TrainingRecord"("requirementTypeId");
ALTER TABLE "TrainingRecord" ADD CONSTRAINT "TrainingRecord_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrainingRecord" ADD CONSTRAINT "TrainingRecord_requirementTypeId_fkey" FOREIGN KEY ("requirementTypeId") REFERENCES "TrainingRequirementType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrainingRecord" ADD CONSTRAINT "TrainingRecord_trainingSessionId_fkey" FOREIGN KEY ("trainingSessionId") REFERENCES "TrainingSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrainingRecord" ENABLE ROW LEVEL SECURITY;
