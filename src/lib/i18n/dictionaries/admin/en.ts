// Source-of-truth copy for the internal super_admin-only /admin CRUD tool.
// Translated for completeness/consistency, but this tool is explicitly
// "no styling effort" (CLAUDE.md) — plain, functional copy, no marketing
// polish. Same technical-vocabulary exclusions as the dashboard dictionary
// (BodyRegion/CameraAngle/status values, describeRegionResult() output).
export const en = {
  layout: {
    companiesNav: "Companies",
    demoResetNav: "Demo reset",
  },
  demoResetPage: {
    heading: "Reset demo fixture",
    description:
      "Wipes the demo company's data and reseeds it from scratch (same as running npm run reset:demo && npm run seed:demo from a terminal) — for recovering a demo mid-meeting without leaving the browser.",
    resetButton: "Reset and reseed demo data",
    successMessage: "Demo fixture reset and reseeded successfully.",
    unknownError: "Reset failed — no error output captured.",
  },
  companiesPage: {
    heading: "Companies",
    namePlaceholder: "Company name",
    create: "Create",
    empty: "No companies yet.",
    colName: "Name",
    colCreated: "Created",
    colSites: "Sites",
    sitesLink: "Sites",
  },
  companySitesPage: {
    companiesBreadcrumb: "Companies",
    heading: "Sites",
    namePlaceholder: "Site name",
    countryLabel: "Country",
    create: "Create",
    empty: "No sites yet.",
    colName: "Name",
    colCountry: "Country",
    colCreated: "Created",
    colWorkstations: "Workstations",
    workstationsLink: "Workstations",
  },
  siteWorkstationsPage: {
    companiesBreadcrumb: "Companies",
    heading: "Workstations",
    namePlaceholder: "Workstation name",
    create: "Create",
    empty: "No workstations yet.",
    colName: "Name",
    colCreated: "Created",
    colTasks: "Tasks",
    tasksLink: "Tasks",
  },
  workstationTasksPage: {
    companiesBreadcrumb: "Companies",
    heading: "Tasks",
    assessmentSessionsLink: "Assessment sessions",
    namePlaceholder: "Task name",
    create: "Create",
    empty: "No tasks yet.",
    colName: "Name",
    colCreated: "Created",
    colResults: "Results",
    viewCaptures: "View captures",
    captureLink: "Capture",
  },
  sessionsPage: {
    companiesBreadcrumb: "Companies",
    heading: "Assessment sessions",
    startedAtLabel: "Started at",
    endedAtLabel: "Ended at",
    modeLabel: "Mode",
    pilotContextLabel: "Pilot context (internal only — not shown to customers)",
    pilotContextPlaceholder:
      "e.g. technical pilot at partner site X, no commercial engagement",
    notesLabel: "Notes",
    create: "Create",
    empty: "No assessment sessions yet.",
    colStarted: "Started",
    colEnded: "Ended",
    colMode: "Mode",
    colPilotContext: "Pilot context",
    colNotes: "Notes",
    none: "—",
  },
  taskResultsPage: {
    companiesBreadcrumb: "Companies",
    heading: (taskName: string) => `Captures: ${taskName}`,
    captureNewSample: "Capture a new sample",
    downloadReport: "Download report",
    cannotRecompute: (error: string) =>
      `Cannot recompute region breakdowns: ${error}`,
    recomputeNote: (version: string) =>
      `Region breakdowns below are recomputed live from each sample's stored landmarks against the currently active methodology version (${version}) and current formulas — not necessarily identical to what was returned/persisted at capture time if scoring rules or formulas have changed since (see CLAUDE.md, "Scoring lookup" / build-region-results.ts).`,
    empty: "No captures yet for this task.",
    recomputeError: (error: string) =>
      `Error recomputing this sample: ${error}`,
    colRegion: "Region",
    colStatus: "Status",
    colDetail: "Detail",
  },
};
