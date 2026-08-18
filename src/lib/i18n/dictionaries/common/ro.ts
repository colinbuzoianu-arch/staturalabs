import type { en } from "./en";

export const ro: typeof en = {
  languageSwitcher: {
    ariaLabel: "Schimbă limba",
  },
  nav: {
    administration: "Administrare",
    workplaceOverview: "Prezentare generală a locurilor de muncă",
  },
  bodyRegionLabels: {
    NECK: "Gât",
    TRUNK: "Trunchi",
    SHOULDER_LEFT: "Umăr stânga",
    SHOULDER_RIGHT: "Umăr dreapta",
    UPPER_ARM_LEFT: "Braț superior stânga",
    UPPER_ARM_RIGHT: "Braț superior dreapta",
    ELBOW_LEFT: "Cot stânga",
    ELBOW_RIGHT: "Cot dreapta",
    FOREARM_LEFT: "Antebraț stânga",
    FOREARM_RIGHT: "Antebraț dreapta",
    WRIST_LEFT: "Încheietura mâinii stânga",
    WRIST_RIGHT: "Încheietura mâinii dreapta",
    HIP: "Șold",
    KNEE_LEFT: "Genunchi stânga",
    KNEE_RIGHT: "Genunchi dreapta",
    ANKLE_LEFT: "Gleznă stânga",
    ANKLE_RIGHT: "Gleznă dreapta",
  },
  cameraAngleLabels: {
    SAGITTAL: "Sagital (din lateral)",
    FRONTAL: "Frontal",
    OBLIQUE: "Oblic",
  },
  riskBandLabels: {
    LOW: "Scăzut",
    MODERATE: "Moderat",
    ELEVATED: "Crescut",
    HIGH: "Ridicat",
  },
  regionResultStatusLabels: {
    scored: "Evaluat",
    "wrong-camera-angle": "Unghi de cameră greșit",
    "insufficient-visibility": "Vizibilitate insuficientă",
    "no-matching-rule": "Nicio regulă potrivită",
    "not-yet-supported": "Neacceptat încă",
    "not-assessed": "Neevaluat",
  },
  regionResultDetail: {
    scoreSuffix: (score: number) => `scor ${score}`,
    wrongCameraAngle: (needs: string, got: string) =>
      `necesită ${needs}, primit ${got}`,
    insufficientVisibility: (landmarks: string) =>
      `puncte de reper cu vizibilitate redusă: ${landmarks}`,
    noThresholdMatched: "niciun prag potrivit",
  },
  manualInputUnitLabels: {
    kg: "kg",
    N: "N",
    reps: "rep.",
    s: "s",
  },
  postureSampleSwitcher: {
    tablistLabel: "Capturi de postură",
    tableRegion: "Regiune",
    tableStatus: "Status",
    tableDetail: "Detalii",
    notScored: "neevaluat încă",
    validatedBadge: "Validat ✓",
    validatedBySuffix: (name: string) => `de ${name}`,
    pendingBadge: "În așteptarea revizuirii",
    pendingBadgeShort: "În așteptare",
    manualEntryBadge: "Introducere manuală",
    holdTimeSummary: (seconds: number, postureBand: string) =>
      `Menținut ${seconds}s — postură ${postureBand}`,
    holdTimeEscalated: (overallBand: string) =>
      `depășește durata sigură de menținere — ${overallBand}`,
  },
};
