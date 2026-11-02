import { describe, expect, it } from "vitest";
import { MODULE_MIGRATION_REDIRECTS } from "./module-redirects";

describe("module migration redirects", () => {
  it("permanently maps each moved admin path to its module path, preserving params", () => {
    for (const spec of MODULE_MIGRATION_REDIRECTS) {
      expect(spec.permanent).toBe(true);
      expect(spec.source).toMatch(/^\/app\/administration\//);
      expect(spec.destination).toMatch(/^\/app\/s\/:siteId\//);
      // Every :param in the source reappears in the destination.
      const params = (spec.source.match(/:(\w+)/g) ?? []).sort();
      const destParams = (spec.destination.match(/:(\w+)/g) ?? []).sort();
      expect(destParams).toEqual(params);
    }
  });

  it("covers processes, assessments and floor-plan", () => {
    const dests = MODULE_MIGRATION_REDIRECTS.map((r) => r.destination);
    expect(dests).toContain("/app/s/:siteId/risk/processes");
    expect(dests).toContain("/app/s/:siteId/risk/assessments");
    expect(dests).toContain("/app/s/:siteId/risk/floor-plan");
    expect(dests).toContain("/app/s/:siteId/risk/floor-plan/:floorPlanId");
  });
});
