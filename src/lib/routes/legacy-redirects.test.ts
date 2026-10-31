import { describe, expect, it } from "vitest";
import {
  LEGACY_REDIRECTS,
  RELOCATED_TOP_LEVEL_SEGMENTS,
  resolveLegacyRedirect,
} from "./legacy-redirects";

describe("legacy redirect map (§2.3 'every old URL redirects')", () => {
  it("defines one :path* redirect per relocated top-level segment", () => {
    expect(LEGACY_REDIRECTS).toHaveLength(RELOCATED_TOP_LEVEL_SEGMENTS.length);
    for (const spec of LEGACY_REDIRECTS) {
      expect(spec.permanent).toBe(true);
      expect(spec.source).toMatch(
        /^\/(sites|workstations|tasks|administration)\/:path\*$/,
      );
      expect(spec.destination).toBe(`/app${spec.source}`);
    }
  });

  it("resolves every old pattern (base and nested) to its /app equivalent", () => {
    const cases: [string, string][] = [
      ["/sites", "/app/sites"],
      ["/sites/abc", "/app/sites/abc"],
      ["/sites/abc/risk-overview", "/app/sites/abc/risk-overview"],
      ["/workstations/w1", "/app/workstations/w1"],
      ["/workstations/w1/risk", "/app/workstations/w1/risk"],
      ["/tasks/t1", "/app/tasks/t1"],
      ["/tasks/t1/assess", "/app/tasks/t1/assess"],
      ["/administration", "/app/administration"],
      [
        "/administration/sites/s1/org-units",
        "/app/administration/sites/s1/org-units",
      ],
      [
        "/administration/risk-assessments/ra1",
        "/app/administration/risk-assessments/ra1",
      ],
    ];
    for (const [from, to] of cases) {
      expect(resolveLegacyRedirect(from)).toBe(to);
    }
  });

  it("leaves non-relocated paths untouched (no loop, no over-match)", () => {
    for (const p of [
      "/app/sites",
      "/app/workstations/w1",
      "/admin",
      "/admin/tasks/t1",
      "/api/tasks/t1/report",
      "/login",
      "/at",
      "/",
      "/sitesomething", // not a segment boundary — must not match
    ]) {
      expect(resolveLegacyRedirect(p)).toBeNull();
    }
  });
});
