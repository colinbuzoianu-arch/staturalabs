-- Migration C of 5: Process (an ordered set of Tasks, possibly spanning
-- workstations within one site) and ProcessTask (the ordering join).
--
-- No separate ProcessStep entity: Task already means "a specific job
-- performed at a workstation"; a process is a sequence of those. A
-- described step with no Task is a signal to create the task, not to
-- introduce a parallel model that drifts from it.
-- CreateTable
CREATE TABLE "Process" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "orgUnitId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "status" "ProcessStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Process_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Process_siteId_idx" ON "Process"("siteId");

-- AddForeignKey
ALTER TABLE "Process" ADD CONSTRAINT "Process_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Process" ADD CONSTRAINT "Process_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "ProcessTask" (
    "id" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProcessTask_processId_taskId_key" ON "ProcessTask"("processId", "taskId");

-- CreateIndex
CREATE INDEX "ProcessTask_taskId_idx" ON "ProcessTask"("taskId");

-- AddForeignKey
ALTER TABLE "ProcessTask" ADD CONSTRAINT "ProcessTask_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessTask" ADD CONSTRAINT "ProcessTask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enable RLS, no policies — same pattern as every other table.
ALTER TABLE "Process" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProcessTask" ENABLE ROW LEVEL SECURITY;
