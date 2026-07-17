import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { BodyRegion } from "@/generated/prisma/enums";
import { describeRegionResult } from "@/lib/capture/describe-region-result";
import {
  describeManualInput,
  MANUAL_INPUT_LABELS,
} from "@/lib/capture/manual-input";
import type { RegionResult } from "@/lib/capture/types";
import { BrandMark } from "./brand-mark";
import type { TaskReportData } from "./get-task-report-data";

const ALL_BODY_REGIONS = Object.values(BodyRegion);

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
export function TaskReportDocument({ data }: { data: TaskReportData }) {
  const {
    task,
    generatedAt,
    methodologyVersion,
    methodologyError,
    samples,
    manualInputGroups,
  } = data;
  const company = task.workstation.site.company;
  const site = task.workstation.site;
  const workstation = task.workstation;
  const year = generatedAt.getUTCFullYear();

  return (
    <Document
      title={`Assessment report — ${workstation.name}`}
      author="Statura Labs Dynamics"
      subject={`Ergonomic screening report for task ${task.name}`}
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
              Methodology: {methodologyVersion ?? "unavailable"}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <Text style={styles.title}>{workstation.name}</Text>
        <Text style={styles.subtitle}>
          {site.name} · {company.name}
        </Text>
        <Text style={styles.subtitle}>Task: {task.name}</Text>
        {task.description && (
          <Text style={styles.taskDescription}>{task.description}</Text>
        )}

        <Text style={styles.sectionTitle}>
          Posture samples ({samples.length})
        </Text>

        {methodologyError && (
          <Text style={styles.sampleError}>
            Cannot recompute region breakdowns: {methodologyError}
          </Text>
        )}

        {samples.length === 0 && (
          <Text style={styles.emptyNote}>
            No captures recorded for this task.
          </Text>
        )}

        {samples.map((sample) => (
          <View key={sample.id} style={styles.sampleBlock} wrap={false}>
            <Text style={styles.sampleMeta}>
              {formatDate(sample.capturedAt)} — cameraAngle:{" "}
              {sample.cameraAngle}
            </Text>

            {sample.error && (
              <Text style={styles.sampleError}>
                Error recomputing this sample: {sample.error}
              </Text>
            )}

            {sample.regions && (
              <View style={styles.table}>
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.colRegion, styles.tableHeaderText]}>
                    Region
                  </Text>
                  <Text style={[styles.colStatus, styles.tableHeaderText]}>
                    Status
                  </Text>
                  <Text style={[styles.colDetail, styles.tableHeaderText]}>
                    Detail
                  </Text>
                </View>
                {ALL_BODY_REGIONS.map((region) => {
                  const result: RegionResult | undefined =
                    sample.regions?.[region];
                  if (!result) return null;
                  return (
                    <View key={region} style={styles.tableRow}>
                      <Text style={styles.colRegion}>{region}</Text>
                      <Text style={styles.colStatus}>{result.status}</Text>
                      <Text style={styles.colDetail}>
                        {describeRegionResult(result)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        ))}

        <Text style={styles.sectionTitle}>
          Manual inputs (
          {manualInputGroups.reduce((n, g) => n + g.rows.length, 0)})
        </Text>

        {manualInputGroups.length === 0 && (
          <Text style={styles.emptyNote}>
            No manual inputs recorded for this task.
          </Text>
        )}

        {manualInputGroups.map((group) => (
          <View
            key={group.inputType}
            style={styles.manualInputGroup}
            wrap={false}
          >
            <Text style={styles.manualInputGroupTitle}>
              {MANUAL_INPUT_LABELS[group.inputType]} ({group.rows.length})
            </Text>
            {group.rows.map((row) => (
              <View key={row.id} style={styles.manualInputRow}>
                <Text style={styles.manualInputValue}>
                  {describeManualInput(row)}
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

        <View style={styles.footer} fixed>
          <Text style={styles.footerCopyright}>© {year} Verumsell SRL</Text>
          <Text style={styles.footerDisclaimer}>
            This is an automated ergonomic screening artifact produced under
            scoring methodology {methodologyVersion ?? "unavailable"}. It is not
            a substitute for assessment by a certified ergonomist and does not
            constitute a professional ergonomic evaluation.
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
