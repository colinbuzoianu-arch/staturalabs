import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { BrandMark } from "./brand-mark";
import type { WorkerBriefingData } from "./get-worker-briefing-data";
import type { ReportLang } from "./report-lang";

// Country-driven, not locale-driven (B8c, SLD_NEXT_STEPS_B8b-B8f.md §6),
// same as TaskReportDocument.tsx/RiskAssessmentReportDocument.tsx. Closes
// the "English-only for now" gap this file's own header comment used to
// flag as a known scope limit "worth revisiting given the intended
// audience."
//
// The German copy below is a DRAFT — translated by CC in the same
// register as SgdDocument.tsx's reviewed German text, but this document's
// content is compliance-sensitive in a way the other two reports aren't
// (it exists specifically to inform a works-council consultation
// process), so per SLD_NEXT_STEPS_B8b-B8f.md's own instruction it needs a
// human review pass before being treated as final — same discipline
// already applied to /at/legal's content. Every claim mirrors the
// existing, already-reviewed English text sentence-for-sentence — no new
// legal assertion was introduced in translation.
const REPORT_STRINGS: Record<
  ReportLang,
  {
    documentTitle: (siteName: string) => string;
    documentSubject: (siteName: string) => string;
    generatedPrefix: string;
    heading: string;
    whatThisIsHeading: string;
    whatThisIsBody: string;
    whatIsCapturedHeading: string;
    whatIsCapturedBody: string;
    whatIsNotStoredHeading: string;
    whatIsNotStoredBody: string;
    outputUseHeading: string;
    outputUseBody: string;
    legalPositioningHeading: string;
    legalPositioningBody: string;
    aboutDocumentHeading: string;
    aboutDocumentBody: string;
    questionsHeading: string;
    footerDisclaimer: string;
  }
