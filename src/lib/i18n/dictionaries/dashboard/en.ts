// Source-of-truth copy for the authenticated company_admin/site_admin
// dashboard. BodyRegion/CameraAngle/RiskBand/RegionResult-status values,
// and describeRegionResult()/describeManualInput()'s generated text, ARE
// translated as of B8c (SLD_NEXT_STEPS_B8b-B8f.md) — the pre-B8c "stays
// raw, they mirror the DB/API/PDF verbatim" rule this comment used to
// state made sense when the product was a dev tool; for a customer-facing
// Austrian product it read as unfinished. The label maps themselves live
// in the shared common dictionary (src/lib/i18n/dictionaries/common/),
// not duplicated here — see that file's own comment for why.
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
  // same as admin/dashboard/marketing already are. RiskBand itself IS
  // translated as of B8c (SLD_NEXT_STEPS_B8b-B8f.md) — via
  // riskBandLabels in the shared common dictionary
  // (src/lib/i18n/dictionaries/common/), not duplicated here, since it's
  // literally the same enum BodyRegionScore speaks on the ergonomic side
  // and PostureSampleSwitcher/describeRegionResult already read it from
  // there — see common/en.ts's own comment for why that one label set
  // isn't duplicated per area the way this one is.
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
  // hazardCategoryLabels/actionStatusLabels above. Added in B8c
  // (SLD_NEXT_STEPS_B8b-B8f.md) — the workstation risk page's band-trend
  // timeline renders RiskAssessment.status directly and had no
  // translated label for it until now.
  riskAssessmentStatusLabels: {
    DRAFT: "Draft",
    IN_REVIEW: "In review",
    APPROVED: "Approved",
    ARCHIVED: "Archived",
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
    // B8d (SLD_NEXT_STEPS_B8b-B8f.md): a parallel sub-score against the
    // most recently recorded REPETITION_COUNT manual input — reps per
    // task cycle, no frequency calculation.
    repetitionHeading: "Repetition assessment",
    repetitionResultLabel: (reps: number, band: string) =>
      `${reps} reps/cycle — ${band}`,
    repetitionDescription:
      "SLD applies its own thresholds to repetitions per task cycle, inspired by ISO 11228-3/EN 1005-5, cited in the generated SGD.",
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
    submitFailed: "Submit failed",
    requestFailed: (status: number) => `Request failed: ${status}`,
    // B11 (SLD_IMPLEMENTATION_PLAN_posture-input.md §3): category entry is
    // now the primary path — the assessor classifies what they observe
    // ("Rumpf: gebeugt") rather than typing a degree nobody actually
    // measured. Category names are hand-authored presentation copy over
    // each region's ScoringRule rows, keyed by region + the same sorted
    // index derivePostureCategories() returns (src/lib/scoring/posture-
    // categories.ts) — same class as manualInputLabels, not a technical CV
    // artifact, so (unlike bodyRegionLabels/riskBandLabels in the shared
    // common dictionary) this lives here rather than being duplicated
    // per-area, per the plan's own explicit instruction.
    postureCategoryHeading: "Assess posture",
    postureCategoryDescription:
      'For every region below, pick the posture category that best matches what you observe — no measurement needed. At least one region is required; leave the rest as "Not assessed" if you did not observe them this time.',
    notAssessedOption: "Not assessed",
    categoryOptionLabel: (name: string, range: string, band: string) =>
      `${name} (${range}) — ${band}`,
    postureCategoryLabels: {
      TRUNK: ["Upright", "Bent", "Strongly bent"],
      NECK: [
        "Strong backward tilt",
        "Backward tilt",
        "Slight backward tilt",
        "Upright",
        "Forward tilt",
        "Strong forward tilt",
      ],
      SHOULDER_LEFT: [
        "Neutral",
        "Slightly raised",
        "Raised",
        "Strongly raised",
      ],
      SHOULDER_RIGHT: [
        "Neutral",
        "Slightly raised",
        "Raised",
        "Strongly raised",
      ],
      ELBOW_LEFT: ["Nearly straight", "Bent", "Strongly bent"],
      ELBOW_RIGHT: ["Nearly straight", "Bent", "Strongly bent"],
      KNEE_LEFT: ["Straight", "Bent", "Strongly bent"],
      KNEE_RIGHT: ["Straight", "Bent", "Strongly bent"],
      WRIST_LEFT: ["Strong extension", "Neutral", "Strong flexion"],
      WRIST_RIGHT: ["Strong extension", "Neutral", "Strong flexion"],
    },
    // The pre-B11 precise-entry path (SLD_IMPLEMENTATION_PLAN_austria-
    // first.md §5), kept reachable behind the "expert mode" toggle for an
    // assessor who genuinely measured with a goniometer/inclinometer app.
    // Region names themselves stay untranslated everywhere in this
    // dictionary (see the file-level i18n scope note) — angleDegreesLabel
    // takes the raw BodyRegion string and only wraps it with translated
    // framing.
    expertModeToggleLabel: "Expert mode: degree entry",
    expertModeDescription:
      "For an assessor who measured with a goniometer or inclinometer app — enter a precise degree value per region instead of picking a category.",
    manualEntryHeading: "Enter measured angles",
    manualEntryDescription:
      "For every region below, enter the flexion angle from neutral (0° = upright, increasing = more flexed). At least one region is required; leave the rest blank if you did not measure them this time.",
    angleDegreesLabel: (region: string) => `${region} (°)`,
    manualEntryNotScored: "not scored yet",
    manualEntrySubmit: "Submit posture sample",
    manualEntrySubmitting: "Submitting…",
    manualEntryAnother: "Enter another sample",
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
    actionValuePrefix: "action",
    limitPrefix: "limit",
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
