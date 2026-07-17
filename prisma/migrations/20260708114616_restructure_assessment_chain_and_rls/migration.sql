-- AlterTable: Task now Restrict on delete, matching the rest of the chain
-- (was Cascade — a task with assessment history behind it must not be
-- deletable out from under that history, per §3.6).
ALTER TABLE "Task" DROP CONSTRAINT "Task_workstationId_fkey";
ALTER TABLE "Task" ADD CONSTRAINT "Task_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "Workstation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: AssessmentSession moves from "belongs to one Task" to
-- "belongs to a Workstation, groups many Tasks via AssessmentSessionTask".
ALTER TABLE "AssessmentSession" DROP CONSTRAINT "AssessmentSession_taskId_fkey";
DROP INDEX "AssessmentSession_taskId_idx";
ALTER TABLE "AssessmentSession" DROP COLUMN "taskId";
ALTER TABLE "AssessmentSession" ADD COLUMN "workstationId" TEXT NOT NULL;
ALTER TABLE "AssessmentSession" ADD CONSTRAINT "AssessmentSession_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "Workstation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "AssessmentSession_workstationId_idx" ON "AssessmentSession"("workstationId");

-- CreateTable: join table for the AssessmentSession <-> Task many-to-many
-- (a task can be re-assessed in more than one dated session over time).
CREATE TABLE "AssessmentSessionTask" (
    "id" TEXT NOT NULL,
    "assessmentSessionId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentSessionTask_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AssessmentSessionTask_assessmentSessionId_taskId_key" ON "AssessmentSessionTask"("assessmentSessionId", "taskId");
CREATE INDEX "AssessmentSessionTask_taskId_idx" ON "AssessmentSessionTask"("taskId");

ALTER TABLE "AssessmentSessionTask" ADD CONSTRAINT "AssessmentSessionTask_assessmentSessionId_fkey" FOREIGN KEY ("assessmentSessionId") REFERENCES "AssessmentSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentSessionTask" ADD CONSTRAINT "AssessmentSessionTask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "CameraAngle" AS ENUM ('FRONTAL', 'SAGITTAL', 'OBLIQUE');

-- AlterTable: PostureSample moves from "belongs to an AssessmentSession" to
-- "belongs to a Task", and gains the required cameraAngle column.
ALTER TABLE "PostureSample" DROP CONSTRAINT "PostureSample_assessmentSessionId_fkey";
DROP INDEX "PostureSample_assessmentSessionId_idx";
ALTER TABLE "PostureSample" DROP COLUMN "assessmentSessionId";
ALTER TABLE "PostureSample" ADD COLUMN "taskId" TEXT NOT NULL;
ALTER TABLE "PostureSample" ADD COLUMN "cameraAngle" "CameraAngle" NOT NULL;
ALTER TABLE "PostureSample" ADD CONSTRAINT "PostureSample_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "PostureSample_taskId_idx" ON "PostureSample"("taskId");

-- AlterTable: BodyRegionScore now Restrict on delete (was Cascade), plus one
-- row per body region per sample.
ALTER TABLE "BodyRegionScore" DROP CONSTRAINT "BodyRegionScore_postureSampleId_fkey";
ALTER TABLE "BodyRegionScore" ADD CONSTRAINT "BodyRegionScore_postureSampleId_fkey" FOREIGN KEY ("postureSampleId") REFERENCES "PostureSample"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "BodyRegionScore_postureSampleId_bodyRegion_key" ON "BodyRegionScore"("postureSampleId", "bodyRegion");

-- AlterTable: ManualInput moves from "belongs to an AssessmentSession" to
-- "belongs to a Task". value/unit become nullable and textValue is added so
-- a TOOL_USED entry (non-numeric) and a numeric entry (weight/force) share
-- one table; the CHECK constraint below enforces which columns apply to
-- which inputType, since Prisma's schema language can't express that
-- (same caveat as PlatformUser_role_companyId_check: review any future
-- auto-generated migration touching this table for a dropped constraint).
ALTER TABLE "ManualInput" DROP CONSTRAINT "ManualInput_assessmentSessionId_fkey";
DROP INDEX "ManualInput_assessmentSessionId_idx";
ALTER TABLE "ManualInput" DROP COLUMN "assessmentSessionId";
ALTER TABLE "ManualInput" ADD COLUMN "taskId" TEXT NOT NULL;
ALTER TABLE "ManualInput" ADD COLUMN "textValue" TEXT;
ALTER TABLE "ManualInput" ALTER COLUMN "value" DROP NOT NULL;
ALTER TABLE "ManualInput" ALTER COLUMN "unit" DROP NOT NULL;
ALTER TABLE "ManualInput" ADD CONSTRAINT "ManualInput_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "ManualInput_taskId_idx" ON "ManualInput"("taskId");

ALTER TABLE "ManualInput" ADD CONSTRAINT "ManualInput_value_shape_check" CHECK (
  ("inputType" = 'TOOL_USED' AND "textValue" IS NOT NULL AND "value" IS NULL AND "unit" IS NULL) OR
  ("inputType" != 'TOOL_USED' AND "value" IS NOT NULL AND "unit" IS NOT NULL AND "textValue" IS NULL)
);

-- Enable RLS on every table, including ones from the previous migration.
-- Defense-in-depth: Prisma connects as a superuser role and always bypasses
-- RLS regardless of this setting, so application access is unaffected.
-- What this actually does is close off the Supabase-managed PostgREST/
-- realtime access paths (anon/authenticated roles) by default — with zero
-- policies defined, RLS-enabled tables deny those roles entirely rather
-- than falling back to whatever broad grants Supabase applies by default.
ALTER TABLE "Company" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Site" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlatformUser" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SiteAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Workstation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Task" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AssessmentSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AssessmentSessionTask" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PostureSample" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BodyRegionScore" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ManualInput" ENABLE ROW LEVEL SECURITY;
