import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import {
  type ExposureThresholdStatus,
  exposureThresholdStatus,
} from "@/lib/risk/exposure-threshold-status";
import { BrandMark } from "./brand-mark";
import type { SgdReportData } from "./get-sgd-report-data";

// Same palette/type conventions as the other three report documents — one
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
  blockHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  blockTitle: { fontFamily: "Helvetica-Bold", fontSize: 11 },
  blockMeta: {
    fontFamily: "Courier",
    fontSize: 8,
    color: COLOR.sageDark,
    marginBottom: 4,
  },
  blockText: { fontFamily: "Helvetica", fontSize: 9, marginBottom: 2 },
  findingRow: {
    fontFamily: "Helvetica",
    fontSize: 9,
    marginBottom: 3,
    paddingBottom: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: COLOR.sageLight,
  },
  findingHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  findingHazard: { fontFamily: "Helvetica-Bold", fontSize: 9.5 },
  findingBand: { fontFamily: "Courier", fontSize: 8.5, color: COLOR.coral },
  measurementRow: { fontFamily: "Courier", fontSize: 8, marginTop: 1 },
  overLimit: { color: COLOR.coral, fontFamily: "Courier-Bold" },
  overActionValue: { color: "#b45309", fontFamily: "Courier-Bold" },
  standardRow: {
    fontFamily: "Helvetica",
    fontSize: 9,
    marginBottom: 6,
    lineHeight: 1.4,
  },
  standardRef: { fontFamily: "Helvetica-Bold" },
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

// Duplicated from src/lib/i18n/dictionaries/administration/de.ts rather
// than imported — every i18n area (and every generated artifact) in this
// app is self-contained, no cross-area/cross-artifact dictionary imports
// (CLAUDE.md). This document is always German, never locale-driven (§7 B5:
// "the first artifact where English-only is not acceptable, because the
// reader is an Austrian inspector or SFK") — it doesn't read getLocale()
// at all. RiskBand itself deliberately stays untranslated, same rule this
// codebase applies everywhere else a RiskBand is shown (dashboard,
// /admin, the other three PDF reports).
const hazardCategoryLabelsDe: Record<string, string> = {
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
};
const riskAssessmentStatusLabelsDe: Record<string, string> = {
  DRAFT: "Entwurf",
  IN_REVIEW: "In Prüfung",
  APPROVED: "Freigegeben",
  ARCHIVED: "Archiviert",
};
const actionStatusLabelsDe: Record<string, string> = {
  OPEN: "Offen",
  IN_PROGRESS: "In Bearbeitung",
  IMPLEMENTED: "Umgesetzt",
  VERIFIED: "Verifiziert",
  CANCELLED: "Storniert",
};
const hierarchyOfControlLabelsDe: Record<string, string> = {
  ELIMINATION: "Beseitigung",
  SUBSTITUTION: "Substitution",
  ENGINEERING_CONTROL: "Technische Maßnahme",
  ADMINISTRATIVE_CONTROL: "Organisatorische Maßnahme",
  PPE: "Persönliche Schutzausrüstung",
};
const verificationOutcomeLabelsDe: Record<string, string> = {
  EFFECTIVE: "Wirksam",
  PARTIALLY_EFFECTIVE: "Teilweise wirksam",
  NOT_EFFECTIVE: "Nicht wirksam",
};
// §7 B7: the four ÖNORM EN ISO 10075-1/-3 dimensions and the recognised
// assessment methods, in the German terms Austrian guidance itself uses.
const psychosocialDimensionLabelsDe: Record<string, string> = {
  TASK_AND_ACTIVITY: "Arbeitsaufgabe und Tätigkeit",
  WORK_ORGANIZATION: "Arbeitsorganisation und Arbeitsabläufe",
  WORK_ENVIRONMENT: "Arbeitsumgebung",
  SOCIAL_CLIMATE: "Sozial- und Organisationsklima",
};
const psychosocialMethodLabelsDe: Record<string, string> = {
  QUESTIONNAIRE: "Fragebogen",
  GROUP_DISCUSSION: "Gruppendiskussion",
  OBSERVATION: "Beobachtung",
  INTERVIEW: "Interview",
};

