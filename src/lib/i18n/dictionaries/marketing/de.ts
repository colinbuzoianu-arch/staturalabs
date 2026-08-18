import type { en } from "./en";

// Meaning-based translation, not word-for-word — see CLAUDE.md i18n notes.
export const de: typeof en = {
  header: {
    requestPilot: "Pilotprojekt anfragen",
    signIn: "Anmelden",
  },
  countryChooser: {
    metaTitle: "Markt wählen",
    eyebrow: "Markt wählen",
    h1: "Statura Labs Dynamics, nach Markt.",
    lede: "Rechtliche Grenzwerte, Fachbegriffe und das erzeugte Dokument richten sich nach dem Land, in dem sich der Arbeitsplatz tatsächlich befindet — nicht umgekehrt. Wählen Sie Ihren Markt.",
    countryLabels: { at: "Österreich", de: "Deutschland", ch: "Schweiz" },
    statusAvailable: "Verfügbar",
    statusInPreparation: "In Vorbereitung",
  },
  hero: {
    eyebrow: "Gemessene Bewegung // Ergonomie am Arbeitsplatz",
    h1: "Ergonomisches Risiko, abgelesen wie von einem Messgerät.",
    lede: "Statura Labs Dynamics macht aus einer gewöhnlichen Kamera ein präzises Werkzeug zur Ergonomie-Bewertung. Rumpf-, Nacken-, Schulter-, Ellbogen- und Kniewinkel werden nach ISO 11228 und EN 1005 bewertet — unter realen Arbeitsbedingungen, nicht im Labor.",
    ctaPrimary: "Pilotprojekt anfragen",
    ctaSecondary: "So funktioniert es",
  },
  pipeline: {
    eyebrow: "Der Ablauf",
    heading: "Von einer einzigen Kamera zum dokumentierten Ergebnis.",
    steps: [
      {
        step: "01 / CAPTURE",
        heading: "Kamera auf den Arbeitsplatz richten",
        description:
          "Keine Wearables, keine zu installierenden Sensoren. Jede Laptop- oder USB-Kamera funktioniert.",
      },
      {
        step: "02 / ANALYZE",
        heading: "Haltung wird direkt auf dem Gerät erkannt",
        description:
          "Die Haltungserkennung läuft im Browser. Video wird nie gespeichert oder übertragen.",
      },
      {
        step: "03 / SCORE",
        heading: "Winkel werden Region für Region geprüft",
        description:
          "Rumpf, Nacken, Schulter, Ellbogen, Knie — jeweils bewertet nach ISO 11228 / EN 1005.",
      },
      {
        step: "04 / REPORT",
        heading: "Ein Nachweis für Ihre EHS-Akte",
        description:
          "Ein dokumentierter Bericht, nicht nur ein Dashboard — bereit zur Weitergabe.",
      },
    ],
  },
  privacy: {
    eyebrow: "Datenschutz von Grund auf, nicht nachträglich",
    heading: "Die Kamera sieht eine Haltung. Nie einen Menschen.",
    items: [
      {
        heading: "Es wird niemals Video gespeichert",
        description:
          "Einzelbilder werden direkt im Browser verarbeitet und verworfen. Nichts wird gespeichert, nichts verlässt das Gerät als Video.",
      },
      {
        heading: "Keine Identitätsdaten, nirgendwo",
        description:
          "Jede Messung ist einem Arbeitsplatz zugeordnet — nie einem Namen, einem Gesicht oder einer Personalakte.",
      },
      {
        heading: "Von Anfang an EU-orientiert",
        description:
          "Die Architektur folgt von Beginn an der DSGVO-Datenminimierung und den aktuellen Vorgaben des AI Act — nicht nachträglich angepasst.",
      },
    ],
  },
  standards: {
    eyebrow: "Fundiert, nicht geraten",
    heading: "Bewertet nach echten technischen Normen.",
    paragraph:
      "Jeder Schwellenwert in der Bewertungslogik von Statura basiert auf etablierten Normen der Arbeitsergonomie — keine proprietäre Blackbox und keine geliehene Methodik aus einem System, das uns nicht gehört.",
    cards: [
      {
        tag: "ISO 11228",
        label: "Manuelle Handhabung & statische Körperhaltung",
      },
      {
        tag: "EN 1005",
        label: "Menschliche physische Leistungsfähigkeit an Maschinen",
      },
    ],
  },
  fieldNotes: {
    eyebrow: "Notizen aus der Praxis",
    heading: "Ergonomie ist mehr als ein Kamerawinkel.",
    notes: [
      {
        kicker: "Warum das wichtig ist",
        heading: "Was Arbeitsplatz-Ergonomie tatsächlich misst",
        paragraphs: [
          "Muskel-Skelett-Erkrankungen — Belastungen von Rücken, Schulter und Knie durch wiederholte oder anhaltende Zwangshaltungen — zählen weiterhin zu den größten Kategorien von Berufserkrankungen und sind zugleich am schwersten frühzeitig zu erkennen, weil der Schaden sich aus gewöhnlichen, tausendfach wiederholten Bewegungen aufbaut, nicht aus einem einzelnen Unfall.",
          "Eine seriöse Bewertung betrachtet nicht nur einen Moment — sie betrachtet Haltung, Wiederholung, Kraft und Dauer gemeinsam, Region für Region: Rumpf, Nacken, Schultern, Ellbogen, Handgelenke, Knie. Die Bewertungslogik von Statura folgt derselben Logik, aufgebaut auf ISO 11228 und EN 1005, statt auf einen einzelnen vereinfachten „Risikowert“.",
        ],
        roadmapNote: null as string | null,
      },
      {
        kicker: "Flexible Aufnahme",
        heading: "Fest montiert, mobil, und was als Nächstes kommt",
        paragraphs: [
          "Statura funktioniert heute mit jeder Kamera, auf die ein Browser zugreifen kann — einer Laptop- oder USB-Kamera, die dauerhaft an einem Arbeitsplatz montiert für wiederkehrende Prüfungen genutzt wird, oder einem Smartphone, das eine prüfende Person von Station zu Station durch die Anlage trägt. Keine proprietäre Hardware, keine Wearables.",
        ],
        roadmapNote:
          "In Entwicklung: kamerabasierte Nahbereichserkennung für Handgelenk und Hand, die eine Ganzkörperaufnahme nicht zuverlässig erfassen kann. Das Handgelenk selbst wird bereits heute bewertet — manuell erfasst; diese Lücke betrifft speziell die Erweiterung der Kameraaufnahme auf diesen Bereich.",
      },
      {
        kicker: "Mehr als Haltung",
        heading: "Last, Kraft und Werkzeuge mit ins Bild",
        paragraphs: [
          "Haltung allein erzählt nicht die ganze Geschichte — eine mäßige Vorbeuge ohne Last ist ein anderes Risiko als dieselbe Vorbeuge mit 20 kg. Zu jeder Haltungsaufnahme erfasst Statura zusätzlich den manuellen Kontext, der das tatsächliche Risiko bestimmt: Objektgewicht, Schub-/Zugkraft und das verwendete Werkzeug — eingegeben von der Person, die die Bewertung durchführt.",
          "Das sind keine Vermutungen, die über einen Wert gelegt werden — es sind strukturierte Datenpunkte, die derselben Aufgabe und demselben Arbeitsplatz zugeordnet sind und gemeinsam in jedem Bericht sichtbar werden.",
        ],
        roadmapNote: null as string | null,
      },
      {
        kicker: "Auf der Roadmap",
        heading: "Gemeinsame Arbeitsbereiche von Mensch und Roboter",
        paragraphs: [
          "Dieselbe geräteseitige Haltungserkennung, die menschliche Körperhaltung liest, ist ein naheliegender Ausgangspunkt für eine verwandte, aber eigenständige Frage: wie Menschen und Roboter sich denselben Raum in der Fertigung sicher teilen.",
        ],
        roadmapNote:
          "Das ist eine Richtung, die wir untersuchen, kein ausgeliefertes Feature. Sicherheitsüberwachung in gemeinsamen Mensch-Roboter-Umgebungen unterliegt einem anderen regulatorischen Rahmen als die Ergonomie-Bewertung (funktionale Sicherheitsnormen, nicht nur Datenschutz), und jede Fähigkeit in diesem Bereich durchläuft vor der Veröffentlichung eine eigene, dedizierte Compliance-Prüfung — nicht übernommen vom umgebenden Ergonomie-Produkt.",
      },
    ],
  },
  finalCta: {
    statusLine:
      "Derzeit im technischen Pilotbetrieb mit Partnern aus der Industrieproduktion.",
    heading: "Erleben Sie es live in Ihrer eigenen Fertigung.",
    cta: "Pilotprojekt anfragen",
  },
  countryContext: {
    eyebrow: "Für diesen Markt aufgebaut",
    verifiedHeading: "In der Sprache Ihrer Behörde.",
    unverifiedHeading:
      "Die rechtliche Einordnung für diesen Markt ist noch in Vorbereitung.",
    unverifiedNote:
      "Wir haben die rechtlichen Bezüge und Fachbegriffe für diesen Markt noch nicht anhand einer Primärquelle geprüft. Statt zu raten, bleibt diese Seite bis zum Abschluss dieser Prüfung reine Positionierung.",
  },
  footer: {
    about: "Über uns",
    legal: "Rechtliches",
    copyright: (year: number) =>
      `© ${year} Verumsell SRL · Statura Labs Dynamics ist ein Produkt von Verumsell SRL`,
  },
  about: {
    metaTitle: "Über uns",
    eyebrow: "Über uns",
    h1: "Entwickelt, um zu messen, was früher geschätzt wurde.",
    paragraphs: [
      "Statura Labs Dynamics entstand aus einer einfachen Frustration: Ergonomisches Risiko in industriellen Arbeitsumgebungen wird meist nach Augenmaß beurteilt, auf einem Klemmbrett, wenn überhaupt einmal im Jahr — nicht, weil es niemanden kümmert, sondern weil eine echte instrumentierte Bewertung bisher immer Wearables, spezielle Sensorik oder die Zeit eines externen Beraters bedeutete. Wir wollten etwas bauen, das mit einer Kamera funktioniert, die Sie wahrscheinlich bereits besitzen.",
      "Statura wird von einem Ingenieur mit Hintergrund in industriellen Arbeitsschutzsystemen entwickelt, unter dem Dach von Verumsell SRL, einem Software-Studio mit Sitz in Rumänien. Das Produkt befindet sich im aktiven technischen Pilotbetrieb mit Partnern aus der Industrieproduktion. Wir entwickeln es bewusst und offen — mit klarer Unterscheidung zwischen dem, was bereits belegt ist, und dem, was noch in Entwicklung ist, statt einer polierten Behauptung vorzugreifen, bevor die Belege dafür vorliegen.",
    ],
    grounded: {
      eyebrow: "Fundiert, nicht geraten",
      paragraph:
        "Jeder Schwellenwert in der Bewertungslogik von Statura basiert auf etablierten Normen der Arbeitsergonomie — ISO 11228 und EN 1005 — keine proprietäre Blackbox. Die Architektur folgt von der ersten Codezeile an dem Prinzip der Datenminimierung und den aktuellen Vorgaben des AI Act, nicht nachträglich angepasst.",
    },
    whereWeAreNow: {
      eyebrow: "Wo wir gerade stehen",
      paragraph:
        "Statura Labs Dynamics befindet sich derzeit im technischen Pilotbetrieb mit Partnern aus der Industrieproduktion und ist noch kein kommerzielles Produkt. Wenn Sie erleben möchten, wie es einen echten Arbeitsplatz misst, freuen wir uns, von Ihnen zu hören.",
    },
    cta: "Pilotprojekt anfragen",
  },
  legal: {
    metaTitle: "Rechtliches",
    h1: "Rechtliches",
    thisWebsite: {
      heading: "Diese Website",
      paragraph:
        "Diese Website wird von Verumsell SRL betrieben. Sie verwendet derzeit keine Tracking-Cookies oder Analysetools und erhebt keine personenbezogenen Daten über Formulare — das einzige interaktive Element ist ein mailto-Link zu contact@verumsell.com. Sollte sich das ändern, wird diese Seite entsprechend aktualisiert.",
    },
    dataHandling: {
      heading: "Wie das Produkt Statura Labs Dynamics mit Daten umgeht",
      paragraph:
        "Das Produkt Statura Labs Dynamics — im Rahmen eines Pilotprojekts oder einer Implementierung, getrennt von dieser Website — verarbeitet Kameravideo vollständig auf dem Gerät. Videobilder werden niemals gespeichert oder übertragen; verwendet werden ausschließlich anonyme Körpergelenk-Koordinaten, die einem Arbeitsplatz zugeordnet sind, niemals einer namentlich bekannten Person. Statura Labs Dynamics ist darauf ausgelegt, die relevanten Anforderungen des EU AI Act und der DSGVO bereits ab der Entwicklungsphase zu erfüllen. Die endgültige regulatorische Einstufung wird vor der kommerziellen Markteinführung durch ein förmliches Rechtsgutachten bestätigt. Vollständige technische Dokumentation ist für potenzielle Pilotpartner auf Anfrage erhältlich.",
    },
    terms: {
      heading: "Nutzungsbedingungen",
      paragraph:
        "Die Inhalte dieser Website dienen der allgemeinen Information über Statura Labs Dynamics und stellen kein verbindliches Angebot dar. Alle Inhalte, der Name Statura Labs Dynamics sowie die zugehörigen Kennzeichen sind Eigentum von Verumsell SRL. Nichts auf dieser Website stellt eine fachliche, medizinische oder rechtliche Beratung dar.",
    },
    company: {
      heading: "Unternehmensangaben",
      paragraph: "Verumsell SRL · CUI 51132090 · J2025002367001",
    },
    contact: {
      heading: "Kontakt",
      prefix: "Fragen zum Datenschutz oder zu dieser Website:",
    },
    jurisdictionNotice: {
      heading: "Länderspezifischer Hinweis",
      paragraph:
        "Eine länderspezifische Fassung dieser Seite für diesen Markt (z. B. eine österreichische Offenlegung nach § 5 ECG, ein deutsches Impressum nach dem DDG oder eine Schweizer Fassung nach revDSG) wird vorbereitet und ist noch nicht rechtlich geprüft. Die obigen Inhalte gelten EU-weit und bleiben bis dahin gültig.",
    },
  },
};
