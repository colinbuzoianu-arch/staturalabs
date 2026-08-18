import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { BodyRegion } from "@/generated/prisma/enums";
import { describeRegionResult } from "@/lib/capture/describe-region-result";
import { describeManualInput } from "@/lib/capture/manual-input";
import type { RegionResult } from "@/lib/capture/types";
import { getCommonDictionary } from "@/lib/i18n/dictionaries/common";
import { getDashboardDictionary } from "@/lib/i18n/dictionaries/dashboard";
import { BrandMark } from "./brand-mark";
import type { TaskReportData } from "./get-task-report-data";
import type { ReportLang } from "./report-lang";

const ALL_BODY_REGIONS = Object.values(BodyRegion);

// Country-driven (B8c, SLD_NEXT_STEPS_B8b-B8f.md §6, mirroring
// SgdDocument.tsx's country-driven-not-locale-driven philosophy), not
// locale-driven — the Route Handler resolves `lang` from the task's
// site's country (resolveReportLang) before this component ever renders,
// so there's no getLocale() call anywhere in this file. Every enum value
// this document interpolates (RiskBand, CameraAngle, BodyRegion, region-
// result status) reads from getCommonDictionary(lang) — same source of
// truth the dashboard UI and PostureSampleSwitcher use — so a German
// report and the German dashboard never describe the same value two
// different ways. PostureSampleSource (sample.source, "CAMERA_MEDIAPIPE"/
// "MANUAL_ENTRY") deliberately stays untranslated: it's a provenance/
// audit identifier this report treats the same way it treats the
// PostureSample id and the methodology version string, not user-facing
// prose.
const REPORT_STRINGS: Record<
  ReportLang,
  {
    documentTitle: (workstationName: string) => string;
    documentSubject: (taskName: string) => string;
    generatedPrefix: string;
    methodologyPrefix: string;
    methodologyUnavailable: string;
    taskPrefix: string;
    postureSamplesHeading: (count: number) => string;
    cannotRecomputePrefix: string;
    noSamples: string;
    sourcePrefix: string;
    cameraAnglePrefix: string;
    recomputeErrorPrefix: string;
    heldPrefix: string;
    atPostureInfix: string;
    holdTimeEscalatedSuffix: (overallBand: string) => string;
    manualInputsHeading: (count: number) => string;
    noManualInputs: string;
    manualHandlingHeading: string;
    manualHandlingSuffix: string;
    repetitionHeading: string;
    repetitionUnit: string;
    repetitionSuffix: string;
    footerDisclaimer: (methodologyVersion: string) => string;
    postureCategoryMethodSentence: string;
  }
