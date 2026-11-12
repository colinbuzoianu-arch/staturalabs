import type { en } from "./en";

// German is the primary market language (DACH) and is written for German
// search terms (Arbeitssicherheit, Gefährdungsbeurteilung/Evaluierung,
// Arbeitsschutz-Software, Gefahrstoffe, Unterweisungen, Umweltmanagement,
// Rechtskataster …). Typed against `typeof en` so a missing key is a compile
// error.
export const de: typeof en = {
  meta: {
    title:
      "Arbeitssicherheit- & Umweltschutz-Software für DACH | Statura Labs Dynamics",
    description:
      "Statura Labs Dynamics ist die integrierte Plattform für Arbeitssicherheit, Gefährdungsbeurteilung und Umweltschutz in Österreich, Deutschland und der Schweiz. Rechtssichere Dokumente, Gefahrstoffe, Unterweisungen, Begehungen, Maßnahmen und Rechtskataster – DSGVO-konform.",
  },
  header: {
    requestPilot: "Pilot anfragen",
    signIn: "Anmelden",
  },
  hero: {
    eyebrow: "Arbeitssicherheit · Gesundheitsschutz · Umweltschutz",
    h1: "Arbeitssicherheit und Umweltschutz – eine Plattform für den gesamten DACH-Raum.",
    lede: "Statura Labs Dynamics bündelt Gefährdungsbeurteilung, Gefahrstoffe, Unterweisungen, Begehungen, Ereignisse, Maßnahmen, Rechtskataster und Umweltmanagement in einer rechtssicheren Software für Österreich, Deutschland und die Schweiz. Erstellen Sie die gesetzlich geforderten Dokumente, verwalten Sie Maßnahmen und weisen Sie deren Wirksamkeit nach – vollständig DSGVO-konform.",
    ctaPrimary: "Pilot anfragen",
    ctaSecondary: "Plattform entdecken",
  },
  platform: {
    eyebrow: "Die Plattform",
    heading:
      "Eine durchgängige Lösung für Arbeitnehmerschutz und betrieblichen Umweltschutz.",
    paragraphs: [
      "Arbeitssicherheit, Gesundheitsschutz und Umweltschutz werden oft in getrennten Listen, Ordnern und Tabellen verwaltet. Statura Labs Dynamics führt sie in einer einzigen, länderspezifischen Plattform zusammen – vom Arbeitsplatz über die Gefährdungsbeurteilung bis zum fertigen, rechtssicheren Dokument.",
      "Jede Beurteilung, jede Maßnahme und jeder Nachweis ist versioniert, nachvollziehbar und einem Standort samt geltender Rechtslage zugeordnet. Sicherheitsfachkräfte, Umweltbeauftragte und die Geschäftsführung behalten jederzeit den Überblick – und sind auf eine Behördenprüfung oder ein Audit vorbereitet.",
    ],
  },
  modules: {
    eyebrow: "Module",
    heading: "Alles, was der betriebliche Arbeits- und Umweltschutz braucht.",
    lede: "Aktivieren Sie die Module, die Sie benötigen – vom ersten Arbeitsplatz bis zum vollständigen Managementsystem.",
    items: [
      {
        title: "Gefährdungsbeurteilung / Evaluierung",
        description:
          "Strukturierte Gefährdungsbeurteilung über alle Gefährdungskategorien, mit Maßnahmen und Wirksamkeitskontrolle – in Österreich als Evaluierung nach ASchG.",
      },
      {
        title: "Gefahrstoffe",
        description:
          "Gefahrstoffverzeichnis, Sicherheitsdatenblätter und automatisch erzeugte Betriebsanweisungen nach GefStoffV bzw. ASchG.",
      },
      {
        title: "Unterweisungen",
        description:
          "Unterweisungspflichten ableiten, planen und nachweisen – inklusive Nachweisverwaltung und Fristenüberwachung.",
      },
      {
        title: "Begehungen & Audits",
        description:
          "Sicherheitsbegehungen und Audits mit Vorlagen, Checklisten und direkter Ableitung von Maßnahmen.",
      },
      {
        title: "Ereignisse",
        description:
          "Unfälle, Beinaheunfälle und Vorkommnisse erfassen, untersuchen und – wo erforderlich – den Behörden melden; inkl. Verbandbuch.",
      },
      {
        title: "Umwelt",
        description:
          "Umweltaspekte bewerten, Mengen und Abfälle erfassen und das Abfallwirtschaftskonzept nach AWG erstellen.",
      },
      {
        title: "Maßnahmen",
        description:
          "Zentrales Maßnahmenregister mit Verantwortlichkeiten, Fristen und dokumentierter Wirksamkeitsprüfung.",
      },
      {
        title: "Rechtskataster",
        description:
          "Rechtsvorschriften je Standort führen, Anwendbarkeit prüfen und die Rechtskonformität bewerten.",
      },
      {
        title: "Dokumente",
        description:
          "Alle rechtssicheren Dokumente an einem Ort – inklusive revisionssicherem Archiv der erzeugten Nachweise.",
      },
      {
        title: "Auswertungen",
        description:
          "Kennzahlen und Auswertungen zu Sicherheit, Maßnahmen und Umwelt – ohne personenbezogene Bewertung Einzelner.",
      },
    ],
  },
  documents: {
    eyebrow: "Rechtssichere Dokumente",
    heading: "Die geforderten Nachweise – auf Knopfdruck, nicht in Handarbeit.",
    paragraph:
      "Statura Labs Dynamics erzeugt die gesetzlich geforderten Dokumente direkt aus Ihren Daten – länderspezifisch und immer auf der passenden Rechtsgrundlage. Kein Kopieren zwischen Vorlagen, keine veralteten Fassungen.",
    items: [
      {
        title: "Sicherheits- und Gesundheitsschutzdokument (SGD)",
        description: "Für Österreich nach §5 ASchG und DOK-VO.",
      },
      {
        title: "Betriebsanweisungen",
        description:
          "Gefahrstoff-Betriebsanweisungen nach GefStoffV bzw. ASchG.",
      },
      {
        title: "Abfallwirtschaftskonzept (AWK)",
        description: "Nach §10 AWG 2002 für österreichische Standorte.",
      },
      {
        title: "Nachweise & Berichte",
        description:
          "Von der Beurteilung bis zur Behördenmeldung – revisionssicher archiviert.",
      },
    ],
  },
  dach: {
    eyebrow: "Für den DACH-Raum gebaut",
    heading: "Recht, Begriffe und Dokumente folgen dem Standort.",
    paragraph:
      "Ein Unternehmen kann Standorte in mehreren Ländern haben. Deshalb entscheidet bei Statura der tatsächliche Standort über die geltenden Grenzwerte, die verwendete Terminologie und das erzeugte Dokument – nicht umgekehrt.",
    points: [
      "Österreich: Evaluierung, SGD, AUVA- und Arbeitsinspektions-Logik.",
      "Deutschland: Gefährdungsbeurteilung nach ArbSchG, GefStoffV und DGUV.",
      "Schweiz: in Vorbereitung.",
    ],
  },
  trust: {
    eyebrow: "Datenschutz von Anfang an",
    heading: "Sicherheit bewerten, ohne Menschen zu überwachen.",
    items: [
      {
        title: "Keine Kamera, keine Videodaten",
        description:
          "Die Plattform nutzt keine Kamera und speichert keine Bild- oder Videodaten. Eine Beurteilung ist eine strukturierte Dokumentation, kein Filmmaterial.",
      },
      {
        title: "Trennung von Beurteilung und Person",
        description:
          "Die Beurteilungskette ist personenfrei: Beurteilungen beziehen sich auf Arbeitsplätze, nicht auf Namen. Personenbezogene Pflichtdaten liegen streng getrennt in einem eigenen Bereich.",
      },
      {
        title: "DSGVO-konform konzipiert",
        description:
          "Datensparsamkeit und Datenschutz sind von der ersten Zeile an eingebaut, nicht nachträglich ergänzt.",
      },
    ],
  },
  finalCta: {
    eyebrow: "Loslegen",
    heading: "Sehen Sie, wie Statura Ihren Betrieb absichert.",
    paragraph:
      "Vereinbaren Sie einen Piloten und erleben Sie die Plattform an einem echten Standort.",
    cta: "Pilot anfragen",
  },
  footer: {
    about: "Über uns",
    legal: "Rechtliches",
    copyright: (year: number) =>
      `© ${year} Verumsell SRL · Statura Labs Dynamics ist ein Produkt der Verumsell SRL`,
  },
  about: {
    metaTitle: "Über uns",
    eyebrow: "Über uns",
    h1: "Arbeits- und Umweltschutz, zusammengeführt in einer Plattform.",
    paragraphs: [
      "Statura Labs Dynamics entstand aus einer einfachen Beobachtung: In vielen Betrieben werden Arbeitssicherheit, Gesundheitsschutz und Umweltschutz in getrennten Dokumenten, Tabellen und Köpfen verwaltet – und bei einer Prüfung mühsam wieder zusammengesucht. Wir bauen eine Plattform, die diese Pflichten zusammenführt und die geforderten Nachweise automatisch erzeugt.",
      "Entwickelt wird Statura Labs Dynamics unter der Verumsell SRL. Die Plattform ist auf den DACH-Raum ausgerichtet und richtet sich an Industrie- und Gewerbebetriebe, die ihren Arbeits- und Umweltschutz rechtssicher und nachvollziehbar organisieren wollen.",
    ],
    whereWeAreNow: {
      eyebrow: "Wo wir stehen",
      paragraph:
        "Statura Labs Dynamics befindet sich in aktiver Weiterentwicklung mit Pilotpartnern. Wenn Sie die Plattform an einem echten Standort sehen möchten, freuen wir uns über Ihre Nachricht.",
    },
    cta: "Pilot anfragen",
  },
  legal: {
    metaTitle: "Rechtliches",
    h1: "Rechtliches",
    thisWebsite: {
      heading: "Diese Website",
      paragraph:
        "Diese Website wird von der Verumsell SRL betrieben. Sie verwendet derzeit keine Tracking-Cookies oder Analysetools und erhebt über Formulare keine personenbezogenen Daten – das einzige interaktive Element ist ein mailto:-Link an contact@verumsell.com. Sollte sich das ändern, wird diese Seite entsprechend aktualisiert.",
    },
    // REVIEW REQUIRED: rechtlich sensibler Text – vor dem kommerziellen Start
    // juristisch prüfen lassen.
    dataHandling: {
      heading: "Wie das Produkt Statura Labs Dynamics mit Daten umgeht",
      paragraph:
        "Das Produkt Statura Labs Dynamics – wie es in einem Piloten oder im Einsatz verwendet wird, getrennt von dieser Website – nutzt keine Kamera und erfasst, speichert oder übermittelt keine Video- oder Bilddaten. Die Beurteilungskette ist personenfrei: Beurteilungen und Messwerte sind einem Arbeitsplatz oder Standort zugeordnet, niemals einer namentlich genannten Person. Gesetzlich erforderliche personenbezogene Daten (etwa Unterweisungsnachweise oder Ereignisaufzeichnungen) werden streng getrennt und ausschließlich für eine konkrete gesetzliche Pflicht geführt; Gesundheitsdaten werden zusätzlich verschlüsselt und jeder Zugriff protokolliert. Statura Labs Dynamics ist darauf ausgelegt, die einschlägigen Anforderungen der EU-DSGVO von der Entwicklungsphase an zu erfüllen. Eine vollständige technische Dokumentation ist für interessierte Pilotpartner auf Anfrage verfügbar.",
    },
    terms: {
      heading: "Nutzungsbedingungen",
      paragraph:
        "Die Inhalte dieser Website dienen der allgemeinen Information über Statura Labs Dynamics und stellen kein verbindliches Angebot dar. Alle Inhalte, der Name Statura Labs Dynamics und zugehörige Kennzeichen sind Eigentum der Verumsell SRL. Nichts auf dieser Website stellt eine fachliche, medizinische oder rechtliche Beratung dar.",
    },
    company: {
      heading: "Unternehmensangaben",
      paragraph: "Verumsell SRL · CUI 51132090 · J2025002367001",
    },
    contact: {
      heading: "Kontakt",
      prefix: "Fragen zum Datenschutz oder zu dieser Website:",
    },
  },
};
