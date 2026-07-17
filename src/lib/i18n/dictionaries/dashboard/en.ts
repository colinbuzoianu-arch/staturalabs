// Source-of-truth copy for the authenticated company_admin/site_admin
// dashboard. Deliberately does NOT cover BodyRegion/CameraAngle/RiskBand/
// RegionResult-status values, or describeRegionResult()/describeManualInput
// ()'s generated text — those are technical identifiers that are also what
// the DB/API/PDF report show verbatim; translating them would mean a
// parallel technical vocabulary that doesn't match the data itself. See
// CLAUDE.md i18n notes for the full rule.
export const en = {
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
  },
  workstationPage: {
    breadcrumbSites: "Sites",
    eyebrow: "Workstation //",
    empty: "No tasks defined at this workstation yet.",
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
  },
};