function formatDate(date: Date): string {
  return `${date.toISOString().replace("T", " ").slice(0, 19)} UTC`;
}
function formatDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function subjectLabel(ra: SgdReportData["currentAssessments"][number]): string {
  return ra.workstation?.name ?? ra.process?.name ?? "—";
}

function formatMeasurement(m: {
  value: number;
  unit: string;
  actionValue: number | null;
  actionValueReference: string | null;
  limitValue: number | null;
  limitReference: string | null;
  measuredAt: Date;
}): { text: string; status: ExposureThresholdStatus } {
  const status = exposureThresholdStatus(m);
  const parts = [`${m.value} ${m.unit}`];
  if (m.actionValue !== null) {
    parts.push(
      `Auslösewert ${m.actionValue} ${m.unit}${status === "over-action-value" ? " (ÜBERSCHRITTEN)" : ""}`,
    );
    if (m.actionValueReference) parts.push(m.actionValueReference);
  }
  if (m.limitValue !== null) {
    parts.push(
      `Expositionsgrenzwert ${m.limitValue} ${m.unit}${status === "over-limit-value" ? " (ÜBERSCHRITTEN)" : ""}`,
    );
    if (m.limitReference) parts.push(m.limitReference);
  }
  parts.push(formatDate(m.measuredAt));
  return { text: parts.join(" — "), status };
}

