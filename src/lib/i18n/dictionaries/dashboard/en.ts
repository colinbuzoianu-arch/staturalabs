// Source-of-truth copy for the authenticated company_admin/site_admin
// dashboard. Deliberately does NOT cover BodyRegion/CameraAngle/RiskBand/
// RegionResult-status values, or describeRegionResult()/describeManualInput
// ()'s generated text — those are technical identifiers that are also what
// the DB/API/PDF report show verbatim; translating them would mean a
// parallel technical vocabulary that doesn't match the data itself. See
// CLAUDE.md i18n notes for the full rule.
export const en = {
  // Present mode (SLD_IMPLEMENTATION_PLAN_austria-first.md §7 B6): shared
  // shell chrome (exitLabel) plus one label per stop in the fixed keyboard
  // ←/→ sequence (site map → workstation risk → assessment detail →
  // action detail → verification history → SGD), used to prefix each
  // page's prev/next PresentModeNav buttons.
  presentMode: {
    exitLabel: "✕ Exit present mode",
    siteMapLabel: "Site map",
    workstationRiskLabel: "Workstation risk",
    assessmentLabel: "Assessment",
    actionLabel: "Action",
    verificationLabel: "Verification history",
    sgdLabel: "SGD (PDF)",
  },
  // ManualInputType labels ARE translated (unlike BodyRegion etc.) — these
  // are already a hand-authored presentation layer over the enum
  // (LOAD_WEIGHT_KG -> "Load weight"), not the raw enum value itself.
  manualInputLabels: {
    LOAD_WEIGHT_KG: "Load weight",
    PUSH_FORCE_N: "Push force",
    PULL_FORCE_N: "Pull force",
    TOOL_USED: "Tool used",
    REPETITION_COUNT: "Repetition count",
    DURATION_SECONDS: "Duration",
  },
  // Duplicated from administration/en.ts rather than shared — every i18n
  // area in this app is self-contained (no cross-area dictionary imports),
  // same as admin/dashboard/marketing already are. RiskBand itself stays
  // untranslated here too, same reasoning as administration's.
  hazardCategoryLabels: {
    PHYSICAL_MECHANICAL: "Physical / mechanical",
    NOISE: "Noise",
    VIBRATION: "Vibration",
    LIGHTING: "Lighting",
    CLIMATE_THERMAL: "Climate / thermal",
    CHEMICAL: "Chemical",
    DUST_PARTICULATE: "Dust / particulate",
    BIOLOGICAL: "Biological",
    ERGONOMIC_MSD: "Ergonomic (MSD)",
    PSYCHOSOCIAL: "Psychosocial",
    ELECTRICAL: "Electrical",
    FIRE_EXPLOSION: "Fire / explosion",
    RADIATION: "Radiation",
  },
  actionStatusLabels: {
    OPEN: "Open",
    IN_PROGRESS: "In progress",
    IMPLEMENTED: "Implemented",
    VERIFIED: "Verified",
    CANCELLED: "Cancelled",
  },
  // Duplicated from administration/en.ts, same reasoning as
  // hazardCategoryLabels/actionStatusLabels above — no cross-area
  // dictionary imports.
  verificationOutcomeLabels: {
    EFFECTIVE: "Effective",
    PARTIALLY_EFFECTIVE: "Partially effective",
    NOT_EFFECTIVE: "Not effective",
  },
  footer: {
    copyright: (year: number) =>
      `© ${year} Verumsell SRL · Statura Labs Dynamics is a product of Verumsell SRL.`,
  },
  sitesPage: {
    eyebrow: "Workplace overview //",
    heading: "Sites",
    empty: "No sites are assigned to your account yet.",
  },
  siteDetailPage: {
    breadcrumbSites: "Sites",
    eyebrow: "Site //",
    empty: "No workstations at this site yet.",
    riskOverviewLink: "Risk overview →",
    workerBriefingLink: "Worker representative briefing (PDF) →",
    sgdLink: "Generate SGD (PDF) →",
    presentModeLink: "▶ Present →",
  },
  workstationPage: {
    breadcrumbSites: "Sites",
    eyebrow: "Workstation //",
    empty: "No tasks defined at this workstation yet.",
    riskAssessmentLink: "Risk assessment →",
  },
  taskPage: {
    breadcrumbSites: "Sites",
    eyebrow: "Task //",
    downloadReport: "Download report",
    captureSample: "Capture Sample",
    assessmentSessions: "Assessment sessions",
    ongoing: "(ongoing)",
    manualInputsHeading: "Manual inputs",
    manualInputsDescription:
      "Load, force, and tool context recorded for this task — not tied to a specific posture sample. Creation-only for now; nothing here can be edited or removed from this view.",
    manualInputsEmpty: "No manual inputs recorded for this task yet.",
    // §64 ASchG requires manual load handling to be evaluated but Austria
    // sets no mandated method (no Lastenhandhabungsverordnung) — SLD
    // supplies one, cited, computed live from the most recent
    // LOAD_WEIGHT_KG manual input (SLD_IMPLEMENTATION_PLAN_austria-
    // first.md §7 B8).
    manualHandlingHeading: "Manual handling assessment",
    manualHandlingResultLabel: (kg: number, band: string) =>
      `${kg} kg — ${band}`,
    manualHandlingDescription:
      "Austria (§64 ASchG) requires manual load handling to be evaluated but prescribes no method — SLD applies its own thresholds, inspired by ISO 11228-1/EN 1005-2, cited in the generated SGD.",
    postureSamplesHeading: "Posture samples",
    postureSamplesEmpty: "No captures yet for this task.",
    cannotRecompute: (error: string) =>
      `Cannot recompute region breakdowns: ${error}`,
    recomputeError: (error: string) =>
      `Error recomputing this sample: ${error}`,
    cameraAngleField: "cameraAngle:",
    tableRegion: "Region",
    tableStatus: "Status",
    tableDetail: "Detail",
  },
  capturePage: {
    backToTask: "← Back to task",
    heading: "Capture posture sample",
    cameraLabel: "Camera",
    cameraAngleLabel: "Camera angle",
    cameraAngleHint: {
      SAGITTAL: "Side-on — required for trunk, neck, elbow, and knee scoring.",
      FRONTAL:
        "Front-on — only shoulder regions can be scored from this angle.",
      OBLIQUE:
        "Neither side-on nor front-on — only shoulder regions can be scored from this angle.",
    },
    noPersonDetected:
      "No person detected in frame. Adjust framing and try again.",
    loadingPoseModel: "Loading pose model…",
    detecting: "Detecting…",
    submitting: "Submitting…",
    captureSample: "Capture Sample",
    peopleDetected: (count: number) =>
      `${count} people detected. Click the highlighted skeleton for the person being assessed.`,
    selectPerson: (n: number) => `Select person ${n}`,
    cancelAndRetake: "Cancel and retake",
    sampleMeta: (id: string, version: string) =>
      `Sample ${id} — methodology ${version}`,
    tableRegion: "Region",
    tableStatus: "Status",
    tableDetail: "Detail",
    captureAnother: "Capture another sample",
    manualInputsHeading: "Manual inputs",
    manualInputsDescription:
      "Load weight, push/pull force, or tool used for this task — not tied to a specific posture sample.",
    typeLabel: "Type",
    toolLabel: "Tool",
    valueLabel: (unit: string | null) => `Value (${unit})`,
    notesLabel: "Notes (optional)",
    adding: "Adding…",
    add: "Add",
    cameraFeedNotReady:
      "Camera feed not ready yet — wait a moment for the preview to appear, then try again.",
    canvasUnavailable: "Canvas 2D context unavailable",
    failedToLoadPoseModel: (message: string) =>
      `Failed to load pose model: ${message}`,
    cameraAccessFailed: (message: string) => `Camera access failed: ${message}`,
    couldNotSwitchCamera: (message: string) =>
      `Could not switch camera: ${message}`,
    submitFailed: "Submit failed",
    detectionFailed: "Detection failed",
    requestFailed: (status: number) => `Request failed: ${status}`,
    // Manual entry (SLD_IMPLEMENTATION_PLAN_austria-first.md §5): a
    // goniometer/tape-measure alternative to the camera flow above,
    // switched via a tab on this same page — not a separate route. Region
    // names themselves stay untranslated everywhere in this dictionary
    // (see the file-level i18n scope note) — angleDegreesLabel takes the
    // raw BodyRegion string and only wraps it with translated framing.
    captureTabLabel: "Capture",
    manualEntryTabLabel: "Manual entry",
    manualEntryHeading: "Enter measured angles",
    manualEntryDescription:
      "For every region below, enter the flexion angle from neutral (0° = upright, increasing = more flexed) as measured with a goniometer or estimated by eye. All eight are required for a complete sample.",
    angleDegreesLabel: (region: string) => `${region} (°)`,
    manualEntryNotScored: "not scored yet",
    manualEntrySubmit: "Submit manual entry",
    manualEntrySubmitting: "Submitting…",
    manualEntryAnother: "Enter another manual sample",
    manualEntryRulesLoading: "Loading scoring rules…",
    manualEntryRulesFailed: (message: string) =>
      `Could not load scoring rules for live preview: ${message}`,
    // Hold time (§6): optional on both the camera flow and manual entry —
    // "how long was this specific posture held," feeding a parallel
    // sub-score, never blended into the posture band itself.
    holdDurationLabel: "Hold duration (seconds, optional)",
    holdDurationPlaceholder: "e.g. 30",
    holdTimeSummary: (seconds: number, postureBand: string) =>
      `Held ${seconds}s at posture ${postureBand}.`,
    holdTimeEscalated: (overallBand: string) =>
      `Exceeds the safe hold duration for this posture — overall ${overallBand}.`,
  },
  workstationRiskPage: {
    breadcrumbSites: "Sites",
    breadcrumbLabel: "Risk assessment",
    eyebrow: "Risk assessment //",
    backToWorkstation: "← Back to workstation",
    sgdLink: "Generate SGD for this workstation (PDF) →",
    noApprovedAssessment:
      "No approved risk assessment yet for this workstation.",
    latestAssessmentHeading: "Latest approved risk assessment",
    assessedAtLabel: "Assessed:",
    viewLink: "View / manage →",
    findingsHeading: "Findings",
    colCategory: "Category",
    colHazard: "Hazard",
    colBand: "Band",
    colScore: "Score",
    colControls: "Existing controls",
    measurementsLabel: "Measurements:",
    overLimit: "over limit",
    overActionValue: "over action value",
    ergonomicHeading: "Ergonomic scores",
    ergonomicDescription:
      "Most recent posture sample per task at this workstation — full per-region detail is on each task's page.",
    ergonomicEmpty:
      "No posture samples captured for this workstation's tasks yet.",
    colTask: "Task",
    colCapturedAt: "Captured",
    noSamples: "No samples yet",
    concerningRegions: (count: number) => `${count} region(s) elevated or high`,
    noConcerningRegions: "No elevated/high regions",
    openActionsHeading: "Open actions",
    openActionsEmpty: "No open actions for this workstation.",
    colTitle: "Title",
    colStatus: "Status",
    colDue: "Due",
    bandTrendHeading: "Risk band trend",
    bandTrendEmpty: "No risk assessments recorded yet.",
    verifiedByPrefix: "Verified by:",
  },
  siteRiskOverviewPage: {
    breadcrumbSites: "Sites",
    eyebrow: "Site risk overview //",
    heading: "Risk overview",
    backToSite: "← Back to site",
    workstationsByBandHeading: "Workstations by risk band",
    workstationsByBandEmpty:
      "No workstations with an approved risk assessment yet.",
    colWorkstation: "Workstation",
    colBand: "Band",
    colAssessedAt: "Assessed",
    noAssessment: "No approved assessment",
    findingsByCategoryHeading: "Findings by hazard category",
    findingsByCategoryEmpty: "No findings recorded yet.",
    colCategory: "Category",
    colCount: "Findings",
    openActionsHeading: "Open actions",
    overdueActionsHeading: "Overdue actions",
    awaitingVerificationHeading: "Actions awaiting verification",
    actionsEmpty: "None.",
    colTitle: "Title",
    colSubject: "Workstation / process",
    colDue: "Due",
    colStatus: "Status",
    viewLink: "View →",
  },
  // Passed as a prop into a Client Component (the interactive map overlay)
  // — same constraint as administration's floorPlanPlacementPage: every
  // value here must stay a plain string, never a function. RiskBand values
  // themselves stay untranslated on the map too, same reasoning as
  // workstationRiskPage/siteRiskOverviewPage above.
  siteMapPage: {
    manageFloorPlansLink: "Manage floor plans →",
    categoryFilterHeading: "Filter by hazard category",
    allCategoriesLabel: "All categories",
    legendHeading: "Legend",
    legendWorkstationShape: "Workstation (aggregate)",
    legendTaskShape: "Task (individual measurement)",
    legendNotAssessedColor: "Not yet assessed",
    taskPopoverWorkstationPrefix: "Workstation:",
    taskPopoverBandPrefix: "Worst band:",
    taskPopoverConcerningHeading: "Concerning regions:",
    taskPopoverNoConcerning: "No elevated/high regions",
    taskPopoverViewLink: "View task →",
    workstationPopoverBandPrefix: "Band:",
    workstationPopoverNotAssessed: "Not yet assessed",
    workstationPopoverNoFindingsForCategory:
      "No findings in this category for the active filter",
    workstationPopoverOpenActionsPrefix: "Open actions:",
    workstationPopoverViewLink: "View workstation risk →",
    workstationPopoverTasksPlacedSuffix: "tasks placed",
    workstationPopoverUnplacedBandPrefix:
      "Worst ergonomic band (remaining tasks):",
    workstationPopoverNoUnplacedData:
      "No posture data yet for the remaining tasks",
  },
};
