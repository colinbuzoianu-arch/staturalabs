import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { BrandMark } from "./brand-mark";
import type { RiskAssessmentReportData } from "./get-risk-assessment-report-data";

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

function formatMeasurement(m: {
  value: number;
  unit: string;
  limitValue: number | null;
  limitReference: string | null;
  instrument: string | null;
  method: string | null;
  measuredAt: Date;
}): { text: string; overLimit: boolean } {
  const overLimit = m.limitValue !== null && m.value > m.limitValue;
  const parts = [`${m.value} ${m.unit}`];
  if (m.limitValue !== null) {
    parts.push(
      `limit ${m.limitValue} ${m.unit}${overLimit ? " (OVER LIMIT)" : ""}`,
    );
  }
  if (m.limitReference) parts.push(m.limitReference);
  if (m.instrument) parts.push(m.instrument);
  if (m.method) parts.push(m.method);
  parts.push(formatDate(m.measuredAt));
  return { text: parts.join(" — "), overLimit };
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
}: {
  data: RiskAssessmentReportData;
}) {
  const { riskAssessment, generatedAt } = data;
  const { site, findings } = riskAssessment;
  const company = site.company;
  const subjectName =
    riskAssessment.workstation?.name ?? riskAssessment.process?.name ?? "—";
  const year = generatedAt.getUTCFullYear();

  return (
    <Document
      title={`Risk assessment — ${subjectName}`}
      author="Statura Labs Dynamics"
      subject={`Risk assessment report for ${subjectName}`}
    >
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.headerRow}>
          <View style={styles.brandRow}>
            <BrandMark size={28} />
            <Text style={styles.brandWordmark}>STATURA LABS DYNAMICS</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaText}>
              Generated {formatDate(generatedAt)}
            </Text>
            <Text style={styles.metaText}>
              Matrix: {riskAssessment.matrixVersion}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <Text style={styles.title}>{subjectName}</Text>
        <Text style={styles.subtitle}>
          {site.name} · {company.name}
        </Text>
        <Text style={styles.subtitle}>
          Status: {riskAssessment.status} — Assessed{" "}
          {formatDate(riskAssessment.assessedAt)}
          {riskAssessment.approvedAt &&
            ` — Approved ${formatDate(riskAssessment.approvedAt)}`}
        </Text>
        {riskAssessment.notes && (
          <Text style={styles.subtitle}>{riskAssessment.notes}</Text>
        )}

        <Text style={styles.sectionTitle}>Findings ({findings.length})</Text>

        {findings.length === 0 && (
          <Text style={styles.emptyNote}>
            No findings recorded for this assessment.
          </Text>
        )}

        {findings.map((finding) => (
          <View key={finding.id} style={styles.findingBlock} wrap={false}>
            <View style={styles.findingHeaderRow}>
              <View>
                <Text style={styles.findingCategory}>
                  {finding.hazard.category}
                </Text>
                <Text style={styles.findingHazard}>{finding.hazard.name}</Text>
              </View>
              <Text style={styles.findingBand}>
                {finding.riskBand} ({finding.riskScore})
              </Text>
            </View>

            <Text style={styles.findingMeta}>
              probability {finding.probability} · severity {finding.severity}
              {finding.residualRiskBand &&
                ` · residual: ${finding.residualRiskBand} (${finding.residualRiskScore})`}
            </Text>

            {finding.existingControls && (
              <Text style={styles.findingText}>
                Existing controls: {finding.existingControls}
              </Text>
            )}
            {finding.notes && (
              <Text style={styles.findingText}>{finding.notes}</Text>
            )}

            {finding.measurements.length > 0 && (
              <View style={styles.measurementsBlock}>
                <Text style={styles.measurementsTitle}>
                  Exposure measurements ({finding.measurements.length})
                </Text>
                {finding.measurements.map((m) => {
                  const { text, overLimit } = formatMeasurement(m);
                  return (
                    <Text
                      key={m.id}
                      style={
                        overLimit
                          ? [styles.measurementRow, styles.overLimit]
                          : styles.measurementRow
                      }
                    >
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
            This is an automated risk-register artifact produced under risk
            matrix version {riskAssessment.matrixVersion}. It is not a
            substitute for assessment by a certified EHS/health-and-safety
            professional and does not constitute a professional risk assessment
            on its own.
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
