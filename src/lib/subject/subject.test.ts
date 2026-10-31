import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    orgUnit: { findUnique: vi.fn() },
    workstation: { findUnique: vi.fn() },
    process: { findUnique: vi.fn() },
    task: { findUnique: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { assertSubjectBelongsToSite, resolveSubjectSiteId } from "./subject";

describe("resolveSubjectSiteId", () => {
  beforeEach(() => {
    vi.mocked(prisma.orgUnit.findUnique).mockReset();
    vi.mocked(prisma.workstation.findUnique).mockReset();
    vi.mocked(prisma.process.findUnique).mockReset();
    vi.mocked(prisma.task.findUnique).mockReset();
  });

  it("reads siteId directly for org unit / workstation / process", async () => {
    vi.mocked(prisma.orgUnit.findUnique).mockResolvedValue({
      siteId: "s-org",
    } as never);
    vi.mocked(prisma.workstation.findUnique).mockResolvedValue({
      siteId: "s-ws",
    } as never);
    vi.mocked(prisma.process.findUnique).mockResolvedValue({
      siteId: "s-proc",
    } as never);

    expect(await resolveSubjectSiteId({ type: "ORG_UNIT", id: "o1" })).toBe(
      "s-org",
    );
    expect(await resolveSubjectSiteId({ type: "WORKSTATION", id: "w1" })).toBe(
      "s-ws",
    );
    expect(await resolveSubjectSiteId({ type: "PROCESS", id: "p1" })).toBe(
      "s-proc",
    );
  });

  it("reaches siteId through the workstation for a task", async () => {
    vi.mocked(prisma.task.findUnique).mockResolvedValue({
      workstation: { siteId: "s-task" },
    } as never);
    expect(await resolveSubjectSiteId({ type: "TASK", id: "t1" })).toBe(
      "s-task",
    );
  });

  it("throws when the subject does not exist", async () => {
    vi.mocked(prisma.process.findUnique).mockResolvedValue(null as never);
    await expect(
      resolveSubjectSiteId({ type: "PROCESS", id: "missing" }),
    ).rejects.toThrow(/does not exist/);
  });
});

describe("assertSubjectBelongsToSite", () => {
  beforeEach(() => {
    vi.mocked(prisma.workstation.findUnique).mockReset();
  });

  it("passes when the subject's site matches", async () => {
    vi.mocked(prisma.workstation.findUnique).mockResolvedValue({
      siteId: "site1",
    } as never);
    await expect(
      assertSubjectBelongsToSite({ type: "WORKSTATION", id: "w1" }, "site1"),
    ).resolves.toBeUndefined();
  });

  it("rejects a subject from a different site", async () => {
    vi.mocked(prisma.workstation.findUnique).mockResolvedValue({
      siteId: "other",
    } as never);
    await expect(
      assertSubjectBelongsToSite({ type: "WORKSTATION", id: "w1" }, "site1"),
    ).rejects.toThrow(/different site/);
  });
});