> = {
  en: {
    documentTitle: (siteName) => `Worker representative briefing — ${siteName}`,
    documentSubject: (siteName) =>
      `Worker representative briefing for the Statura Labs Dynamics deployment at ${siteName}`,
    generatedPrefix: "Generated ",
    heading: "Worker representative briefing",
    whatThisIsHeading: "What this system is",
    whatThisIsBody:
      "Statura Labs Dynamics is a camera-based ergonomic assessment tool. It evaluates the physical demands of a workstation or task design — posture, repetition, and load — against published ergonomics standards (ISO 11228, EN 1005). It does not evaluate, monitor, or score the performance or behaviour of any individual worker.",
    whatIsCapturedHeading: "What is captured",
    whatIsCapturedBody:
      "When an operator explicitly starts a capture, a camera briefly views the workstation while the task is performed. Body-joint positions are estimated from that view using pose-estimation software running on-device. This deployment captures data only when an operator manually triggers it — never continuously and never without a deliberate action.",
    whatIsNotStoredHeading: "What is not stored",
    whatIsNotStoredBody:
      "Video frames are never saved to disk or transmitted anywhere, even temporarily. Only anonymous joint-angle coordinates are used, for the moments it takes to compute a score. The system does not perform facial recognition, does not identify individuals, and does not track the same person across separate capture sessions. Every stored record is tied to the workstation and task being assessed — never to a named worker.",
    outputUseHeading: "What the output is used for",
    outputUseBody:
      "Each capture produces a set of joint-angle risk scores for a workstation, based on versioned, published scoring thresholds. These scores are always reviewed by a qualified person (an EHS manager or ergonomist) before any action is taken — the system never triggers an automated consequence on its own.",
    legalPositioningHeading: "Legal positioning",
    legalPositioningBody:
      "Statura Labs Dynamics was designed from the development phase to meet the relevant requirements of the EU AI Act and the GDPR. Final regulatory classification will be confirmed by a formal legal opinion before commercial launch. Full technical documentation is available on request.",
    aboutDocumentHeading: "About this document",
    aboutDocumentBody:
      "This briefing supports your employer's information and consultation obligations toward worker representatives ahead of deploying this system — it is a starting point for that conversation, not a substitute for it. Depending on your country, deploying this system may still require formal consultation with, or agreement from, a works council or equivalent body (for example a Betriebsrat in Germany or Austria, an Ondernemingsraad in the Netherlands, or a CSE in France), independent of what data the system stores or doesn't store. This document does not constitute legal advice.",
    questionsHeading: "Questions about this deployment",
    footerDisclaimer:
      "This document describes the Statura Labs Dynamics product in general terms; specific deployment configuration may vary by site. Not a substitute for a formal legal opinion or the worker-representative consultation procedure required in your jurisdiction.",
  },
  // DRAFT — pending human review, see file-level comment above.
  de: {
    documentTitle: (siteName) =>
      `Briefing für die Arbeitnehmervertretung — ${siteName}`,
    documentSubject: (siteName) =>
      `Briefing für die Arbeitnehmervertretung zur Statura-Labs-Dynamics-Installation am Standort ${siteName}`,
    generatedPrefix: "Erstellt am ",
    heading: "Briefing für die Arbeitnehmervertretung",
    whatThisIsHeading: "Was dieses System ist",
    whatThisIsBody:
      "Statura Labs Dynamics ist ein kamerabasiertes Werkzeug zur ergonomischen Bewertung. Es bewertet die körperliche Belastung durch die Gestaltung eines Arbeitsplatzes oder einer Aufgabe — Haltung, Wiederholung und Last — anhand veröffentlichter ergonomischer Normen (ISO 11228, EN 1005). Es bewertet, überwacht oder benotet nicht die Leistung oder das Verhalten einzelner Beschäftigter.",
    whatIsCapturedHeading: "Was erfasst wird",
    whatIsCapturedBody:
      "Wenn eine Bedienperson eine Aufnahme ausdrücklich startet, erfasst eine Kamera kurz den Arbeitsplatz, während die Tätigkeit ausgeführt wird. Die Positionen der Körpergelenke werden aus dieser Aufnahme mittels Pose-Estimation-Software geschätzt, die auf dem Gerät selbst läuft. Diese Installation erfasst Daten ausschließlich, wenn eine Bedienperson dies manuell auslöst — niemals fortlaufend und niemals ohne bewusste Handlung.",
    whatIsNotStoredHeading: "Was nicht gespeichert wird",
    whatIsNotStoredBody:
      "Videobilder werden zu keinem Zeitpunkt auf einem Datenträger gespeichert oder übertragen, auch nicht vorübergehend. Verwendet werden ausschließlich anonyme Gelenkwinkel-Koordinaten, nur für die Dauer der Berechnung eines Bewertungsergebnisses. Das System führt keine Gesichtserkennung durch, identifiziert keine Einzelpersonen und verfolgt dieselbe Person nicht über mehrere Aufnahmesitzungen hinweg. Jeder gespeicherte Datensatz ist dem bewerteten Arbeitsplatz und der bewerteten Aufgabe zugeordnet — niemals einer namentlich genannten Person.",
    outputUseHeading: "Wofür die Ergebnisse verwendet werden",
    outputUseBody:
      "Jede Aufnahme erzeugt einen Satz von Gelenkwinkel-Risikobewertungen für einen Arbeitsplatz, basierend auf versionierten, veröffentlichten Bewertungsschwellen. Diese Ergebnisse werden stets von einer fachkundigen Person (einer Fachkraft für Arbeitssicherheit oder Ergonomie) überprüft, bevor Maßnahmen ergriffen werden — das System löst niemals von sich aus eine automatisierte Folgemaßnahme aus.",
    legalPositioningHeading: "Rechtliche Einordnung",
    legalPositioningBody:
      "Statura Labs Dynamics wurde von Beginn der Entwicklung an darauf ausgelegt, die einschlägigen Anforderungen des EU-KI-Gesetzes (AI Act) und der DSGVO zu erfüllen. Die endgültige regulatorische Einstufung wird vor der kommerziellen Markteinführung durch ein förmliches Rechtsgutachten bestätigt. Vollständige technische Dokumentation ist auf Anfrage erhältlich.",
    aboutDocumentHeading: "Über dieses Dokument",
    aboutDocumentBody:
      "Dieses Briefing unterstützt die Informations- und Konsultationspflichten Ihres Arbeitgebers gegenüber der Arbeitnehmervertretung vor der Einführung dieses Systems — es ist ein Ausgangspunkt für dieses Gespräch, kein Ersatz dafür. Je nach Land kann die Einführung dieses Systems weiterhin eine förmliche Konsultation mit oder Zustimmung durch einen Betriebsrat oder ein vergleichbares Gremium erfordern (zum Beispiel einen Betriebsrat in Deutschland oder Österreich, einen Ondernemingsraad in den Niederlanden oder ein CSE in Frankreich), unabhängig davon, welche Daten das System speichert oder nicht speichert. Dieses Dokument stellt keine Rechtsberatung dar.",
    questionsHeading: "Fragen zu dieser Installation",
    footerDisclaimer:
      "Dieses Dokument beschreibt das Produkt Statura Labs Dynamics in allgemeiner Form; die konkrete Konfiguration einer Installation kann je nach Standort abweichen. Kein Ersatz für ein förmliches Rechtsgutachten oder das in Ihrer Rechtsordnung erforderliche Konsultationsverfahren mit der Arbeitnehmervertretung.",
  },
};

