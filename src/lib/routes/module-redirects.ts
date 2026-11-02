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
  // Environment module.
  {
    source: "/app/administration/sites/:siteId/environment",
    destination: "/app/s/:siteId/environment",
    permanent: true,
  },
  // Actions module.
  {
    source: "/app/administration/sites/:siteId/actions",
    destination: "/app/s/:siteId/actions",
    permanent: true,
  },
  // Reports module (the site risk overview).
  {
    source: "/app/sites/:siteId/risk-overview",
    destination: "/app/s/:siteId/reports",
    permanent: true,
  },
  // Settings module (master data: org tree, hazard catalogue).
  {
    source: "/app/administration/sites/:siteId/org-units",
    destination: "/app/s/:siteId/settings/org-units",
    permanent: true,
  },
  {
    source: "/app/administration/sites/:siteId/hazards",
    destination: "/app/s/:siteId/settings/hazards",
    permanent: true,
  },
  // The old site landing and its map now live at the Cockpit.
  {
    source: "/app/sites/:siteId",
    destination: "/app/s/:siteId",
    permanent: true,
  },
  {
    source: "/app/sites/:siteId/map",
    destination: "/app/s/:siteId",
    permanent: true,
  },
  // The admin site-picker home is superseded by the site chooser.
  {
    source: "/app/administration",
    destination: "/app/sites",
    permanent: true,
  },
];
