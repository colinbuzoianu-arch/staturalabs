import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { BrandMark } from "./brand-mark";
import type { AwkReportData } from "./get-awk-report-data";

// Austrian Abfallwirtschaftskonzept (AWK), §10 AWG 2002 (E4,
// SLD_IMPLEMENTATION_PLAN_hazards-and-environment.md §6). The environmental
// counterpart of SgdDocument — same palette/type system, same German-only
// (never locale-driven), same zero-person discipline (assessor/approver/
// responsible are PlatformUser accounts or role labels, waste collectors are
// companies — §3.17). Country-gated to AT by the route (resolveAwkCountryPack)
// before this ever renders. Every legal fact below (the >20-employee duty,
// the 12-month deadline, the 7-year cycle, the §37 GewO/MinroG case, the EMAS
// equivalence) is from the RIS §10 text (Fassung 16.02.2011, BGBl. I Nr.
// 9/2011), confirmed by the founder — no number appears that RIS didn't have.
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
    fontSize: 9,
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
  metaBlock: { alignItems: "flex-end" },
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
  legalIntro: {
    fontFamily: "Helvetica",
    fontSize: 8.5,
    color: COLOR.sageDark,
    marginTop: 8,
    lineHeight: 1.4,
  },
  emasNote: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: COLOR.coral,
    marginTop: 6,
  },
  sectionTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 13,
    marginTop: 18,
    marginBottom: 8,
    color: COLOR.teal,
  },
  sectionIntro: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: COLOR.sageDark,
    marginBottom: 6,
  },
  emptyNote: { fontFamily: "Helvetica", fontSize: 9, color: COLOR.sageDark },
  block: {
    backgroundColor: COLOR.white,
    borderRadius: 3,
    padding: 10,
    marginBottom: 8,
  },
  blockTitle: { fontFamily: "Helvetica-Bold", fontSize: 11 },
  blockText: { fontFamily: "Helvetica", fontSize: 9, marginBottom: 2 },
  rowLine: {
    fontFamily: "Helvetica",
    fontSize: 9,
    marginBottom: 3,
    paddingBottom: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: COLOR.sageLight,
  },
  rowHeader: { flexDirection: "row", justifyContent: "space-between" },
  rowName: { fontFamily: "Helvetica-Bold", fontSize: 9.5 },
  rowBand: { fontFamily: "Courier", fontSize: 8.5, color: COLOR.coral },
  rowMeta: { fontFamily: "Courier", fontSize: 8, color: COLOR.sageDark },
  historyRow: { fontFamily: "Courier", fontSize: 8, marginBottom: 2 },
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

// Duplicated (not imported), same discipline as SgdDocument's own label
// maps — every generated artifact is self-contained. German-only.
const aspectCategoryLabelsDe: Record<string, string> = {
  AIR_EMISSIONS: "Luftemissionen",
  ENERGY_USE: "Energieverbrauch",
  WATER_USE: "Wasserverbrauch",
  WASTEWATER: "Abwasser",
  WASTE_NON_HAZARDOUS: "Abfall (nicht gefährlich)",
  WASTE_HAZARDOUS: "Abfall (gefährlich)",
  RAW_MATERIALS: "Rohstoffe",
  HAZARDOUS_SUBSTANCES: "Gefahrstoffe",
  SOIL_GROUNDWATER: "Boden & Grundwasser",
  NOISE_NEIGHBOURHOOD: "Lärm (Nachbarschaft)",
  ODOUR: "Geruch",
  LIGHT_EMISSIONS: "Lichtemissionen",
  TRANSPORT_LOGISTICS: "Verkehr & Logistik",
  BIODIVERSITY_LAND_USE: "Biodiversität & Flächennutzung",
};
const measureTypeLabelsDe: Record<string, string> = {
  AVOID: "Vermeiden",
  REDUCE: "Vermindern",
  REUSE: "Wiederverwenden",
  RECYCLE: "Recyceln",
  RECOVER: "Verwerten",
  DISPOSE_SAFELY: "Sicher entsorgen",
  SUBSTITUTE: "Substituieren",
  TECHNICAL: "Technisch",
  ORGANISATIONAL: "Organisatorisch",
  MONITORING: "Überwachung",
};
const actionStatusLabelsDe: Record<string, string> = {
  OPEN: "Offen",
  IN_PROGRESS: "In Bearbeitung",
  IMPLEMENTED: "Umgesetzt",
  VERIFIED: "Verifiziert",
  CANCELLED: "Storniert",
};
const assessmentStatusLabelsDe: Record<string, string> = {
  DRAFT: "Entwurf",
  IN_REVIEW: "In Prüfung",
  APPROVED: "Freigegeben",
  ARCHIVED: "Archiviert",
};

