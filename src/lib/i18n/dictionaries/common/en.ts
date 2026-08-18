export const en = {
  languageSwitcher: {
    ariaLabel: "Switch language",
  },
  nav: {
    administration: "Administration",
    workplaceOverview: "Workplace overview",
  },
  // B8c (SLD_NEXT_STEPS_B8b-B8f.md) reversed the dashboard/administration
  // dictionaries' original "BodyRegion/CameraAngle/RiskBand/RegionResult-
  // status stay raw, they mirror the DB/API/PDF verbatim" rule — for a
  // customer-facing Austrian product, raw English enum values reading
  // through a German UI is unfinished, not a deliberate technical-
  // vocabulary boundary. These four label sets live here in `common`
  // rather than duplicated into every area dictionary (dashboard/
  // administration/admin) that touches them, because the values they
  // translate are literally the same DB enum everywhere — unlike
  // HazardCategory/ActionStatus (business vocabulary a user picks from a
  // dropdown, genuinely duplicated per area per existing convention),
  // there's no per-area framing difference for "what is TRUNK called in
  // German" to justify three copies that could drift. describeRegionResult
  // ()/describeManualInput() (src/lib/capture/) also read these directly
  // rather than taking pre-translated strings, so the one shared
  // component that renders a RegionResult (PostureSampleSwitcher, used by
  // both the (app) dashboard and the internal /admin tool) can't describe
  // the same status two different ways.
  bodyRegionLabels: {
    NECK: "Neck",
    TRUNK: "Trunk",
    SHOULDER_LEFT: "Shoulder left",
    SHOULDER_RIGHT: "Shoulder right",
    UPPER_ARM_LEFT: "Upper arm left",
    UPPER_ARM_RIGHT: "Upper arm right",
    ELBOW_LEFT: "Elbow left",
    ELBOW_RIGHT: "Elbow right",
    FOREARM_LEFT: "Forearm left",
    FOREARM_RIGHT: "Forearm right",
    WRIST_LEFT: "Wrist left",
    WRIST_RIGHT: "Wrist right",
    HIP: "Hip",
    KNEE_LEFT: "Knee left",
    KNEE_RIGHT: "Knee right",
    ANKLE_LEFT: "Ankle left",
    ANKLE_RIGHT: "Ankle right",
  },
  cameraAngleLabels: {
    SAGITTAL: "Sagittal (side-on)",
    FRONTAL: "Frontal (front-on)",
    OBLIQUE: "Oblique",
  },
  riskBandLabels: {
    LOW: "Low",
    MODERATE: "Moderate",
    ELEVATED: "Elevated",
    HIGH: "High",
  },
  regionResultStatusLabels: {
    scored: "Scored",
    "wrong-camera-angle": "Wrong camera angle",
    "insufficient-visibility": "Insufficient visibility",
    "no-matching-rule": "No matching rule",
    "not-yet-supported": "Not yet supported",
  },
  // The sentence-structure words in describeRegionResult()'s output — the
  // enum values it interpolates (RiskBand, CameraAngle) come from the
  // label maps above; MediaPipe landmark property names (leftShoulder,
  // rightKnee, ...) inside insufficientVisibility's list stay untranslated
  // technical identifiers, same reasoning BodyRegion/status used to carry
  // for the whole app before B8c — they're MediaPipe's own API field
  // names, not this app's vocabulary.
  regionResultDetail: {
    scoreSuffix: (score: number) => `score ${score}`,
    wrongCameraAngle: (needs: string, got: string) =>
      `requires ${needs}, got ${got}`,
    insufficientVisibility: (landmarks: string) =>
      `low-confidence landmarks: ${landmarks}`,
    noThresholdMatched: "no threshold matched",
  },
  // Keyed by the canonical unit string ManualInput.unit is actually stored
  // as (MANUAL_INPUT_UNITS in src/lib/capture/manual-input.ts) — kg/N/s
  // are the same word in every locale this app supports, "reps" isn't.
  manualInputUnitLabels: {
    kg: "kg",
    N: "N",
    reps: "reps",
    s: "s",
  },
  // PostureSampleSwitcher (src/components/posture-sample-switcher.tsx) is
  // shared by the (app) dashboard and the internal /admin tool and, before
  // B8c, had no dictionary of its own at all — every string was a hardcoded
  // English literal. Collected here rather than split across dashboard/
  // admin dictionaries for the same one-shared-component reasoning as the
  // label sets above.
  postureSampleSwitcher: {
    tablistLabel: "Posture samples",
    tableRegion: "Region",
    tableStatus: "Status",
    tableDetail: "Detail",
    notScored: "not scored",
    validatedBadge: "Validated ✓",
    validatedBySuffix: (name: string) => `by ${name}`,
    pendingBadge: "Pending review",
    pendingBadgeShort: "Pending",
    manualEntryBadge: "Manual entry",
    holdTimeSummary: (seconds: number, postureBand: string) =>
      `Held ${seconds}s — posture ${postureBand}`,
    holdTimeEscalated: (overallBand: string) =>
      `hold time exceeds safe duration — ${overallBand}`,
  },
};
