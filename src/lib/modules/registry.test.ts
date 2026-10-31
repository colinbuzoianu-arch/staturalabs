import { describe, expect, it } from "vitest";
import { ModuleKey } from "@/generated/prisma/enums";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  baselineModuleKeys,
  getModuleDefinition,
  MODULE_REGISTRY,
  modulesInMenuOrder,
} from "./registry";

describe("module registry", () => {
  it("defines exactly one entry for every ModuleKey", () => {
    const keys = MODULE_REGISTRY.map((m) => m.key).sort();
    const enumKeys = Object.values(ModuleKey).sort();
    expect(keys).toEqual(enumKeys);
    // No duplicates.
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("references a real permission on every module", () => {
    for (const m of MODULE_REGISTRY) {
      expect(PERMISSIONS).toContain(m.permission);
    }
  });

  it("marks exactly cockpit/my-tasks/actions/documents/settings as baseline", () => {
    expect([...baselineModuleKeys()].sort()).toEqual(
      [
        ModuleKey.COCKPIT,
        ModuleKey.MY_TASKS,
        ModuleKey.ACTIONS,
        ModuleKey.DOCUMENTS,
        ModuleKey.SETTINGS,
      ].sort(),
    );
  });

  it("builds site-scoped base paths, with my-tasks and settings cross-cutting", () => {
    expect(getModuleDefinition(ModuleKey.RISK).basePath("site1")).toBe(
      "/app/s/site1/risk",
    );
    expect(getModuleDefinition(ModuleKey.MY_TASKS).basePath("site1")).toBe(
      "/app/me",
    );
    expect(getModuleDefinition(ModuleKey.SETTINGS).basePath("site1")).toBe(
      "/app/settings",
    );
  });

  it("orders the menu by group then order, with settings pinned last", () => {
    const ordered = modulesInMenuOrder();
    expect(ordered[0].key).toBe(ModuleKey.COCKPIT);
    expect(ordered[ordered.length - 1].key).toBe(ModuleKey.SETTINGS);
  });

  it("uses unique order values and stable child slugs", () => {
    const orders = MODULE_REGISTRY.map((m) => m.order);
    expect(new Set(orders).size).toBe(orders.length);
    for (const m of MODULE_REGISTRY) {
      const slugs = m.children.map((c) => c.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
    }
  });
});