function formatDate(date: Date): string {
  return `${date.toISOString().replace("T", " ").slice(0, 19)} UTC`;
}
function formatDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function AwkDocument({ data }: { data: AwkReportData }) {
  const {
    site,
    generatedAt,
    workstations,
    processes,
    assessments,
    wasteStreams,
    actions,
    significantFindings,
    futureDevelopmentEntries,
    userNames,
    legalReference,
  } = data;
  const company = site.company;
  const year = generatedAt.getUTCFullYear();

  return (
    <Document
      title={`Abfallwirtschaftskonzept — ${site.name}`}
      author="Statura Labs Dynamics"
      subject={`AWK für ${site.name}, ${company.name}`}
    >
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.headerRow}>
          <View style={styles.brandRow}>
            <BrandMark size={28} />
            <Text style={styles.brandWordmark}>STATURA LABS DYNAMICS</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaText}>
              Erstellt {formatDate(generatedAt)}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <Text style={styles.title}>Abfallwirtschaftskonzept (AWK)</Text>
        <Text style={styles.subtitle}>
          gemäß {legalReference ?? "§10 AWG 2002"}
        </Text>

        <Text style={styles.legalIntro}>
          Ein Abfallwirtschaftskonzept ist nach §10 AWG 2002 für Anlagen zu
          erstellen, in denen Abfälle anfallen und mehr als 20 Arbeitnehmerinnen
          und Arbeitnehmer beschäftigt werden. Es muss innerhalb von zwölf
          Monaten nach Aufnahme des Betriebs bzw. nach Beschäftigung der 21.
          Person vorliegen, ist bei wesentlichen abfallrelevanten Änderungen und
          mindestens alle sieben Jahre fortzuschreiben. Ist ein solches Konzept
          im Rahmen einer Betriebsanlagengenehmigung (§37 GewO 1994 oder
          Mineralrohstoffgesetz) vorgeschrieben, gelten dieselben Inhalte (§10
          Abs. 6). Dieses Dokument bildet die Inhalte gemäß §10 Abs. 3 Z 1–5 ab.
        </Text>
        {site.emasRegistered && (
          <Text style={styles.emasNote}>
            Hinweis: Dieser Standort ist EMAS-registriert. Eine gültige
            EMAS-Umwelterklärung gilt gemäß §10 Abs. 1 AWG 2002 anstelle eines
            eigenen Abfallwirtschaftskonzepts.
          </Text>
        )}

        {/* Z1: industry/purpose + plant-component list */}
        <Text style={styles.sectionTitle}>
          1. Betrieb, Zweck und Anlagenteile
        </Text>
        <View style={styles.block}>
          <Text style={styles.blockText}>Betrieb: {company.name}</Text>
          <Text style={styles.blockText}>
            Arbeitsstätte: {site.name}
            {site.address ? ` — ${site.address}` : ""} ({site.country})
          </Text>
          <Text style={styles.blockText}>
            Anlagenteile:{" "}
            {workstations.length > 0
              ? workstations.map((w) => w.name).join(", ")
              : "—"}
          </Text>
        </View>

        {/* Z2: process-related description + who assessed and when */}
        <Text style={styles.sectionTitle}>
          2. Betriebsbezogene Beschreibung
        </Text>
        {processes.length === 0 ? (
          <Text style={styles.emptyNote}>Keine Prozesse erfasst.</Text>
        ) : (
          processes.map((process) => (
            <View key={process.id} style={styles.rowLine}>
              <Text style={styles.rowName}>{process.name}</Text>
              <Text style={styles.rowMeta}>
                {process.tasks
                  .map((pt) => `${pt.task.name} (${pt.task.workstation.name})`)
                  .join(" → ") || "—"}
              </Text>
            </View>
          ))
        )}

        {/* Z3: waste-related description — streams + significant aspects */}
        <Text style={styles.sectionTitle}>3. Abfallrelevante Beschreibung</Text>
        <Text style={styles.sectionIntro}>
          Abfallströme (Schlüsselnummer, Bezeichnung, Gefährlichkeit, Menge,
          Herkunft, Behandlung, Entsorger) sowie als bedeutend eingestufte
          Umweltaspekte.
        </Text>
        {wasteStreams.length === 0 ? (
          <Text style={styles.emptyNote}>Keine Abfallströme erfasst.</Text>
        ) : (
          wasteStreams.map((ws) => (
            <View key={ws.id} style={styles.rowLine}>
              <View style={styles.rowHeader}>
                <Text style={styles.rowName}>
                  {ws.wasteCode} — {ws.name}
                </Text>
                <Text style={styles.rowBand}>
                  {ws.hazardous ? "gefährlich" : "nicht gefährlich"}
                </Text>
              </View>
              <Text style={styles.rowMeta}>
                {ws.annualQuantity !== null
                  ? `Menge/Jahr: ${ws.annualQuantity} ${ws.unit ?? ""}`
                  : "Menge/Jahr: —"}
                {ws.originWorkstation
                  ? ` — Herkunft: ${ws.originWorkstation.name}`
                  : ws.originProcess
                    ? ` — Herkunft: ${ws.originProcess.name}`
                    : ""}
                {ws.treatment ? ` — Behandlung: ${ws.treatment}` : ""}
                {ws.collectorCompany
                  ? ` — Entsorger: ${ws.collectorCompany}`
                  : ""}
              </Text>
            </View>
          ))
        )}
        {significantFindings.length > 0 && (
          <View style={{ marginTop: 6 }}>
            <Text style={styles.blockTitle}>Bedeutende Umweltaspekte</Text>
            {significantFindings.map((f) => (
              <View key={f.id} style={styles.rowLine}>
                <View style={styles.rowHeader}>
                  <Text style={styles.rowName}>
                    [
                    {aspectCategoryLabelsDe[f.aspect.category] ??
                      f.aspect.category}
                    ] {f.aspect.name}
                  </Text>
                  <Text style={styles.rowBand}>
                    {f.riskBand} ({f.riskScore})
                  </Text>
                </View>
                {f.quantities.map((q) => (
                  <Text key={q.id} style={styles.rowMeta}>
                    {q.value} {q.unit} ({formatDay(q.periodStart)} /{" "}
                    {formatDay(q.periodEnd)}, {q.source}
                    {q.isEstimate ? ", Schätzung" : ""})
                  </Text>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* Z4: organisational measures (the Action register, env-sourced) */}
        <Text style={styles.sectionTitle}>4. Organisatorische Maßnahmen</Text>
        {actions.length === 0 ? (
          <Text style={styles.emptyNote}>Keine Maßnahmen erfasst.</Text>
        ) : (
          actions.map((action) => (
            <View key={action.id} style={styles.rowLine}>
              <View style={styles.rowHeader}>
                <Text style={styles.rowName}>{action.title}</Text>
                <Text style={styles.rowBand}>
                  {actionStatusLabelsDe[action.status] ?? action.status}
                </Text>
              </View>
              <Text style={styles.rowMeta}>
                {action.environmentalMeasureType
                  ? `Maßnahmenart: ${measureTypeLabelsDe[action.environmentalMeasureType] ?? action.environmentalMeasureType} — `
                  : ""}
                Verantwortlich:{" "}
                {(action.responsibleUserId &&
                  userNames.get(action.responsibleUserId)) ??
                  action.responsibleRoleLabel ??
                  "—"}
                {action.dueDate
                  ? ` — Fällig: ${formatDay(action.dueDate)}`
                  : ""}
              </Text>
            </View>
          ))
        )}

        {/* Z5: estimate of future development */}
        <Text style={styles.sectionTitle}>5. Voraussichtliche Entwicklung</Text>
        {futureDevelopmentEntries.length === 0 ? (
          <Text style={styles.emptyNote}>
            Keine Einschätzung der künftigen Entwicklung erfasst.
          </Text>
        ) : (
          futureDevelopmentEntries.map((entry) => (
            <View
              key={`${entry.subject ?? "site"}-${entry.assessedAt.toISOString()}`}
              style={styles.rowLine}
            >
              <Text style={styles.blockText}>{entry.text}</Text>
              <Text style={styles.rowMeta}>
                {entry.subject ? `${entry.subject} — ` : ""}
                {formatDay(entry.assessedAt)}
              </Text>
            </View>
          ))
        )}

        {/* Fortschreibungs-/Prüfhistorie */}
        <Text style={styles.sectionTitle}>
          6. Fortschreibungs- und Prüfhistorie
        </Text>
        {assessments.length === 0 ? (
          <Text style={styles.emptyNote}>Keine Historie vorhanden.</Text>
        ) : (
          assessments.map((ea) => (
            <Text key={ea.id} style={styles.historyRow}>
              {formatDay(ea.assessedAt)} —{" "}
              {ea.workstation?.name ?? "Gesamter Standort"} —{" "}
              {assessmentStatusLabelsDe[ea.status] ?? ea.status}
              {" — "}
              {userNames.get(ea.assessorUserId) ?? "—"}
              {ea.approvedByUserId && ea.approvedAt
                ? ` (freigegeben ${formatDay(ea.approvedAt)} von ${userNames.get(ea.approvedByUserId) ?? "—"})`
                : ""}
            </Text>
          ))
        )}

        <View style={styles.footer} fixed>
          <Text style={styles.footerCopyright}>© {year} Verumsell SRL</Text>
          <Text style={styles.footerDisclaimer}>
            Dieses Dokument bildet das Abfallwirtschaftskonzept gemäß §10 AWG
            2002 aus den im System erfassten Daten ab. Es ersetzt nicht die
            fachliche Prüfung durch eine befugte Person und ist vor behördlicher
            Vorlage zu verifizieren.
          </Text>
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
