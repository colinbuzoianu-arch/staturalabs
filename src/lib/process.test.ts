import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    orgUnit: { findUnique: vi.fn() },
    process: { findUnique: vi.fn(), create: vi.fn() },
    task: { findUnique: vi.fn() },
    processTask: { create: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { addTaskToProcess, createProcess } from "./process";

describe("createProcess", () => {
  beforeEach(() => {
    vi.mocked(prisma.orgUnit.findUnique).mockReset();
    vi.mocked(prisma.process.create).mockReset();
  });

  it("creates a Process with no orgUnitId without any lookup", async () => {
    vi.mocked(prisma.process.create).mockResolvedValue({
      id: "p1",
    } as never);

    await createProcess({ siteId: "site1", name: "Panel assembly" });

    expect(prisma.orgUnit.findUnique).not.toHaveBeenCalled();
    expect(prisma.process.create).toHaveBeenCalledWith({
      data: {
        siteId: "site1",
        orgUnitId: null,
        name: "Panel assembly",
        code: null,
        description: null,
        status: "DRAFT",
      },
    });
  });

  it("rejects an orgUnit from a different site before calling create", async () => {
    vi.mocked(prisma.orgUnit.findUnique).mockResolvedValue({
      siteId: "other-site",
    } as never);

    await expect(
      createProcess({
        siteId: "site1",
        orgUnitId: "dept1",
        name: "Panel assembly",
      }),
    ).rejects.toThrow(/different site/);

    expect(prisma.process.create).not.toHaveBeenCalled();
  });

  it("creates a Process once the orgUnit's site matches", async () => {
    vi.mocked(prisma.orgUnit.findUnique).mockResolvedValue({
      siteId: "site1",
    } as never);
    vi.mocked(prisma.process.create).mockResolvedValue({
      id: "p2",
    } as never);

    await createProcess({
      siteId: "site1",
      orgUnitId: "dept1",
      name: "Panel assembly",
      status: "ACTIVE",
    });

    expect(prisma.process.create).toHaveBeenCalledWith({
      data: {
        siteId: "site1",
        orgUnitId: "dept1",
        name: "Panel assembly",
        code: null,
        description: null,
        status: "ACTIVE",
      },
    });
  });
});

describe("addTaskToProcess", () => {
  beforeEach(() => {
    vi.mocked(prisma.process.findUnique).mockReset();
    vi.mocked(prisma.task.findUnique).mockReset();
    vi.mocked(prisma.processTask.create).mockReset();
  });

  it("rejects a task whose workstation is on a different site than the process", async () => {
    vi.mocked(prisma.process.findUnique).mockResolvedValue({
      siteId: "site1",
    } as never);
    vi.mocked(prisma.task.findUnique).mockResolvedValue({
      workstation: { siteId: "site2" },
    } as never);

    await expect(
      addTaskToProcess({ processId: "p1", taskId: "t1", sequence: 1 }),
    ).rejects.toThrow(/cannot reach across sites/);

    expect(prisma.processTask.create).not.toHaveBeenCalled();
  });

  it("adds the task once the process and task's workstation share a site", async () => {
    vi.mocked(prisma.process.findUnique).mockResolvedValue({
      siteId: "site1",
    } as never);
    vi.mocked(prisma.task.findUnique).mockResolvedValue({
      workstation: { siteId: "site1" },
    } as never);
    vi.mocked(prisma.processTask.create).mockResolvedValue({
      id: "pt1",
    } as never);

    await addTaskToProcess({ processId: "p1", taskId: "t1", sequence: 2 });

    expect(prisma.processTask.create).toHaveBeenCalledWith({
      data: { processId: "p1", taskId: "t1", sequence: 2 },
    });
  });

  it("throws if the process does not exist", async () => {
    vi.mocked(prisma.process.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.task.findUnique).mockResolvedValue({
      workstation: { siteId: "site1" },
    } as never);

    await expect(
      addTaskToProcess({ processId: "ghost", taskId: "t1", sequence: 1 }),
    ).rejects.toThrow(/does not exist/);
  });
});