> = {
  en: {
    documentTitle: (workstationName) =>
      `Assessment report — ${workstationName}`,
    documentSubject: (taskName) =>
      `Ergonomic screening report for task ${taskName}`,
    generatedPrefix: "Generated ",
    methodologyPrefix: "Methodology: ",
    methodologyUnavailable: "unavailable",
    taskPrefix: "Task: ",
    postureSamplesHeading: (count) => `Posture samples (${count})`,
    cannotRecomputePrefix: "Cannot recompute region breakdowns: ",
    noSamples: "No captures recorded for this task.",
    sourcePrefix: " — source: ",
    cameraAnglePrefix: " — camera angle: ",
    recomputeErrorPrefix: "Error recomputing this sample: ",
    heldPrefix: "Held ",
    atPostureInfix: "s at posture ",
    holdTimeEscalatedSuffix: (overallBand) =>
      ` — exceeds safe hold duration for this posture — overall ${overallBand}`,
    manualInputsHeading: (count) => `Manual inputs (${count})`,
    noManualInputs: "No manual inputs recorded for this task.",
    manualHandlingHeading: "Manual handling assessment",
    manualHandlingSuffix:
      " — §64 ASchG (no mandated method) — SLD threshold, inspired by ISO 11228-1 / EN 1005-2",
    repetitionHeading: "Repetition assessment",
    repetitionUnit: "reps/cycle",
    repetitionSuffix: " — SLD threshold, inspired by ISO 11228-3 / EN 1005-5",
    footerDisclaimer: (methodologyVersion) =>
      `This is an automated ergonomic screening artifact produced under scoring methodology ${methodologyVersion}. It is not a substitute for assessment by a certified ergonomist and does not constitute a professional ergonomic evaluation.`,
    // B11 (SLD_IMPLEMENTATION_PLAN_posture-input.md §3.4): stated as
    // methodology, not as a caveat — an assessor's observational
    // classification is the primary input model now, not a fallback from
    // "real" degree measurement.
    postureCategoryMethodSentence:
      "Assessed by classifying the observed posture (ISO 11226 / EN 1005-4 oriented), not by angle measurement.",
  },
  de: {
    documentTitle: (workstationName) =>
      `Bewertungsbericht — ${workstationName}`,
    documentSubject: (taskName) =>
      `Ergonomisches Screening-Bericht für Aufgabe ${taskName}`,
    generatedPrefix: "Erstellt am ",
    methodologyPrefix: "Methodik: ",
    methodologyUnavailable: "nicht verfügbar",
    taskPrefix: "Aufgabe: ",
    postureSamplesHeading: (count) => `Haltungsaufnahmen (${count})`,
    cannotRecomputePrefix:
      "Regionale Auswertung kann nicht neu berechnet werden: ",
    noSamples: "Für diese Aufgabe sind noch keine Aufnahmen erfasst.",
    sourcePrefix: " — Quelle: ",
    cameraAnglePrefix: " — Kamerawinkel: ",
    recomputeErrorPrefix: "Fehler bei der Neuberechnung dieser Aufnahme: ",
    heldPrefix: "",
    atPostureInfix: "s gehalten bei Haltung ",
    holdTimeEscalatedSuffix: (overallBand) =>
      ` — überschreitet die sichere Haltedauer für diese Haltung — gesamt ${overallBand}`,
    manualInputsHeading: (count) => `Manuelle Eingaben (${count})`,
    noManualInputs: "Für diese Aufgabe sind keine manuellen Eingaben erfasst.",
    manualHandlingHeading: "Bewertung der manuellen Lastenhandhabung",
    manualHandlingSuffix:
      " — §64 ASchG (keine vorgeschriebene Methode) — SLD-Schwellenwert, orientiert an ISO 11228-1 / EN 1005-2",
    repetitionHeading: "Bewertung der Wiederholungshäufigkeit",
    repetitionUnit: "Wdh./Zyklus",
    repetitionSuffix:
      " — SLD-Schwellenwert, orientiert an ISO 11228-3 / EN 1005-5",
    footerDisclaimer: (methodologyVersion) =>
      `Dies ist ein automatisiert erstelltes ergonomisches Screening-Dokument nach Bewertungsmethodik ${methodologyVersion}. Es ersetzt nicht die Beurteilung durch eine zertifizierte Ergonomie-Fachkraft und stellt keine professionelle ergonomische Bewertung dar.`,
    postureCategoryMethodSentence:
      "Beurteilung durch Einstufung der beobachteten Körperhaltung (ISO 11226 / EN 1005-4 orientiert), nicht durch Winkelmessung.",
  },
};

const COLOR = {
  teal: "#0E3733",
  ivory: "#F2ECE1",
  coral: "#E35C3A",
  sageDark: "#568076",
  sageLight: "#96A5A0",
  white: "#FFFFFF",
};

