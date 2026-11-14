import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { SdsAuthoringDraft } from "@/lib/chemicals/engines/sds-authoring";

// P16 §4 slice 5: the watermarked 16-section SDS DRAFT preview (sds.authoring
// engine, flag OFF by default). Every page carries "ENTWURF — NICHT ZUR
// WEITERGABE". Never an authoritative SDS; free text only (no phrase catalogue).

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: "Helvetica", color: "#1a1a1a" },
  title: { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  sub: { fontSize: 8, color: "#666", marginBottom: 10 },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginTop: 8,
    marginBottom: 2,
  },
  body: { fontSize: 9, lineHeight: 1.3 },
  watermark: {
    position: "absolute",
    top: 320,
    left: 60,
    fontSize: 40,
    color: "#d9534f",
    opacity: 0.18,
    transform: "rotate(-30deg)",
    fontFamily: "Helvetica-Bold",
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 36,
    right: 36,
    fontSize: 7,
    color: "#999",
    textAlign: "center",
  },
});

const WATERMARK = "ENTWURF — NICHT ZUR WEITERGABE";

export function SdsDraftDocument({ draft }: { draft: SdsAuthoringDraft }) {
  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.watermark} fixed>
          {WATERMARK}
        </Text>
        <Text style={styles.title}>Sicherheitsdatenblatt (Entwurf)</Text>
        <Text style={styles.sub}>
          {draft.productName} · Vorschau-Entwurf, nicht fachlich geprüft, nicht
          zur Weitergabe
        </Text>
        {draft.sections.map((s) => (
          <View key={s.number} wrap={false}>
            <Text style={styles.sectionTitle}>
              ABSCHNITT {s.number}: {s.title}
            </Text>
            <Text style={styles.body}>{s.body}</Text>
          </View>
        ))}
        <Text style={styles.footer} fixed>
          {WATERMARK} · Berechnungslogik als Prüfhilfe; fachliche Validierung in
          Vorbereitung.
        </Text>
      </Page>
    </Document>
  );
}
