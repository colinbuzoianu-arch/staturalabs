import type { RedirectSpec } from "./legacy-redirects";

// Intra-/app redirects for pages that moved between modules during the P2
// migration (SLD_RESTRUCTURE_PLAN_platform-modules.md §5). Separate from
// legacy-redirects.ts (the pre-/app flat→/app map) because these are
// within-/app module re-homings. Only paths that already carry :siteId can be
// static redirects; resource-first detail pages (e.g. a risk assessment id
// with no site in the URL) use a server stub that resolves the site first.
//
// Risk module (this commit): processes, assessments list, floor-plan list +
// detail moved out of /app/administration into /app/s/[siteId]/risk/…
export const MODULE_MIGRATION_REDIRECTS: readonly RedirectSpec[] = [
  {
    source: "/app/administration/sites/:siteId/processes",
    destination: "/app/s/:siteId/risk/processes",
    permanent: true,
  },
  {
    source: "/app/administration/sites/:siteId/risk-assessments",
    destination: "/app/s/:siteId/risk/assessments",
    permanent: true,
  },
  {
    source: "/app/administration/sites/:siteId/floor-plans/:floorPlanId",
    destination: "/app/s/:siteId/risk/floor-plan/:floorPlanId",
    permanent: true,
  },
  {
    source: "/app/administration/sites/:siteId/floor-plans",
    destination: "/app/s/:siteId/risk/floor-plan",
    permanent: true,
  },
];
