import type { en } from "./en";

// Meaning-based translation, not word-for-word — see CLAUDE.md i18n notes.
export const de: typeof en = {
  manualInputLabels: {
    LOAD_WEIGHT_KG: "Lastgewicht",
    PUSH_FORCE_N: "Schubkraft",
    PULL_FORCE_N: "Zugkraft",
    TOOL_USED: "Verwendetes Werkzeug",
    REPETITION_COUNT: "Wiederholungen",
    DURATION_SECONDS: "Dauer",
  },
  hazardCategoryLabels: {
    PHYSICAL_MECHANICAL: "Physikalisch / mechanisch",
    NOISE: "Lärm",
    VIBRATION: "Vibration",
    LIGHTING: "Beleuchtung",
    CLIMATE_THERMAL: "Klima / Hitze",
    CHEMICAL: "Chemisch",
    DUST_PARTICULATE: "Staub / Partikel",
    BIOLOGICAL: "Biologisch",
    ERGONOMIC_MSD: "Ergonomisch (Muskel-Skelett)",
    PSYCHOSOCIAL: "Psychosozial",
    ELECTRICAL: "Elektrisch",
    FIRE_EXPLOSION: "Brand / Explosion",
    RADIATION: "Strahlung",
  },
  actionStatusLabels: {
    OPEN: "Offen",
    IN_PROGRESS: "In Bearbeitung",
    IMPLEMENTED: "Umgesetzt",
    VERIFIED: "Verifiziert",
    CANCELLED: "Storniert",
  },
  footer: {
    copyright: (year: number) =>
      `© ${year} Verumsell SRL · Statura Labs Dynamics ist ein Produkt von Verumsell SRL.`,
  },
  sitesPage: {
    eyebrow: "Standortübersicht //",
    heading: "Standorte",
    empty: "Ihrem Konto sind noch keine Standorte zugewiesen.",
  },
  siteDetailPage: {
    breadcrumbSites: "Standorte",
    eyebrow: "Standort //",
    empty: "An diesem Standort sind noch keine Arbeitsplätze angelegt.",
    riskOverviewLink: "Risikoübersicht →",
    workerBriefingLink: "Information für die Arbeitnehmervertretung (PDF) →",
  },
  workstationPage: {
    breadcrumbSites: "Standorte",
    eyebrow: "Arbeitsplatz //",
    empty: "Für diesen Arbeitsplatz sind noch keine Aufgaben definiert.",
    riskAssessmentLink: "Gefährdungsbeurteilung →",
  },
  taskPage: {
    breadcrumbSites: "Standorte",
    eyebrow: "Aufgabe //",
    downloadReport: "Bericht herunterladen",
    captureSample: "Aufnahme starten",
    assessmentSessions: "Bewertungssitzungen",
    ongoing: "(laufend)",
    manualInputsHeading: "Manuelle Eingaben",
    manualInputsDescription:
      "Last-, Kraft- und Werkzeugkontext, der für diese Aufgabe erfasst wurde — nicht an eine bestimmte Haltungsaufnahme gebunden. Aktuell nur zum Erfassen; nichts kann in dieser Ansicht bearbeitet oder entfernt werden.",
    manualInputsEmpty:
      "Für diese Aufgabe wurden noch keine manuellen Eingaben erfasst.",
    postureSamplesHeading: "Haltungsaufnahmen",
    postureSamplesEmpty: "Für diese Aufgabe liegen noch keine Aufnahmen vor.",
    cannotRecompute: (error: string) =>
      `Regionale Auswertung kann nicht neu berechnet werden: ${error}`,
    recomputeError: (error: string) =>
      `Fehler bei der Neuberechnung dieser Aufnahme: ${error}`,
    cameraAngleField: "cameraAngle:",
    tableRegion: "Region",
    tableStatus: "Status",
    tableDetail: "Detail",
  },
  capturePage: {
    backToTask: "← Zurück zur Aufgabe",
    heading: "Haltungsaufnahme erfassen",
    cameraLabel: "Kamera",
    cameraAngleLabel: "Kamerawinkel",
    cameraAngleHint: {
      SAGITTAL:
        "Seitlich — erforderlich für die Bewertung von Rumpf, Nacken, Ellbogen und Knie.",
      FRONTAL:
        "Frontal — aus diesem Winkel können nur die Schulterregionen bewertet werden.",
      OBLIQUE:
        "Weder seitlich noch frontal — aus diesem Winkel können nur die Schulterregionen bewertet werden.",
    },
    noPersonDetected:
      "Keine Person im Bild erkannt. Bildausschnitt anpassen und erneut versuchen.",
    loadingPoseModel: "Haltungsmodell wird geladen…",
    detecting: "Erkennung läuft…",
    submitting: "Wird gesendet…",
    captureSample: "Aufnahme starten",
    peopleDetected: (count: number) =>
      `${count} Personen erkannt. Klicken Sie auf das hervorgehobene Skelett der zu bewertenden Person.`,
    selectPerson: (n: number) => `Person ${n} auswählen`,
    cancelAndRetake: "Abbrechen und erneut aufnehmen",
    sampleMeta: (id: string, version: string) =>
      `Aufnahme ${id} — Methodik ${version}`,
    tableRegion: "Region",
    tableStatus: "Status",
    tableDetail: "Detail",
    captureAnother: "Weitere Aufnahme erfassen",
    manualInputsHeading: "Manuelle Eingaben",
    manualInputsDescription:
      "Lastgewicht, Schub-/Zugkraft oder verwendetes Werkzeug für diese Aufgabe — nicht an eine bestimmte Haltungsaufnahme gebunden.",
    typeLabel: "Typ",
    toolLabel: "Werkzeug",
    valueLabel: (unit: string | null) => `Wert (${unit})`,
    notesLabel: "Notizen (optional)",
    adding: "Wird hinzugefügt…",
    add: "Hinzufügen",
    cameraFeedNotReady:
      "Kamerabild noch nicht bereit — bitte kurz warten, bis die Vorschau erscheint, und erneut versuchen.",
    canvasUnavailable: "Canvas-2D-Kontext nicht verfügbar",
    failedToLoadPoseModel: (message: string) =>
      `Haltungsmodell konnte nicht geladen werden: ${message}`,
    cameraAccessFailed: (message: string) =>
      `Kamerazugriff fehlgeschlagen: ${message}`,
    couldNotSwitchCamera: (message: string) =>
      `Kamera konnte nicht gewechselt werden: ${message}`,
    submitFailed: "Senden fehlgeschlagen",
    detectionFailed: "Erkennung fehlgeschlagen",
    requestFailed: (status: number) => `Anfrage fehlgeschlagen: ${status}`,
  },
  workstationRiskPage: {
    breadcrumbSites: "Standorte",
    breadcrumbLabel: "Gefährdungsbeurteilung",
    eyebrow: "Gefährdungsbeurteilung //",
    backToWorkstation: "← Zurück zum Arbeitsplatz",
    noApprovedAssessment:
      "Für diesen Arbeitsplatz liegt noch keine freigegebene Gefährdungsbeurteilung vor.",
    latestAssessmentHeading: "Letzte freigegebene Gefährdungsbeurteilung",
    assessedAtLabel: "Beurteilt:",
    colAssessedAt: "Beurteilt",
    viewLink: "Ansehen / verwalten →",
    findingsHeading: "Feststellungen",
    colCategory: "Kategorie",
    colHazard: "Gefährdung",
    colBand: "Risikoband",
    colScore: "Risikowert",
    colControls: "Bestehende Maßnahmen",
    measurementsLabel: "Messungen:",
    overLimit: "über Grenzwert",
    ergonomicHeading: "Ergonomische Bewertung",
    ergonomicDescription:
      "Neueste Haltungsaufnahme je Aufgabe an diesem Arbeitsplatz — die vollständige regionale Auswertung ist auf der jeweiligen Aufgabenseite.",
    ergonomicEmpty:
      "Für die Aufgaben dieses Arbeitsplatzes liegen noch keine Haltungsaufnahmen vor.",
    colTask: "Aufgabe",
    colCapturedAt: "Aufgenommen",
    noSamples: "Noch keine Aufnahmen",
    concerningRegions: (count: number) =>
      `${count} Region(en) erhöht oder hoch`,
    noConcerningRegions: "Keine erhöhten/hohen Regionen",
    openActionsHeading: "Offene Maßnahmen",
    openActionsEmpty:
      "Für diesen Arbeitsplatz gibt es keine offenen Maßnahmen.",
    colTitle: "Titel",
    colStatus: "Status",
    colDue: "Fällig",
    bandTrendHeading: "Verlauf des Risikobands",
    bandTrendEmpty: "Noch keine Gefährdungsbeurteilungen erfasst.",
    colOverallBand: "Gesamtband",
  },
  siteRiskOverviewPage: {
    breadcrumbSites: "Standorte",
    eyebrow: "Standort-Risikoübersicht //",
    heading: "Risikoübersicht",
    backToSite: "← Zurück zum Standort",
    workstationsByBandHeading: "Arbeitsplätze nach Risikoband",
    workstationsByBandEmpty:
      "Noch kein Arbeitsplatz mit freigegebener Gefährdungsbeurteilung.",
    colWorkstation: "Arbeitsplatz",
    colBand: "Risikoband",
    colAssessedAt: "Beurteilt",
    noAssessment: "Keine freigegebene Beurteilung",
    findingsByCategoryHeading: "Feststellungen nach Gefährdungskategorie",
    findingsByCategoryEmpty: "Noch keine Feststellungen erfasst.",
    colCategory: "Kategorie",
    colCount: "Feststellungen",
    openActionsHeading: "Offene Maßnahmen",
    overdueActionsHeading: "Überfällige Maßnahmen",
    awaitingVerificationHeading: "Maßnahmen zur Verifizierung",
    actionsEmpty: "Keine.",
    colTitle: "Titel",
    colSubject: "Arbeitsplatz / Prozess",
    colDue: "Fällig",
    colStatus: "Status",
    viewLink: "Ansehen →",
  },
};
