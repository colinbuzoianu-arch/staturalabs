import type { en } from "./en";

// Meaning-based translation, not word-for-word — see CLAUDE.md i18n notes.
export const ro: typeof en = {
  layout: {
    companiesNav: "Companii",
    demoResetNav: "Resetare demo",
  },
  demoResetPage: {
    heading: "Resetare date demo",
    description:
      "Șterge datele companiei demo și le regenerează de la zero (echivalent cu npm run reset:demo && npm run seed:demo din terminal) — pentru a recupera o demonstrație în timpul unei întâlniri, fără a părăsi browserul.",
    resetButton: "Resetează și regenerează datele demo",
    successMessage: "Datele demo au fost resetate și regenerate cu succes.",
    unknownError:
      "Resetarea a eșuat — nu a fost capturat niciun mesaj de eroare.",
  },
  companiesPage: {
    heading: "Companii",
    namePlaceholder: "Numele companiei",
    create: "Creează",
    empty: "Nu există încă nicio companie.",
    colName: "Nume",
    colCreated: "Creat",
    colSites: "Locații",
    sitesLink: "Locații",
  },
  companySitesPage: {
    companiesBreadcrumb: "Companii",
    heading: "Locații",
    namePlaceholder: "Numele locației",
    countryLabel: "Țară",
    create: "Creează",
    empty: "Nu există încă nicio locație.",
    colName: "Nume",
    colCountry: "Țară",
    colCreated: "Creat",
    colWorkstations: "Locuri de muncă",
    workstationsLink: "Locuri de muncă",
  },
  siteWorkstationsPage: {
    companiesBreadcrumb: "Companii",
    heading: "Locuri de muncă",
    namePlaceholder: "Numele locului de muncă",
    create: "Creează",
    empty: "Nu există încă niciun loc de muncă.",
    colName: "Nume",
    colCreated: "Creat",
    colTasks: "Sarcini",
    tasksLink: "Sarcini",
  },
  workstationTasksPage: {
    companiesBreadcrumb: "Companii",
    heading: "Sarcini",
    assessmentSessionsLink: "Sesiuni de evaluare",
    namePlaceholder: "Numele sarcinii",
    create: "Creează",
    empty: "Nu există încă nicio sarcină.",
    colName: "Nume",
    colCreated: "Creat",
    colResults: "Rezultate",
    viewCaptures: "Vezi capturile",
    captureLink: "Captură",
  },
  sessionsPage: {
    companiesBreadcrumb: "Companii",
    heading: "Sesiuni de evaluare",
    startedAtLabel: "Început la",
    endedAtLabel: "Încheiat la",
    modeLabel: "Mod",
    pilotContextLabel:
      "Context pilot (doar intern — nu este afișat clienților)",
    pilotContextPlaceholder:
      "de ex. pilot tehnic la locația partenerului X, fără colaborare comercială",
    notesLabel: "Note",
    create: "Creează",
    empty: "Nu există încă nicio sesiune de evaluare.",
    colStarted: "Început",
    colEnded: "Încheiat",
    colMode: "Mod",
    colPilotContext: "Context pilot",
    colNotes: "Note",
    none: "—",
  },
  taskResultsPage: {
    companiesBreadcrumb: "Companii",
    heading: (taskName: string) => `Capturi: ${taskName}`,
    captureNewSample: "Realizează o captură nouă",
    downloadReport: "Descarcă raportul",
    cannotRecompute: (error: string) =>
      `Detalierea pe regiuni nu poate fi recalculată: ${error}`,
    recomputeNote: (version: string) =>
      `Detalierile pe regiuni de mai jos sunt recalculate în timp real din reperele stocate ale fiecărei capturi, pe baza versiunii de metodologie active în prezent (${version}) și a formulelor curente — nu neapărat identice cu ceea ce a fost returnat/salvat la momentul capturii, dacă regulile de evaluare sau formulele s-au schimbat între timp (vezi CLAUDE.md, "Scoring lookup" / build-region-results.ts).`,
    empty: "Pentru această sarcină nu există încă nicio captură.",
    recomputeError: (error: string) =>
      `Eroare la recalcularea acestei capturi: ${error}`,
    colRegion: "Regiune",
    colStatus: "Status",
    colDetail: "Detalii",
  },
};
