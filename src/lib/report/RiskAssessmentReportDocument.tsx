import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getCommonDictionary } from "@/lib/i18n/dictionaries/common";
import {
  type ExposureThresholdStatus,
  exposureThresholdStatus,
} from "@/lib/risk/exposure-threshold-status";
import { BrandMark } from "./brand-mark";
import type { RiskAssessmentReportData } from "./get-risk-assessment-report-data";
import type { ReportLang } from "./report-lang";

// Country-driven, not locale-driven — same philosophy as
// TaskReportDocument.tsx/SgdDocument.tsx (B8c, SLD_NEXT_STEPS_B8b-
// B8f.md §6). HazardCategory/RiskAssessmentStatus labels are reused from
// the administration dictionary (already translated per-locale, per M5)
// rather than duplicated here.
const REPORT_STRINGS: Record<
  ReportLang,
  {
    documentTitle: (subjectName: string) => string;
    documentSubject: (subjectName: string) => string;
    generatedPrefix: string;
    matrixPrefix: string;
    statusPrefix: string;
    assessedInfix: string;
    approvedInfix: (date: string) => string;
    findingsHeading: (count: number) => string;
    noFindings: string;
    probabilityLabel: string;
    severityLabel: string;
    residualInfix: (band: string, score: number) => string;
    existingControlsPrefix: string;
    measurementsHeading: (count: number) => string;
    actionValuePrefix: string;
    overActionValueSuffix: string;
    limitPrefix: string;
    overLimitSuffix: string;
    footerDisclaimer: (matrixVersion: string) => string;
  }
> = {
  en: {
    documentTitle: (subjectName) => `Risk assessment — ${subjectName}`,
    documentSubject: (subjectName) =>
      `Risk assessment report for ${subjectName}`,
    generatedPrefix: "Generated ",
    matrixPrefix: "Matrix: ",
    statusPrefix: "Status: ",
    assessedInfix: " — Assessed ",
    approvedInfix: (date) => ` — Approved ${date}`,
    findingsHeading: (count) => `Findings (${count})`,
    noFindings: "No findings recorded for this assessment.",
    probabilityLabel: "probability",
    severityLabel: "severity",
    residualInfix: (band, score) => ` · residual: ${band} (${score})`,
    existingControlsPrefix: "Existing controls: ",
    measurementsHeading: (count) => `Exposure measurements (${count})`,
    actionValuePrefix: "action",
    overActionValueSuffix: " (OVER ACTION VALUE)",
    limitPrefix: "limit",
    overLimitSuffix: " (OVER LIMIT)",
    footerDisclaimer: (matrixVersion) =>
      `This is an automated risk-register artifact produced under risk matrix version ${matrixVersion}. It is not a substitute for assessment by a certified EHS/health-and-safety professional and does not constitute a professional risk assessment on its own.`,
  },
  de: {
    documentTitle: (subjectName) => `Gefährdungsbeurteilung — ${subjectName}`,
    documentSubject: (subjectName) =>
      `Gefährdungsbeurteilungsbericht für ${subjectName}`,
    generatedPrefix: "Erstellt am ",
    matrixPrefix: "Matrix: ",
    statusPrefix: "Status: ",
    assessedInfix: " — Beurteilt am ",
    approvedInfix: (date) => ` — Freigegeben am ${date}`,
    findingsHeading: (count) => `Feststellungen (${count})`,
    noFindings: "Für diese Beurteilung sind keine Feststellungen erfasst.",
    probabilityLabel: "Wahrscheinlichkeit",
    severityLabel: "Schweregrad",
    residualInfix: (band, score) => ` · Restrisiko: ${band} (${score})`,
    existingControlsPrefix: "Bestehende Maßnahmen: ",
    measurementsHeading: (count) => `Expositionsmessungen (${count})`,
    actionValuePrefix: "Auslösewert",
    overActionValueSuffix: " (ÜBER AUSLÖSEWERT)",
    limitPrefix: "Grenzwert",
    overLimitSuffix: " (ÜBERSCHRITTEN)",
    footerDisclaimer: (matrixVersion) =>
      `Dies ist ein automatisiert erstelltes Risikoregister-Dokument nach Risikomatrix-Version ${matrixVersion}. Es ersetzt nicht die Beurteilung durch eine zertifizierte Fachkraft für Arbeitssicherheit/Gesundheitsschutz und stellt keine professionelle Gefährdungsbeurteilung dar.`,
  },
};