// DOK-VO/§5 ASchG-shaped Sicherheits- und Gesundheitsschutzdokument
// (SLD_IMPLEMENTATION_PLAN_austria-first.md §7 B5). Zero identity fields,
// same discipline as every other generated artifact — assessorUserId/
// approvedByUserId/responsibleUserId/verifiedByUserId reference
// PlatformUser accounts (EHS staff), never a shop-floor worker.
export function SgdDocument({ data }: { data: SgdReportData }) {
  const {
    site,
    workstation,
    generatedAt,
    methodologyVersion,
    appliedStandards,
    currentAssessments,
    history,
    actions,
    userNames,
  } = data;
  const company = site.company;
  const year = generatedAt.getUTCFullYear();
  const scopeLabel = workstation
    ? `Arbeitsplatz: ${workstation.name}`
    : "Gesamter Standort";
  const verifiedActions = actions.filter((a) => a.status === "VERIFIED");

  return (
    <Document
      title={`Sicherheits- und Gesundheitsschutzdokument — ${site.name}`}
      author="Statura Labs Dynamics"
      subject={`SGD für ${site.name}, ${company.name}`}
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
            <Text style={styles.metaText}>Methodik: {methodologyVersion}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <Text style={styles.title}>
          Sicherheits- und Gesundheitsschutzdokument (SGD)
        </Text>
        <Text style={styles.subtitle}>
          gemäß §5 ASchG und DOK-VO (Verordnung über die Sicherheits- und
          Gesundheitsschutzdokumente)
        </Text>

        {/* 1. Betrieb / Arbeitsstätte identification, evaluation scope. */}
        <Text style={styles.sectionTitle}>1. Betrieb / Arbeitsstätte</Text>
        <View style={styles.block}>
          <Text style={styles.blockText}>Betrieb: {company.name}</Text>
          <Text style={styles.blockText}>
            Arbeitsstätte: {site.name}
            {site.address ? ` — ${site.address}` : ""} ({site.country})
          </Text>
          <Text style={styles.blockText}>
            Umfang dieses Dokuments: {scopeLabel}
          </Text>
        </View>

        {/* 2. Who performed the evaluation and when — from the
            assessment's own assessor/approver + date fields, not a
            free-text field. */}
        <Text style={styles.sectionTitle}>2. Durchgeführt von und wann</Text>
        {currentAssessments.length === 0 ? (
          <Text style={styles.emptyNote}>
            Für diesen Umfang liegt noch keine Gefährdungsbeurteilung vor.
          </Text>
        ) : (
          currentAssessments.map((ra) => (
            <View key={ra.id} style={styles.block} wrap={false}>
              <Text style={styles.blockTitle}>{subjectLabel(ra)}</Text>
              <Text style={styles.blockText}>
                Evaluierung durchgeführt von:{" "}
                {userNames.get(ra.assessorUserId) ?? "—"} am{" "}
                {formatDay(ra.assessedAt)} — Status:{" "}
                {riskAssessmentStatusLabelsDe[ra.status] ?? ra.status}
              </Text>
              {ra.approvedByUserId && ra.approvedAt && (
                <Text style={styles.blockText}>
                  Freigegeben von: {userNames.get(ra.approvedByUserId) ?? "—"}{" "}
                  am {formatDay(ra.approvedAt)}
                </Text>
              )}
            </View>
          ))
        )}

        {/* 3. Per workplace/activity group: identified Gefahren, the
            assessment, existing controls. 4. Measurements against limits
            (both tiers). */}
        <Text style={styles.sectionTitle}>
          3. Gefährdungen, Bewertung und Maßnahmen je Arbeitsplatz
        </Text>
        {currentAssessments.map((ra) => (
          <View key={ra.id} style={{ marginBottom: 10 }}>
            <Text style={styles.blockTitle}>{subjectLabel(ra)}</Text>
            {ra.findings.length === 0 ? (
              <Text style={styles.emptyNote}>Keine Gefährdungen erfasst.</Text>
            ) : (
              ra.findings.map((finding) => (
                <View key={finding.id} style={styles.findingRow}>
                  <View style={styles.findingHeaderRow}>
                    <Text style={styles.findingHazard}>
                      [
                      {hazardCategoryLabelsDe[finding.hazard.category] ??
                        finding.hazard.category}
                      ] {finding.hazard.name}
                    </Text>
                    <Text style={styles.findingBand}>
                      {finding.riskBand} ({finding.riskScore})
                    </Text>
                  </View>
                  {finding.existingControls && (
                    <Text style={styles.blockText}>
                      Bestehende Maßnahmen: {finding.existingControls}
                    </Text>
                  )}
                  {finding.psychosocialDetail && (
                    <Text style={styles.blockMeta}>
                      {psychosocialDimensionLabelsDe[
                        finding.psychosocialDetail.dimension
                      ] ?? finding.psychosocialDetail.dimension}{" "}
                      —{" "}
                      {psychosocialMethodLabelsDe[
                        finding.psychosocialDetail.method
                      ] ?? finding.psychosocialDetail.method}{" "}
                      — Gruppengröße {finding.psychosocialDetail.groupSize}
                      {finding.psychosocialDetail.externalProcedureName &&
                        ` — Verfahren: ${finding.psychosocialDetail.externalProcedureName}`}
                    </Text>
                  )}
                  {finding.measurements.map((m) => {
                    const { text, status } = formatMeasurement(m);
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
              ))
            )}
          </View>
        ))}

        {/* Plan item 5: Maßnahmen — the Action register. */}
        <Text style={styles.sectionTitle}>4. Maßnahmen</Text>
        {actions.length === 0 ? (
          <Text style={styles.emptyNote}>Keine Maßnahmen erfasst.</Text>
        ) : (
          actions.map((action) => (
            <View key={action.id} style={styles.block} wrap={false}>
              <View style={styles.blockHeaderRow}>
                <Text style={styles.blockTitle}>{action.title}</Text>
                <Text style={styles.findingBand}>
                  {actionStatusLabelsDe[action.status] ?? action.status}
                </Text>
              </View>
              <Text style={styles.blockMeta}>
                {action.hierarchyOfControl
                  ? `Maßnahmenkategorie: ${hierarchyOfControlLabelsDe[action.hierarchyOfControl] ?? action.hierarchyOfControl} — `
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
              {action.description && (
                <Text style={styles.blockText}>{action.description}</Text>
              )}
            </View>
          ))
        )}

        {/* 6. Applied standards and technical rules, generated from the
            active methodology version's own rule set. */}
        <Text style={styles.sectionTitle}>
          5. Angewandte Normen und Regeln der Technik
        </Text>
        <Text style={styles.sectionIntro}>
          Wo ÖNORMEN, harmonisierte europäische Normen oder sonstige anerkannte
          Regeln der Technik zur Ableitung von Maßnahmen herangezogen wurden,
          sind diese hier benannt (§5 DOK-VO).
        </Text>
        {appliedStandards.length === 0 ? (
          <Text style={styles.emptyNote}>
            Für die aktuell aktive Methodik sind keine Normen hinterlegt.
          </Text>
        ) : (
          appliedStandards.map((std) => (
            <Text key={std.reference} style={styles.standardRow}>
              <Text style={styles.standardRef}>{std.reference}</Text> —{" "}
              {std.appliesTo}. {std.note}
            </Text>
          ))
        )}

        {/* 7. Verification of effectiveness — §4 Abs 4 ASchG. */}
        <Text style={styles.sectionTitle}>
          6. Überprüfung der Wirksamkeit von Maßnahmen
        </Text>
        <Text style={styles.sectionIntro}>
          §4 Abs 4 ASchG verlangt, dass die Wirksamkeit gesetzter Maßnahmen
          überprüft und diese bei Bedarf angepasst werden.
        </Text>
        {verifiedActions.length === 0 ? (
          <Text style={styles.emptyNote}>
            Für den gewählten Umfang liegt noch keine verifizierte Maßnahme vor.
          </Text>
        ) : (
          verifiedActions.map((action) => (
            <View key={action.id} style={styles.block} wrap={false}>
              <Text style={styles.blockTitle}>{action.title}</Text>
              <Text style={styles.blockMeta}>
                Ergebnis:{" "}
                {(action.verificationOutcome &&
                  verificationOutcomeLabelsDe[action.verificationOutcome]) ??
                  "—"}
                {action.verifiedAt
                  ? ` — Verifiziert am ${formatDay(action.verifiedAt)}`
                  : ""}
                {action.verifiedByUserId &&
                  ` von ${userNames.get(action.verifiedByUserId) ?? "—"}`}
              </Text>
              {action.verificationAssessment && (
                <Text style={styles.blockText}>
                  Grundlage: Nachbeurteilung vom{" "}
                  {formatDay(action.verificationAssessment.assessedAt)}
                </Text>
              )}
              {action.verificationNote && (
                <Text style={styles.blockText}>{action.verificationNote}</Text>
              )}
            </View>
          ))
        )}

        {/* 8. Review/adaptation history — every assessment in scope,
            regardless of status, chronologically. */}
        <Text style={styles.sectionTitle}>
          7. Überprüfungs- und Anpassungshistorie
        </Text>
        {history.length === 0 ? (
          <Text style={styles.emptyNote}>Keine Historie vorhanden.</Text>
        ) : (
          history.map((ra) => (
            <Text key={ra.id} style={styles.historyRow}>
              {formatDay(ra.assessedAt)} — {subjectLabel(ra)} —{" "}
              {riskAssessmentStatusLabelsDe[ra.status] ?? ra.status}
              {ra.approvedAt
                ? ` — freigegeben ${formatDay(ra.approvedAt)}`
                : ""}
            </Text>
          ))
        )}

        <View style={styles.footer} fixed>
          <Text style={styles.footerCopyright}>© {year} Verumsell SRL</Text>
          <Text style={styles.footerDisclaimer}>
            Dieses Dokument bildet die eigene Evaluierung des Arbeitgebers gemäß
            §5 ASchG/DOK-VO ab. Es ersetzt nicht die Beurteilung durch eine
            befugte Sicherheitsfachkraft oder einen Arbeitsmediziner.
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
