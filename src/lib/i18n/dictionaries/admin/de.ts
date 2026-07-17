import type { en } from "./en";

// Meaning-based translation, not word-for-word — see CLAUDE.md i18n notes.
export const de: typeof en = {
  layout: {
    companiesNav: "Unternehmen",
  },
  companiesPage: {
    heading: "Unternehmen",
    namePlaceholder: "Firmenname",
    create: "Erstellen",
    empty: "Noch keine Unternehmen vorhanden.",
    colName: "Name",
    colCreated: "Erstellt",
    colSites: "Standorte",
    sitesLink: "Standorte",
  },
  companySitesPage: {
    companiesBreadcrumb: "Unternehmen",
    heading: "Standorte",
    namePlaceholder: "Standortname",
    create: "Erstellen",
    empty: "Noch keine Standorte vorhanden.",
    colName: "Name",
    colCreated: "Erstellt",
    colWorkstations: "Arbeitsplätze",
    workstationsLink: "Arbeitsplätze",
  },
  siteWorkstationsPage: {
    companiesBreadcrumb: "Unternehmen",
    heading: "Arbeitsplätze",
    namePlaceholder: "Arbeitsplatzname",
    create: "Erstellen",
    empty: "Noch keine Arbeitsplätze vorhanden.",
    colName: "Name",
    colCreated: "Erstellt",
    colTasks: "Aufgaben",
    tasksLink: "Aufgaben",
  },
  workstationTasksPage: {
    companiesBreadcrumb: "Unternehmen",
    heading: "Aufgaben",
    assessmentSessionsLink: "Bewertungssitzungen",
    namePlaceholder: "Aufgabenname",
    create: "Erstellen",
    empty: "Noch keine Aufgaben vorhanden.",
    colName: "Name",
    colCreated: "Erstellt",
    colResults: "Ergebnisse",
    viewCaptures: "Aufnahmen ansehen",
    captureLink: "Aufnahme",
  },
  sessionsPage: {
    companiesBreadcrumb: "Unternehmen",
    heading: "Bewertungssitzungen",
    startedAtLabel: "Beginn",
    endedAtLabel: "Ende",
    modeLabel: "Modus",
    pilotContextLabel:
      "Pilotkontext (nur intern — wird Kunden nicht angezeigt)",
    pilotContextPlaceholder:
      "z. B. technischer Pilot bei Partnerstandort X, keine kommerzielle Zusammenarbeit",
    notesLabel: "Notizen",
    create: "Erstellen",
    empty: "Noch keine Bewertungssitzungen vorhanden.",
    colStarted: "Beginn",
    colEnded: "Ende",
    colMode: "Modus",
    colPilotContext: "Pilotkontext",
    colNotes: "Notizen",
    none: "—",
  },
  taskResultsPage: {
    companiesBreadcrumb: "Unternehmen",
    heading: (taskName: string) => `Aufnahmen: ${taskName}`,
    captureNewSample: "Neue Aufnahme erfassen",
    downloadReport: "Bericht herunterladen",
    cannotRecompute: (error: string) =>
      `Regionale Auswertung kann nicht neu berechnet werden: ${error}`,
    recomputeNote: (version: string) =>
      `Die untenstehenden Regionsauswertungen werden live aus den gespeicherten Landmarken jeder Aufnahme neu berechnet, auf Basis der aktuell aktiven Methodikversion (${version}) und der aktuellen Formeln — nicht zwangsläufig identisch mit dem, was zum Zeitpunkt der Aufnahme zurückgegeben/gespeichert wurde, falls sich Bewertungsregeln oder Formeln seitdem geändert haben (siehe CLAUDE.md, "Scoring lookup" / build-region-results.ts).`,
    empty: "Für diese Aufgabe liegen noch keine Aufnahmen vor.",
    recomputeError: (error: string) =>
      `Fehler bei der Neuberechnung dieser Aufnahme: ${error}`,
    colRegion: "Region",
    colStatus: "Status",
    colDetail: "Detail",
  },
};