// Same palette/type conventions as TaskReportDocument.tsx — one visual
// system across every printable artifact this app produces, deliberately
// design-neutral (Helvetica/Courier, no font embedding) rather than a
// pixel match of the app's own Outfit/JetBrains Mono, same reasoning as
// that document.
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
  sectionTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 13,
    marginTop: 18,
    marginBottom: 8,
    color: COLOR.teal,
  },
  emptyNote: { fontFamily: "Helvetica", fontSize: 9, color: COLOR.sageDark },
  findingBlock: {
    backgroundColor: COLOR.white,
    borderRadius: 3,
    padding: 10,
    marginBottom: 10,
  },
  findingHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  findingHazard: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
  },
  findingCategory: {
    fontFamily: "Courier",
    fontSize: 7.5,
    color: COLOR.sageDark,
    marginBottom: 2,
  },
  findingBand: {
    fontFamily: "Courier",
    fontSize: 9,
    color: COLOR.coral,
  },
  findingMeta: {
    fontFamily: "Courier",
    fontSize: 8,
    color: COLOR.sageDark,
    marginBottom: 4,
  },
  findingText: {
    fontFamily: "Helvetica",
    fontSize: 9,
    marginBottom: 2,
  },
  measurementsBlock: { marginTop: 6 },
  measurementsTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8.5,
    color: COLOR.sageDark,
    marginBottom: 3,
  },
  measurementRow: {
    fontFamily: "Courier",
    fontSize: 8,
    marginBottom: 2,
  },
  overLimit: { color: COLOR.coral, fontFamily: "Courier-Bold" },
  // Distinct, less severe than overLimit — the Auslösewert/action-value
  // tier obliges the employer to plan measures, but isn't the
  // never-exceed Expositionsgrenzwert itself (§4.4). Amber, not coral, so
  // the two tiers stay visually as well as textually distinct.
  overActionValue: { color: "#b45309", fontFamily: "Courier-Bold" },
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

function formatMeasurement(
  m: {
    value: number;
    unit: string;
    actionValue: number | null;
    actionValueReference: string | null;
    limitValue: number | null;
    limitReference: string | null;
    instrument: string | null;
    method: string | null;
    measuredAt: Date;
  },
  s: (typeof REPORT_STRINGS)[ReportLang],
): { text: string; status: ExposureThresholdStatus } {
  const status = exposureThresholdStatus(m);
  const parts = [`${m.value} ${m.unit}`];
  if (m.actionValue !== null) {
    parts.push(
      `${s.actionValuePrefix} ${m.actionValue} ${m.unit}${status === "over-action-value" ? s.overActionValueSuffix : ""}`,
    );
    if (m.actionValueReference) parts.push(m.actionValueReference);
  }
  if (m.limitValue !== null) {
    parts.push(
      `${s.limitPrefix} ${m.limitValue} ${m.unit}${status === "over-limit-value" ? s.overLimitSuffix : ""}`,
    );
    if (m.limitReference) parts.push(m.limitReference);
  }
  if (m.instrument) parts.push(m.instrument);
  if (m.method) parts.push(m.method);
  parts.push(formatDate(m.measuredAt));
  return { text: parts.join(" — "), status };
}