// Built-in PDF fonts (no embedding needed): Helvetica for prose, Courier
// for technical/tabular readouts — standing in for the dashboard's
// Outfit/JetBrains Mono, which would need font-embedding plumbing this
// print artifact doesn't need (see CLAUDE.md design system notes; this
// report is deliberately "design-neutral," not a pixel match of the app).
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
  taskDescription: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: COLOR.sageDark,
  },
  sectionTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 13,
    marginTop: 18,
    marginBottom: 8,
    color: COLOR.teal,
  },
  emptyNote: { fontFamily: "Helvetica", fontSize: 9, color: COLOR.sageDark },
  sampleBlock: {
    backgroundColor: COLOR.white,
    borderRadius: 3,
    padding: 10,
    marginBottom: 10,
  },
  sampleMeta: {
    fontFamily: "Courier",
    fontSize: 8,
    color: COLOR.sageDark,
    marginBottom: 6,
  },
  sampleError: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: COLOR.coral,
    marginBottom: 4,
  },
  sampleHoldTime: {
    fontFamily: "Courier",
    fontSize: 8,
    color: COLOR.sageDark,
    marginBottom: 6,
  },
  sampleHoldTimeEscalated: {
    fontFamily: "Courier",
    fontSize: 8,
    fontWeight: "bold",
    color: COLOR.coral,
    marginBottom: 6,
  },
  sampleMethodNote: {
    fontFamily: "Helvetica-Oblique",
    fontSize: 7.5,
    color: COLOR.sageDark,
    marginTop: 4,
  },
  table: { display: "flex", flexDirection: "column" },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 0.75,
    borderBottomColor: COLOR.teal,
    paddingBottom: 2,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: COLOR.sageLight,
    paddingVertical: 1.5,
  },
  // colStatus needs to fit "insufficient-visibility" (the longest status
  // value) on one line — 20% wrapped it mid-word ("insufficient-visibili-
  // ty"), confirmed against an actual rendered report, not just reasoned
  // about.
  colRegion: { width: "22%", fontFamily: "Courier", fontSize: 7.5 },
  colStatus: { width: "26%", fontFamily: "Courier", fontSize: 7.5 },
  colDetail: { width: "52%", fontFamily: "Courier", fontSize: 7.5 },
  tableHeaderText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
    color: COLOR.sageDark,
  },
  manualInputGroup: { marginBottom: 10 },
  manualInputGroupTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    marginBottom: 4,
  },
  manualInputRow: {
    backgroundColor: COLOR.white,
    borderRadius: 3,
    padding: 8,
    marginBottom: 4,
  },
  manualInputValue: { fontFamily: "Courier", fontSize: 9 },
  manualInputNotes: {
    fontFamily: "Helvetica",
    fontSize: 8,
    color: COLOR.sageDark,
    marginTop: 2,
  },
  manualInputDate: {
    fontFamily: "Courier",
    fontSize: 7,
    color: COLOR.sageLight,
    marginTop: 2,
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

// No identity fields anywhere below — no "assessed by," no capturing
// user's name or id, no photo. PostureSample/ManualInput carry none by
// design (ERGO_COMPLIANCE_BY_DESIGN.md §3.1/§3.2); this component doesn't
// invent a place to show them either.
export function TaskReportDocument({
  data,
  lang,
}: {
  data: TaskReportData;
  lang: ReportLang;
}) {
  const {
    task,
    generatedAt,
    methodologyVersion,
    methodologyError,
    samples,
    manualInputGroups,
    manualHandlingResult,
    repetitionResult,
  } = data;
  const company = task.workstation.site.company;
  const site = task.workstation.site;
  const workstation = task.workstation;
  const year = generatedAt.getUTCFullYear();
  const s = REPORT_STRINGS[lang];
  const commonDict = getCommonDictionary(lang);
  // Reused rather than the plain MANUAL_INPUT_LABELS constant (English-
  // only) — the dashboard dictionary already carries a translated copy of
  // exactly this label set for every locale this report supports.
  const manualInputLabels = getDashboardDictionary(lang).manualInputLabels;

  return (
    <Document
      title={s.documentTitle(workstation.name)}
      author="Statura Labs Dynamics"
      subject={s.documentSubject(task.name)}
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
              {s.methodologyPrefix}
              {methodologyVersion ?? s.methodologyUnavailable}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <Text style={styles.title}>{workstation.name}</Text>
        <Text style={styles.subtitle}>
          {site.name} · {company.name}
        </Text>
        <Text style={styles.subtitle}>
          {s.taskPrefix}
          {task.name}
        </Text>
        {task.description && (
          <Text style={styles.taskDescription}>{task.description}</Text>
        )}

        <Text style={styles.sectionTitle}>
          {s.postureSamplesHeading(samples.length)}
        </Text>

        {methodologyError && (
          <Text style={styles.sampleError}>
            {s.cannotRecomputePrefix}
            {methodologyError}
          </Text>
        )}

        {samples.length === 0 && (
          <Text style={styles.emptyNote}>{s.noSamples}</Text>
        )}

        {samples.map((sample) => (
          <View key={sample.id} style={styles.sampleBlock} wrap={false}>
            {/* Provenance, always shown (ERGO_COMPLIANCE_BY_DESIGN.md
                §3.16): a manually entered angle and a camera-derived one
                are not equally strong evidence and must never read the
                same. cameraAngle is a real captured fact only for
                CAMERA_MEDIAPIPE — MANUAL_ENTRY stores an inert placeholder
                value there (see createPostureSample), so it's omitted
                rather than shown as if it meant something.
                sample.source (PostureSampleSource) deliberately stays
                untranslated — a provenance/audit identifier, not prose,
                same treatment as the PostureSample id and methodology
                version string right above it. */}
            <Text style={styles.sampleMeta}>
              {formatDate(sample.capturedAt)}
              {s.sourcePrefix}
              {sample.source}
              {sample.source === "CAMERA_MEDIAPIPE"
                ? `${s.cameraAnglePrefix}${commonDict.cameraAngleLabels[sample.cameraAngle]}`
                : ""}
            </Text>

            {sample.error && (
              <Text style={styles.sampleError}>
                {s.recomputeErrorPrefix}
                {sample.error}
              </Text>
            )}

            {/* Hold-time sub-score (§6) — a parallel result to the
                per-region table below, never blended into it. Only shown
                when a hold duration was actually recorded. */}
            {sample.holdTime && (
              <Text
                style={
                  sample.holdTime.holdTimeBand
                    ? styles.sampleHoldTimeEscalated
                    : styles.sampleHoldTime
                }
              >
                {s.heldPrefix}
                {sample.holdTime.holdDurationSeconds}
                {s.atPostureInfix}
                {commonDict.riskBandLabels[sample.holdTime.worstPostureBand]}
                {sample.holdTime.holdTimeBand
                  ? s.holdTimeEscalatedSuffix(
                      commonDict.riskBandLabels[sample.holdTime.overallBand],
                    )
                  : ""}
              </Text>
            )}

            {sample.regions && (
              <View style={styles.table}>
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.colRegion, styles.tableHeaderText]}>
                    {commonDict.postureSampleSwitcher.tableRegion}
                  </Text>
                  <Text style={[styles.colStatus, styles.tableHeaderText]}>
                    {commonDict.postureSampleSwitcher.tableStatus}
                  </Text>
                  <Text style={[styles.colDetail, styles.tableHeaderText]}>
                    {commonDict.postureSampleSwitcher.tableDetail}
                  </Text>
                </View>
                {ALL_BODY_REGIONS.map((region) => {
                  const result: RegionResult | undefined =
                    sample.regions?.[region];
                  if (!result) return null;
                  return (
                    <View key={region} style={styles.tableRow}>
                      <Text style={styles.colRegion}>
                        {commonDict.bodyRegionLabels[region]}
                      </Text>
                      <Text style={styles.colStatus}>
                        {commonDict.regionResultStatusLabels[result.status]}
                      </Text>
                      <Text style={styles.colDetail}>
                        {sample.categoryDetail?.[region] ??
                          describeRegionResult(result, lang)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* B11 (SLD_IMPLEMENTATION_PLAN_posture-input.md §3.4): stated
                once per category-mode sample, not as a hedge — the
                per-region classifications above are the primary evidence,
                and this names the method plainly. */}
            {sample.categoryDetail && (
              <Text style={styles.sampleMethodNote}>
                {s.postureCategoryMethodSentence}
              </Text>
            )}
          </View>
        ))}

        <Text style={styles.sectionTitle}>
          {s.manualInputsHeading(
            manualInputGroups.reduce((n, g) => n + g.rows.length, 0),
          )}
        </Text>

        {manualInputGroups.length === 0 && (
          <Text style={styles.emptyNote}>{s.noManualInputs}</Text>
        )}

        {manualInputGroups.map((group) => (
          <View
            key={group.inputType}
            style={styles.manualInputGroup}
            wrap={false}
          >
            <Text style={styles.manualInputGroupTitle}>
              {manualInputLabels[group.inputType]} ({group.rows.length})
            </Text>
            {group.rows.map((row) => (
              <View key={row.id} style={styles.manualInputRow}>
                <Text style={styles.manualInputValue}>
                  {describeManualInput(row, lang)}
                </Text>
                {row.notes && (
                  <Text style={styles.manualInputNotes}>{row.notes}</Text>
                )}
                <Text style={styles.manualInputDate}>
                  {formatDate(row.createdAt)}
                </Text>
              </View>
            ))}
          </View>
        ))}

        {/* §7 B8: a parallel sub-score against the most recently recorded
            LOAD_WEIGHT_KG manual input — independent of posture/hold-time,
            never blended into either. Only rendered when there's a load
            weight to score. */}
        {manualHandlingResult && (
          <>
            <Text style={styles.sectionTitle}>{s.manualHandlingHeading}</Text>
            <Text style={styles.manualInputRow}>
              {manualHandlingResult.loadWeightKg} kg —{" "}
              {commonDict.riskBandLabels[manualHandlingResult.riskBand]} (
              {manualHandlingResult.riskScore}){s.manualHandlingSuffix}
            </Text>
          </>
        )}

        {/* B8d (SLD_NEXT_STEPS_B8b-B8f.md): same parallel-sub-score
            treatment as manualHandlingResult above, against the most
            recently recorded REPETITION_COUNT manual input. */}
        {repetitionResult && (
          <>
            <Text style={styles.sectionTitle}>{s.repetitionHeading}</Text>
            <Text style={styles.manualInputRow}>
              {repetitionResult.repetitionCount} {s.repetitionUnit} —{" "}
              {commonDict.riskBandLabels[repetitionResult.riskBand]} (
              {repetitionResult.riskScore}){s.repetitionSuffix}
            </Text>
          </>
        )}

        <View style={styles.footer} fixed>
          <Text style={styles.footerCopyright}>© {year} Verumsell SRL</Text>
          <Text style={styles.footerDisclaimer}>
            {s.footerDisclaimer(methodologyVersion ?? s.methodologyUnavailable)}
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
