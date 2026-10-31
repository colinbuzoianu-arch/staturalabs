import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    companyModule: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { ModuleKey } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import {
  disableModule,
  enableModule,
  getEnabledModuleKeys,
  isModuleEnabled,
} from "./entitlement";

describe("entitlement", () => {
  beforeEach(() => {
    vi.mocked(prisma.companyModule.findUnique).mockReset();
    vi.mocked(prisma.companyModule.findMany).mockReset();
    vi.mocked(prisma.companyModule.upsert).mockReset();
    vi.mocked(prisma.companyModule.deleteMany).mockReset();
  });

  it("treats a baseline module as enabled without hitting the DB", async () => {
    expect(await isModuleEnabled("c1", ModuleKey.ACTIONS)).toBe(true);
    expect(prisma.companyModule.findUnique).not.toHaveBeenCalled();
  });

  it("checks a row for a non-baseline module", async () => {
    vi.mocked(prisma.companyModule.findUnique).mockResolvedValue(null as never);
    expect(await isModuleEnabled("c1", ModuleKey.INCIDENTS)).toBe(false);

    vi.mocked(prisma.companyModule.findUnique).mockResolvedValue({
      id: "x",
    } as never);
    expect(await isModuleEnabled("c1", ModuleKey.INCIDENTS)).toBe(true);
  });

  it("returns baseline keys unioned with entitlement rows", async () => {
    vi.mocked(prisma.companyModule.findMany).mockResolvedValue([
      { moduleKey: ModuleKey.RISK },
      { moduleKey: ModuleKey.ENVIRONMENT },
    ] as never);
    const enabled = await getEnabledModuleKeys("c1");
    // Baseline always present...
    expect(enabled.has(ModuleKey.COCKPIT)).toBe(true);
    expect(enabled.has(ModuleKey.SETTINGS)).toBe(true);
    // ...plus the explicitly enabled ones...
    expect(enabled.has(ModuleKey.RISK)).toBe(true);
    expect(enabled.has(ModuleKey.ENVIRONMENT)).toBe(true);
    // ...and nothing that was neither.
    expect(enabled.has(ModuleKey.INCIDENTS)).toBe(false);
  });

  it("refuses to toggle a baseline module", async () => {
    await expect(enableModule("c1", ModuleKey.COCKPIT, null)).rejects.toThrow(
      /baseline/,
    );
    await expect(disableModule("c1", ModuleKey.DOCUMENTS)).rejects.toThrow(
      /baseline/,
    );
    expect(prisma.companyModule.upsert).not.toHaveBeenCalled();
    expect(prisma.companyModule.deleteMany).not.toHaveBeenCalled();
  });

  it("upserts when enabling a non-baseline module", async () => {
    vi.mocked(prisma.companyModule.upsert).mockResolvedValue({} as never);
    await enableModule("c1", ModuleKey.TRAINING, "user-1");
    expect(prisma.companyModule.upsert).toHaveBeenCalledWith({
      where: {
        companyId_moduleKey: { companyId: "c1", moduleKey: "TRAINING" },
      },
      create: {
        companyId: "c1",
        moduleKey: "TRAINING",
        enabledByUserId: "user-1",
      },
      update: {},
    });
  });
});