// Same non-negotiable as TaskReportDocument: no identity fields anywhere.
// assessorUserId/approvedByUserId reference PlatformUser accounts (not
// shop-floor workers), but this report still doesn't surface them — same
// "no assessed-by" discipline as the ergonomic report, so this never
// becomes a template someone later adds a worker-identity field to.
// pilotContext is deliberately omitted too, same reasoning as
// AssessmentSession.pilotContext never appearing in a customer-facing
// artifact (§3.6): internal-only audit metadata, not report content.
export function RiskAssessmentReportDocument({
  data,
  lang,
}: {
  data: RiskAssessmentReportData;
  lang: ReportLang;
}) {
  const { riskAssessment, generatedAt } = data;
  const { site, findings } = riskAssessment;
  const company = site.company;
  const subjectName =
    riskAssessment.workstation?.name ?? riskAssessment.process?.name ?? "—";
  const year = generatedAt.getUTCFullYear();
  const s = REPORT_STRINGS[lang];
  const commonDict = getCommonDictionary(lang);
  const adminDict = getAdministrationDictionary(lang);

  return (
    <Document
      title={s.documentTitle(subjectName)}
      author="Statura Labs Dynamics"
      subject={s.documentSubject(subjectName)}
    >
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.headerRow}>
          <View style={styles.brandRow}>
            <BrandMark size={28} />
            <Text style={styles.brandWordmark}>STATURA LABS DYNAMICS</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaText}>
              {s.generatedPrefix}
              {formatDate(generatedAt)}
            </Text>
            <Text style={styles.metaText}>
              {s.matrixPrefix}
              {riskAssessment.matrixVersion}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <Text style={styles.title}>{subjectName}</Text>
        <Text style={styles.subtitle}>
          {site.name} · {company.name}
        </Text>
        <Text style={styles.subtitle}>
          {s.statusPrefix}
          {adminDict.riskAssessmentStatusLabels[riskAssessment.status]}
          {s.assessedInfix}
          {formatDate(riskAssessment.assessedAt)}
          {riskAssessment.approvedAt &&
            s.approvedInfix(formatDate(riskAssessment.approvedAt))}
        </Text>
        {riskAssessment.notes && (
          <Text style={styles.subtitle}>{riskAssessment.notes}</Text>
        )}

        <Text style={styles.sectionTitle}>
          {s.findingsHeading(findings.length)}
        </Text>

        {findings.length === 0 && (
          <Text style={styles.emptyNote}>{s.noFindings}</Text>
        )}

        {findings.map((finding) => (
          <View key={finding.id} style={styles.findingBlock} wrap={false}>
            <View style={styles.findingHeaderRow}>
              <View>
                <Text style={styles.findingCategory}>
                  {adminDict.hazardCategoryLabels[finding.hazard.category]}
                </Text>
                <Text style={styles.findingHazard}>{finding.hazard.name}</Text>
              </View>
              <Text style={styles.findingBand}>
                {commonDict.riskBandLabels[finding.riskBand]} (
                {finding.riskScore})
              </Text>
            </View>

            <Text style={styles.findingMeta}>
              {s.probabilityLabel} {finding.probability} · {s.severityLabel}{" "}
              {finding.severity}
              {finding.residualRiskBand &&
                s.residualInfix(
                  commonDict.riskBandLabels[finding.residualRiskBand],
                  finding.residualRiskScore ?? 0,
                )}
            </Text>

            {finding.existingControls && (
              <Text style={styles.findingText}>
                {s.existingControlsPrefix}
                {finding.existingControls}
              </Text>
            )}
            {finding.notes && (
              <Text style={styles.findingText}>{finding.notes}</Text>
            )}

            {finding.measurements.length > 0 && (
              <View style={styles.measurementsBlock}>
                <Text style={styles.measurementsTitle}>
                  {s.measurementsHeading(finding.measurements.length)}
                </Text>
                {finding.measurements.map((m) => {
                  const { text, status } = formatMeasurement(m, s);
                  const style =
                    status === "over-limit-value"
                      ? [styles.measurementRow, styles.overLimit]
                      : status === "over-action-value"
                        ? [styles.measurementRow, styles.overActionValue]
                        : styles.measurementRow;
                  return (
                    <Text key={m.id} style={style}>
                      {text}
                    </Text>
                  );
                })}
              </View>
            )}
          </View>
        ))}

        <View style={styles.footer} fixed>
          <Text style={styles.footerCopyright}>© {year} Verumsell SRL</Text>
          <Text style={styles.footerDisclaimer}>
            {s.footerDisclaimer(riskAssessment.matrixVersion)}
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
