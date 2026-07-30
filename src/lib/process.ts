import { ProcessStatus } from "@/generated/prisma/enums";
import type { ProcessModel, ProcessTaskModel } from "@/generated/prisma/models";
import { prisma } from "@/lib/prisma";

// Deliberately no `import "server-only"` here — needs to be directly
// unit-testable via a mocked `@/lib/prisma`, same reasoning as
// assessment-session.ts and org-unit.ts.

export type CreateProcessInput = {
  siteId: string;
  orgUnitId?: string | null;
  name: string;
  code?: string | null;
  description?: string | null;
  status?: ProcessStatus;
};

// The single gate for creating a Process. Site scoping: if an orgUnitId is
// given, it must belong to the same site as the process — the org tree is
// grouping/presentation, but a process can't be filed under an org unit
// from a different tenant's site.
export async function createProcess(
  input: CreateProcessInput,
): Promise<ProcessModel> {
  const orgUnitId = input.orgUnitId ?? null;

  if (orgUnitId !== null) {
    const orgUnit = await prisma.orgUnit.findUnique({
      where: { id: orgUnitId },
      select: { siteId: true },
    });
    if (!orgUnit) {
      throw new Error(`OrgUnit ${orgUnitId} does not exist`);
    }
    if (orgUnit.siteId !== input.siteId) {
      throw new Error(
        `Process orgUnit belongs to a different site (orgUnit.siteId=${orgUnit.siteId}, requested siteId=${input.siteId})`,
      );
    }
  }

  return prisma.process.create({
    data: {
      siteId: input.siteId,
      orgUnitId,
      name: input.name,
      code: input.code ?? null,
      description: input.description ?? null,
      status: input.status ?? ProcessStatus.DRAFT,
    },
  });
}

export type AddTaskToProcessInput = {
  processId: string;
  taskId: string;
  sequence: number;
};

// The single gate for adding a Task to a Process — the check that stops a
// process reaching across sites. A Task belongs to a Workstation, which
// belongs to a Site; a Process belongs to a Site directly. The two must
// match, or a process could silently aggregate tasks from a workstation
// the process's own site has no relationship to.
export async function addTaskToProcess(
  input: AddTaskToProcessInput,
): Promise<ProcessTaskModel> {
  const [process, task] = await Promise.all([
    prisma.process.findUnique({
      where: { id: input.processId },
      select: { siteId: true },
    }),
    prisma.task.findUnique({
      where: { id: input.taskId },
      select: { workstation: { select: { siteId: true } } },
    }),
  ]);

  if (!process) {
    throw new Error(`Process ${input.processId} does not exist`);
  }
  if (!task) {
    throw new Error(`Task ${input.taskId} does not exist`);
  }
  if (task.workstation.siteId !== process.siteId) {
    throw new Error(
      `Task's workstation belongs to a different site than the process ` +
        `(task.workstation.siteId=${task.workstation.siteId}, process.siteId=${process.siteId}) — ` +
        `a process cannot reach across sites`,
    );
  }

  return prisma.processTask.create({
    data: {
      processId: input.processId,
      taskId: input.taskId,
      sequence: input.sequence,
    },
  });
}