// Same palette/type conventions as the other two report documents — one
// visual system across every printable artifact this app produces.
const COLOR = {
  teal: "#0E3733",
  ivory: "#F2ECE1",
  coral: "#E35C3A",
  sageDark: "#568076",
  sageLight: "#96A5A0",
  white: "#FFFFFF",
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: COLOR.ivory,
    padding: 36,
    paddingBottom: 64,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: COLOR.teal,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandWordmark: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    letterSpacing: 1,
  },
  metaText: { fontFamily: "Courier", fontSize: 8, color: COLOR.sageDark },
  divider: {
    borderBottomWidth: 1.5,
    borderBottomColor: COLOR.coral,
    marginVertical: 12,
  },
  title: { fontFamily: "Helvetica-Bold", fontSize: 18, marginBottom: 2 },
  subtitle: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: COLOR.sageDark,
    marginBottom: 2,
  },
  section: {
    backgroundColor: COLOR.white,
    borderRadius: 3,
    padding: 12,
    marginTop: 12,
  },
  sectionTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
    marginBottom: 6,
    color: COLOR.teal,
  },
  sectionText: {
    fontFamily: "Helvetica",
    fontSize: 10,
    lineHeight: 1.5,
    color: COLOR.teal,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    borderTopWidth: 0.5,
    borderTopColor: COLOR.sageLight,
    paddingTop: 6,
  },
  footerCopyright: {
    fontFamily: "Helvetica",
    fontSize: 7,
    color: COLOR.sageDark,
  },
  footerDisclaimer: {
    fontFamily: "Helvetica",
    fontSize: 7,
    color: COLOR.sageDark,
    marginTop: 2,
  },
  pageNumber: {
    position: "absolute",
    bottom: 24,
    right: 36,
    fontFamily: "Courier",
    fontSize: 7,
    color: COLOR.sageDark,
  },
});

function formatDate(date: Date): string {
  return `${date.toISOString().replace("T", " ").slice(0, 19)} UTC`;
}

// Content is deliberately conservative — every claim here is a direct
// restatement of something already reviewed in
// ERGO_COMPLIANCE_BY_DESIGN.md (§1, §2.1-§2.3, §3.1-§3.4, the counsel-
// approved positioning language in §2.1) or already-published on the
// public /legal page, never a new legal assertion invented for this
// document. In particular: never claims exemption from the AI Act (§4
// never-build), and explicitly does NOT claim this document replaces
// formal worker-representative consultation — ERGO_COMPLIANCE_BY_DESIGN
// .md is explicit that removing personal data doesn't remove the
// co-determination trigger under German/Austrian/Dutch/Italian/French
// law, so this briefing supports that process, it doesn't substitute for
// it. Country-driven German output as of B8c (SLD_NEXT_STEPS_B8b-
// B8f.md §6) — see REPORT_STRINGS.de's own "DRAFT, pending human review"
// note above.
export function WorkerBriefingDocument({
  data,
  lang,
}: {
  data: WorkerBriefingData;
  lang: ReportLang;
}) {
  const { site, generatedAt } = data;
  const company = site.company;
  const year = generatedAt.getUTCFullYear();
  const s = REPORT_STRINGS[lang];

  return (
    <Document
      title={s.documentTitle(site.name)}
      author="Statura Labs Dynamics"
      subject={s.documentSubject(site.name)}
    >
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.headerRow}>
          <View style={styles.brandRow}>
            <BrandMark size={28} />
            <Text style={styles.brandWordmark}>STATURA LABS DYNAMICS</Text>
          </View>
          <Text style={styles.metaText}>
            {s.generatedPrefix}
            {formatDate(generatedAt)}
          </Text>
        </View>

        <View style={styles.divider} />

        <Text style={styles.title}>{s.heading}</Text>
        <Text style={styles.subtitle}>
          {site.name} · {company.name}
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{s.whatThisIsHeading}</Text>
          <Text style={styles.sectionText}>{s.whatThisIsBody}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{s.whatIsCapturedHeading}</Text>
          <Text style={styles.sectionText}>{s.whatIsCapturedBody}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{s.whatIsNotStoredHeading}</Text>
          <Text style={styles.sectionText}>{s.whatIsNotStoredBody}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{s.outputUseHeading}</Text>
          <Text style={styles.sectionText}>{s.outputUseBody}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{s.legalPositioningHeading}</Text>
          <Text style={styles.sectionText}>{s.legalPositioningBody}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{s.aboutDocumentHeading}</Text>
          <Text style={styles.sectionText}>{s.aboutDocumentBody}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{s.questionsHeading}</Text>
          <Text style={styles.sectionText}>contact@verumsell.com</Text>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerCopyright}>© {year} Verumsell SRL</Text>
          <Text style={styles.footerDisclaimer}>{s.footerDisclaimer}</Text>
        </View>
        <Text
          style={styles.pageNumber}
          fixed
          render={({ pageNumber, totalPages }) =>
            `${pageNumber} / ${totalPages}`
          }
        />
      </Page>
    </Document>
  );
}
