-- P7d §A.2: TrainingRequirementSource — attaches a requirement type to a
-- job-level subject (workstation/org-unit/process; substance reserved).
-- subjectId is a plain column (no FK into the assessment chain). RLS on.
CREATE TABLE "TrainingRequirementSource" (
    "id" TEXT NOT NULL,
    "requirementTypeId" TEXT NOT NULL,
    "subjectType" "RequirementSourceType" NOT NULL,
    "subjectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingRequirementSource_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TrainingRequirementSource_requirementTypeId_subjectType_sub_key" ON "TrainingRequirementSource"("requirementTypeId", "subjectType", "subjectId");
CREATE INDEX "TrainingRequirementSource_requirementTypeId_idx" ON "TrainingRequirementSource"("requirementTypeId");
CREATE INDEX "TrainingRequirementSource_subjectType_subjectId_idx" ON "TrainingRequirementSource"("subjectType", "subjectId");
ALTER TABLE "TrainingRequirementSource" ADD CONSTRAINT "TrainingRequirementSource_requirementTypeId_fkey" FOREIGN KEY ("requirementTypeId") REFERENCES "TrainingRequirementType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrainingRequirementSource" ENABLE ROW LEVEL SECURITY;
