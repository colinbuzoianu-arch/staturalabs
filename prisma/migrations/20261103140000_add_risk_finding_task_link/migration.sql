-- P6 §6 step link: RiskFinding.taskId → the specific Task (the "step") the
-- finding relates to, within the assessed workstation/process. Additive,
-- nullable, FK onDelete Restrict (house style, §3.9). No enum, single
-- migration. Application-layer validation ensures the task belongs to the
-- assessment's own subject (not merely the same site).

ALTER TABLE "RiskFinding" ADD COLUMN "taskId" TEXT;
CREATE INDEX "RiskFinding_taskId_idx" ON "RiskFinding"("taskId");
ALTER TABLE "RiskFinding" ADD CONSTRAINT "RiskFinding_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
