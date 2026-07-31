import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { BrandMark } from "./brand-mark";
import type { WorkerBriefingData } from "./get-worker-briefing-data";

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
// it. English-only for now, unlike the read-only dashboard — a known
// scope limit worth revisiting given the intended audience, not an
// oversight (see CLAUDE.md).
export function WorkerBriefingDocument({ data }: { data: WorkerBriefingData }) {
  const { site, generatedAt } = data;
  const company = site.company;
  const year = generatedAt.getUTCFullYear();

  return (
    <Document
      title={`Worker representative briefing — ${site.name}`}
      author="Statura Labs Dynamics"
      subject={`Worker representative briefing for the Statura Labs Dynamics deployment at ${site.name}`}
    >
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.headerRow}>
          <View style={styles.brandRow}>
            <BrandMark size={28} />
            <Text style={styles.brandWordmark}>STATURA LABS DYNAMICS</Text>
          </View>
          <Text style={styles.metaText}>
            Generated {formatDate(generatedAt)}
          </Text>
        </View>

        <View style={styles.divider} />

        <Text style={styles.title}>Worker representative briefing</Text>
        <Text style={styles.subtitle}>
          {site.name} · {company.name}
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What this system is</Text>
          <Text style={styles.sectionText}>
            Statura Labs Dynamics is a camera-based ergonomic assessment tool.
            It evaluates the physical demands of a workstation or task design —
            posture, repetition, and load — against published ergonomics
            standards (ISO 11228, EN 1005). It does not evaluate, monitor, or
            score the performance or behaviour of any individual worker.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What is captured</Text>
          <Text style={styles.sectionText}>
            When an operator explicitly starts a capture, a camera briefly views
            the workstation while the task is performed. Body-joint positions
            are estimated from that view using pose-estimation software running
            on-device. This deployment captures data only when an operator
            manually triggers it — never continuously and never without a
            deliberate action.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What is not stored</Text>
          <Text style={styles.sectionText}>
            Video frames are never saved to disk or transmitted anywhere, even
            temporarily. Only anonymous joint-angle coordinates are used, for
            the moments it takes to compute a score. The system does not perform
            facial recognition, does not identify individuals, and does not
            track the same person across separate capture sessions. Every stored
            record is tied to the workstation and task being assessed — never to
            a named worker.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What the output is used for</Text>
          <Text style={styles.sectionText}>
            Each capture produces a set of joint-angle risk scores for a
            workstation, based on versioned, published scoring thresholds. These
            scores are always reviewed by a qualified person (an EHS manager or
            ergonomist) before any action is taken — the system never triggers
            an automated consequence on its own.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legal positioning</Text>
          <Text style={styles.sectionText}>
            Statura Labs Dynamics was designed from the development phase to
            meet the relevant requirements of the EU AI Act and the GDPR. Final
            regulatory classification will be confirmed by a formal legal
            opinion before commercial launch. Full technical documentation is
            available on request.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About this document</Text>
          <Text style={styles.sectionText}>
            This briefing supports your employer's information and consultation
            obligations toward worker representatives ahead of deploying this
            system — it is a starting point for that conversation, not a
            substitute for it. Depending on your country, deploying this system
            may still require formal consultation with, or agreement from, a
            works council or equivalent body (for example a Betriebsrat in
            Germany or Austria, an Ondernemingsraad in the Netherlands, or a CSE
            in France), independent of what data the system stores or doesn't
            store. This document does not constitute legal advice.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Questions about this deployment
          </Text>
          <Text style={styles.sectionText}>contact@verumsell.com</Text>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerCopyright}>© {year} Verumsell SRL</Text>
          <Text style={styles.footerDisclaimer}>
            This document describes the Statura Labs Dynamics product in general
            terms; specific deployment configuration may vary by site. Not a
            substitute for a formal legal opinion or the worker-representative
            consultation procedure required in your jurisdiction.
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
