import type { en } from "./en";

export const de: typeof en = {
  languageSwitcher: {
    ariaLabel: "Sprache wechseln",
  },
  nav: {
    administration: "Verwaltung",
    workplaceOverview: "Arbeitsplatzübersicht",
  },
  bodyRegionLabels: {
    NECK: "Nacken",
    TRUNK: "Rumpf",
    SHOULDER_LEFT: "Schulter links",
    SHOULDER_RIGHT: "Schulter rechts",
    UPPER_ARM_LEFT: "Oberarm links",
    UPPER_ARM_RIGHT: "Oberarm rechts",
    ELBOW_LEFT: "Ellbogen links",
    ELBOW_RIGHT: "Ellbogen rechts",
    FOREARM_LEFT: "Unterarm links",
    FOREARM_RIGHT: "Unterarm rechts",
    WRIST_LEFT: "Handgelenk links",
    WRIST_RIGHT: "Handgelenk rechts",
    HIP: "Hüfte",
    KNEE_LEFT: "Knie links",
    KNEE_RIGHT: "Knie rechts",
    ANKLE_LEFT: "Knöchel links",
    ANKLE_RIGHT: "Knöchel rechts",
  },
  cameraAngleLabels: {
    SAGITTAL: "Sagittal (seitlich)",
    FRONTAL: "Frontal",
    OBLIQUE: "Schräg",
  },
  riskBandLabels: {
    LOW: "Gering",
    MODERATE: "Mäßig",
    ELEVATED: "Erhöht",
    HIGH: "Hoch",
  },
  regionResultStatusLabels: {
    scored: "Bewertet",
    "wrong-camera-angle": "Falscher Kamerawinkel",
    "insufficient-visibility": "Unzureichende Sichtbarkeit",
    "no-matching-rule": "Keine passende Regel",
    "not-yet-supported": "Noch nicht unterstützt",
    "not-assessed": "Nicht beurteilt",
  },
  regionResultDetail: {
    scoreSuffix: (score: number) => `Wert ${score}`,
    wrongCameraAngle: (needs: string, got: string) =>
      `erfordert ${needs}, erhalten ${got}`,
    insufficientVisibility: (landmarks: string) =>
      `Messpunkte mit geringer Erkennungssicherheit: ${landmarks}`,
    noThresholdMatched: "keine Schwelle zugeordnet",
  },
  manualInputUnitLabels: {
    kg: "kg",
    N: "N",
    reps: "Wdh.",
    s: "s",
  },
  postureSampleSwitcher: {
    tablistLabel: "Haltungsaufnahmen",
    tableRegion: "Region",
    tableStatus: "Status",
    tableDetail: "Detail",
    notScored: "noch nicht bewertet",
    validatedBadge: "Freigegeben ✓",
    validatedBySuffix: (name: string) => `von ${name}`,
    pendingBadge: "Prüfung ausstehend",
    pendingBadgeShort: "Ausstehend",
    manualEntryBadge: "Manuelle Eingabe",
    holdTimeSummary: (seconds: number, postureBand: string) =>
      `${seconds}s gehalten — Haltung ${postureBand}`,
    holdTimeEscalated: (overallBand: string) =>
      `überschreitet die sichere Haltedauer — ${overallBand}`,
  },
};
