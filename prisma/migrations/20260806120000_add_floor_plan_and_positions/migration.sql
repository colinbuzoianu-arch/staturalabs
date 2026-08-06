-- FloorPlan + WorkstationPlanPosition + TaskPlanPosition.
--
-- A workstation is an area, not a point, so WorkstationPlanPosition is only
-- the fallback/aggregate pin for when nobody has placed individual tasks
-- yet. The measurement granularity this schema already has is task-level
-- (PostureSample belongs to Task), so TaskPlanPosition is what lets a
-- heatmap point at exactly which spot within a workstation drives risk.
-- No new enums, so this lands as a single migration.
--
-- No worker-identity concern here (ERGO_COMPLIANCE_BY_DESIGN.md §3.1/§4):
-- these tables describe where a workstation/task sits on a floor plan
-- image, nothing about who works there.

-- CreateTable
CREATE TABLE "FloorPlan" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FloorPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FloorPlan_siteId_idx" ON "FloorPlan"("siteId");

-- AddForeignKey
-- Restrict, matching every other relation off Site: a site's floor plans
-- can't be wiped out as a side effect of deleting the site.
ALTER TABLE "FloorPlan" ADD CONSTRAINT "FloorPlan_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "WorkstationPlanPosition" (
    "id" TEXT NOT NULL,
    "floorPlanId" TEXT NOT NULL,
    "workstationId" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "WorkstationPlanPosition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkstationPlanPosition_floorPlanId_workstationId_key" ON "WorkstationPlanPosition"("floorPlanId", "workstationId");

-- CreateIndex
CREATE INDEX "WorkstationPlanPosition_floorPlanId_idx" ON "WorkstationPlanPosition"("floorPlanId");

-- AddForeignKey
-- Cascade: a pin is meaningless without the plan it's placed on.
ALTER TABLE "WorkstationPlanPosition" ADD CONSTRAINT "WorkstationPlanPosition_floorPlanId_fkey" FOREIGN KEY ("floorPlanId") REFERENCES "FloorPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
-- Cascade: a workstation's map pin has no reason to outlive the workstation.
ALTER TABLE "WorkstationPlanPosition" ADD CONSTRAINT "WorkstationPlanPosition_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "Workstation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "TaskPlanPosition" (
    "id" TEXT NOT NULL,
    "floorPlanId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "TaskPlanPosition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaskPlanPosition_floorPlanId_taskId_key" ON "TaskPlanPosition"("floorPlanId", "taskId");

-- CreateIndex
CREATE INDEX "TaskPlanPosition_floorPlanId_idx" ON "TaskPlanPosition"("floorPlanId");

-- AddForeignKey
-- Cascade: a pin is meaningless without the plan it's placed on.
ALTER TABLE "TaskPlanPosition" ADD CONSTRAINT "TaskPlanPosition_floorPlanId_fkey" FOREIGN KEY ("floorPlanId") REFERENCES "FloorPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
-- Cascade: a task's map pin has no reason to outlive the task.
ALTER TABLE "TaskPlanPosition" ADD CONSTRAINT "TaskPlanPosition_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable RLS, no policies — same pattern as every other table (see
-- CLAUDE.md "known gotchas": the app's DB role owns these tables, so this
-- currently works via table ownership, not policy enforcement).
ALTER TABLE "FloorPlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkstationPlanPosition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TaskPlanPosition" ENABLE ROW LEVEL SECURITY;
