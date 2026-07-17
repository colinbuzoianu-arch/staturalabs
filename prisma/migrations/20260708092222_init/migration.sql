-- CreateEnum
CREATE TYPE "BodyRegion" AS ENUM ('NECK', 'TRUNK', 'SHOULDER_LEFT', 'SHOULDER_RIGHT', 'UPPER_ARM_LEFT', 'UPPER_ARM_RIGHT', 'FOREARM_LEFT', 'FOREARM_RIGHT', 'WRIST_LEFT', 'WRIST_RIGHT', 'HIP', 'KNEE_LEFT', 'KNEE_RIGHT', 'ANKLE_LEFT', 'ANKLE_RIGHT');

-- CreateEnum
CREATE TYPE "ManualInputType" AS ENUM ('LOAD_WEIGHT_KG', 'PUSH_FORCE_N', 'PULL_FORCE_N', 'REPETITION_COUNT', 'DURATION_SECONDS');

-- CreateTable
CREATE TABLE "Workstation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workstation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "workstationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentSession" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostureSample" (
    "id" TEXT NOT NULL,
    "assessmentSessionId" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "frameIndex" INTEGER,
    "keypoints" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostureSample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BodyRegionScore" (
    "id" TEXT NOT NULL,
    "postureSampleId" TEXT NOT NULL,
    "bodyRegion" "BodyRegion" NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "scoringRuleVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BodyRegionScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManualInput" (
    "id" TEXT NOT NULL,
    "assessmentSessionId" TEXT NOT NULL,
    "inputType" "ManualInputType" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManualInput_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Workstation_organizationId_idx" ON "Workstation"("organizationId");

-- CreateIndex
CREATE INDEX "Task_workstationId_idx" ON "Task"("workstationId");

-- CreateIndex
CREATE INDEX "AssessmentSession_taskId_idx" ON "AssessmentSession"("taskId");

-- CreateIndex
CREATE INDEX "PostureSample_assessmentSessionId_idx" ON "PostureSample"("assessmentSessionId");

-- CreateIndex
CREATE INDEX "BodyRegionScore_postureSampleId_idx" ON "BodyRegionScore"("postureSampleId");

-- CreateIndex
CREATE INDEX "ManualInput_assessmentSessionId_idx" ON "ManualInput"("assessmentSessionId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "Workstation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentSession" ADD CONSTRAINT "AssessmentSession_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostureSample" ADD CONSTRAINT "PostureSample_assessmentSessionId_fkey" FOREIGN KEY ("assessmentSessionId") REFERENCES "AssessmentSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BodyRegionScore" ADD CONSTRAINT "BodyRegionScore_postureSampleId_fkey" FOREIGN KEY ("postureSampleId") REFERENCES "PostureSample"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualInput" ADD CONSTRAINT "ManualInput_assessmentSessionId_fkey" FOREIGN KEY ("assessmentSessionId") REFERENCES "AssessmentSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
