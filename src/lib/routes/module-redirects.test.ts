import { describe, expect, it } from "vitest";
import { MODULE_MIGRATION_REDIRECTS } from "./module-redirects";

describe("module migration redirects", () => {
  it("is permanent, /app-scoped, and preserves every path param", () => {
    for (const spec of MODULE_MIGRATION_REDIRECTS) {
      expect(spec.permanent).toBe(true);
      expect(spec.source).toMatch(/^\/app\//);
      expect(spec.destination).toMatch(/^\/app\//);
      // Every :param in the source reappears in the destination.
      const params = (spec.source.match(/:(\w+)/g) ?? []).sort();
      const destParams = (spec.destination.match(/:(\w+)/g) ?? []).sort();
      expect(destParams).toEqual(params);
    }
  });

  it("covers the migrated risk, environment, actions, reports and settings paths", () => {
    const dests = MODULE_MIGRATION_REDIRECTS.map((r) => r.destination);
    expect(dests).toContain("/app/s/:siteId/risk/processes");
    expect(dests).toContain("/app/s/:siteId/risk/assessments");
    expect(dests).toContain("/app/s/:siteId/risk/floor-plan");
    expect(dests).toContain("/app/s/:siteId/environment");
    expect(dests).toContain("/app/s/:siteId/actions");
    expect(dests).toContain("/app/s/:siteId/reports");
    expect(dests).toContain("/app/s/:siteId/settings/org-units");
    expect(dests).toContain("/app/s/:siteId/settings/hazards");
  });
});
