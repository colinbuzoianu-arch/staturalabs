import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { orgUnit: { findUnique: vi.fn(), create: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import {
  createOrgUnit,
  MAX_ORG_UNIT_DEPTH,
  validateOrgUnitParent,
} from "./org-unit";

describe("validateOrgUnitParent (pure)", () => {
  it("passes when the direct parent belongs to the same site and depth is within bounds", () => {
    const nodes = new Map([["plant1", { siteId: "site1", parentId: null }]]);
    expect(() => validateOrgUnitParent("plant1", "site1", nodes)).not.toThrow();
  });

  it("throws when the direct parent does not exist in the supplied graph", () => {
    const nodes = new Map<
      string,
      { siteId: string; parentId: string | null }
    >();
    expect(() => validateOrgUnitParent("ghost", "site1", nodes)).toThrow(
      /does not exist/,
    );
  });

  it("throws when the parent belongs to a different site", () => {
    const nodes = new Map([["plant1", { siteId: "site2", parentId: null }]]);
    expect(() => validateOrgUnitParent("plant1", "site1", nodes)).toThrow(
      /different site/,
    );
  });

  it("walks a multi-level chain that stays within MAX_ORG_UNIT_DEPTH", () => {
    // department -> plant (depth 3 including the new node: new -> department -> plant)
    const nodes = new Map([
      ["dept1", { siteId: "site1", parentId: "plant1" }],
      ["plant1", { siteId: "site1", parentId: null }],
    ]);
    expect(() => validateOrgUnitParent("dept1", "site1", nodes)).not.toThrow();
  });

  it("throws once the chain would exceed MAX_ORG_UNIT_DEPTH", () => {
    // Build a straight-line chain one longer than MAX_ORG_UNIT_DEPTH allows.
    const nodes = new Map<
      string,
      { siteId: string; parentId: string | null }
    >();
    for (let i = 0; i < MAX_ORG_UNIT_DEPTH + 2; i++) {
      const id = `unit${i}`;
      const parentId = i === 0 ? null : `unit${i - 1}`;
      nodes.set(id, { siteId: "site1", parentId });
    }
    const deepestId = `unit${MAX_ORG_UNIT_DEPTH + 1}`;
    expect(() => validateOrgUnitParent(deepestId, "site1", nodes)).toThrow(
      /exceed MAX_ORG_UNIT_DEPTH/,
    );
  });

  it("throws on a cycle in the parent chain rather than looping forever", () => {
    // a -> b -> a (corrupted tree, shouldn't be reachable via createOrgUnit
    // alone, but validateOrgUnitParent must still refuse to trust it).
    const nodes = new Map([
      ["a", { siteId: "site1", parentId: "b" }],
      ["b", { siteId: "site1", parentId: "a" }],
    ]);
    expect(() => validateOrgUnitParent("a", "site1", nodes)).toThrow(/cycle/);
  });
});

describe("createOrgUnit", () => {
  beforeEach(() => {
    vi.mocked(prisma.orgUnit.findUnique).mockReset();
    vi.mocked(prisma.orgUnit.create).mockReset();
  });

  it("creates a root OrgUnit (no parentId) without any lookup", async () => {
    vi.mocked(prisma.orgUnit.create).mockResolvedValue({ id: "u1" } as never);

    await createOrgUnit({
      siteId: "site1",
      type: "PLANT",
      name: "Main plant",
    });

    expect(prisma.orgUnit.findUnique).not.toHaveBeenCalled();
    expect(prisma.orgUnit.create).toHaveBeenCalledWith({
      data: {
        siteId: "site1",
        parentId: null,
        type: "PLANT",
        name: "Main plant",
        code: null,
      },
    });
  });

  it("rejects a parent from a different site before calling create", async () => {
    vi.mocked(prisma.orgUnit.findUnique).mockResolvedValue({
      siteId: "other-site",
      parentId: null,
    } as never);

    await expect(
      createOrgUnit({
        siteId: "site1",
        parentId: "plant1",
        type: "DEPARTMENT",
        name: "Assembly",
      }),
    ).rejects.toThrow(/different site/);

    expect(prisma.orgUnit.create).not.toHaveBeenCalled();
  });

  it("creates a child OrgUnit once the parent chain validates", async () => {
    vi.mocked(prisma.orgUnit.findUnique).mockResolvedValue({
      siteId: "site1",
      parentId: null,
    } as never);
    vi.mocked(prisma.orgUnit.create).mockResolvedValue({ id: "u2" } as never);

    await createOrgUnit({
      siteId: "site1",
      parentId: "plant1",
      type: "DEPARTMENT",
      name: "Assembly",
      code: "DEPT-01",
    });

    expect(prisma.orgUnit.create).toHaveBeenCalledWith({
      data: {
        siteId: "site1",
        parentId: "plant1",
        type: "DEPARTMENT",
        name: "Assembly",
        code: "DEPT-01",
      },
    });
  });
});
