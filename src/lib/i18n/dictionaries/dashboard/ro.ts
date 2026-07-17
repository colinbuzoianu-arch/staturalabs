import type { en } from "./en";

// Meaning-based translation, not word-for-word — see CLAUDE.md i18n notes.
export const ro: typeof en = {
  manualInputLabels: {
    LOAD_WEIGHT_KG: "Greutate sarcină",
    PUSH_FORCE_N: "Forță de împingere",
    PULL_FORCE_N: "Forță de tragere",
    TOOL_USED: "Unealtă folosită",
    REPETITION_COUNT: "Număr de repetări",
    DURATION_SECONDS: "Durată",
  },
  footer: {
    copyright: (year: number) =>
      `© ${year} Verumsell SRL · Statura Labs Dynamics este un produs Verumsell SRL.`,
  },
  sitesPage: {
    eyebrow: "Prezentare generală a locațiilor //",
    heading: "Locații",
    empty: "Contului dumneavoastră nu îi este atribuită încă nicio locație.",
  },
  siteDetailPage: {
    breadcrumbSites: "Locații",
    eyebrow: "Locație //",
    empty: "Această locație nu are încă niciun loc de muncă definit.",
  },
  workstationPage: {
    breadcrumbSites: "Locații",
    eyebrow: "Loc de muncă //",
    empty: "Pentru acest loc de muncă nu sunt încă definite sarcini.",
  },
  taskPage: {
    breadcrumbSites: "Locații",
    eyebrow: "Sarcină //",
    downloadReport: "Descarcă raportul",
    captureSample: "Pornește captura",
    assessmentSessions: "Sesiuni de evaluare",
    ongoing: "(în desfășurare)",
    manualInputsHeading: "Date introduse manual",
    manualInputsDescription:
      "Context privind greutatea, forța și uneltele, înregistrat pentru această sarcină — nelegat de o anumită captură de postură. Momentan doar pentru înregistrare; nimic de aici nu poate fi editat sau șters din această vizualizare.",
    manualInputsEmpty:
      "Pentru această sarcină nu au fost încă înregistrate date manuale.",
    postureSamplesHeading: "Capturi de postură",
    postureSamplesEmpty: "Pentru această sarcină nu există încă nicio captură.",
    cannotRecompute: (error: string) =>
      `Detalierea pe regiuni nu poate fi recalculată: ${error}`,
    recomputeError: (error: string) =>
      `Eroare la recalcularea acestei capturi: ${error}`,
    cameraAngleField: "cameraAngle:",
    tableRegion: "Regiune",
    tableStatus: "Status",
    tableDetail: "Detalii",
  },
  capturePage: {
    backToTask: "← Înapoi la sarcină",
    heading: "Captură postură",
    cameraLabel: "Cameră",
    cameraAngleLabel: "Unghi cameră",
    noPersonDetected:
      "Nicio persoană detectată în cadru. Ajustați încadrarea și încercați din nou.",
    loadingPoseModel: "Se încarcă modelul de postură…",
    detecting: "Se detectează…",
    submitting: "Se trimite…",
    captureSample: "Pornește captura",
    peopleDetected: (count: number) =>
      `${count} persoane detectate. Apăsați pe scheletul evidențiat al persoanei evaluate.`,
    selectPerson: (n: number) => `Selectează persoana ${n}`,
    cancelAndRetake: "Anulează și reia captura",
    sampleMeta: (id: string, version: string) =>
      `Captură ${id} — metodologie ${version}`,
    tableRegion: "Regiune",
    tableStatus: "Status",
    tableDetail: "Detalii",
    captureAnother: "Realizează o nouă captură",
    manualInputsHeading: "Date introduse manual",
    manualInputsDescription:
      "Greutatea sarcinii, forța de împingere/tragere sau unealta folosită pentru această sarcină — nelegate de o anumită captură de postură.",
    typeLabel: "Tip",
    toolLabel: "Unealtă",
    valueLabel: (unit: string | null) => `Valoare (${unit})`,
    notesLabel: "Note (opțional)",
    adding: "Se adaugă…",
    add: "Adaugă",
    cameraFeedNotReady:
      "Semnalul camerei nu este încă pregătit — așteptați puțin până apare previzualizarea, apoi încercați din nou.",
    canvasUnavailable: "Contextul Canvas 2D nu este disponibil",
    failedToLoadPoseModel: (message: string) =>
      `Modelul de postură nu a putut fi încărcat: ${message}`,
    cameraAccessFailed: (message: string) =>
      `Accesul la cameră a eșuat: ${message}`,
    couldNotSwitchCamera: (message: string) =>
      `Camera nu a putut fi schimbată: ${message}`,
    submitFailed: "Trimiterea a eșuat",
    detectionFailed: "Detectarea a eșuat",
    requestFailed: (status: number) => `Cererea a eșuat: ${status}`,
  },
};
