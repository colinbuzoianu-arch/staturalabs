import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { BrandMark } from "./brand-mark";

// P17 §4: Unterweisungsnachweis / Teilnahmeliste — the attendance proof for a
// training session. People-compartment data (names appear by statutory
// necessity, as instruction proof). German, same @react-pdf pattern as the
// other generated documents. No assessment-chain data, no health data.

export type TrainingAttendanceData = {
  title: string;
  date: string; // ISO yyyy-mm-dd
  instructor: string;
  location: string | null;
  status: string;
  companyName: string;
  participants: Array<{
    name: string;
    attended: boolean;
    signed: boolean;
  }>;
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#fbf9f4",
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#1b2a2a",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    borderBottom: "2 solid #0f766e",
    paddingBottom: 8,
  },
  h1: { fontSize: 18, fontFamily: "Helvetica-Bold", color: "#0f766e" },
  meta: { marginTop: 4, fontSize: 9, color: "#374151" },
  section: { marginTop: 10 },
  row: {
    flexDirection: "row",
    borderBottom: "1 solid #d6d3cb",
    paddingVertical: 4,
  },
  th: {
    flexDirection: "row",
    borderBottom: "1.5 solid #0f766e",
    paddingVertical: 4,
    fontFamily: "Helvetica-Bold",
  },
  cName: { width: "60%" },
  cAtt: { width: "20%" },
  cSig: { width: "20%" },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 7,
    color: "#6b7280",
    borderTop: "1 solid #d6d3cb",
    paddingTop: 6,
  },
});

export function TrainingAttendanceDocument({
  data,
}: {
  data: TrainingAttendanceData;
}) {
  return (
    <Document title={`Unterweisungsnachweis — ${data.title}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.h1}>Unterweisungsnachweis</Text>
            <Text style={styles.meta}>{data.companyName}</Text>
            <Text style={styles.meta}>Thema: {data.title}</Text>
            <Text style={styles.meta}>
              Datum: {data.date}
              {data.location ? `  ·  Ort: ${data.location}` : ""}
            </Text>
            <Text style={styles.meta}>
              Unterweisende Person: {data.instructor}
            </Text>
          </View>
          <BrandMark />
        </View>

        <View style={styles.section}>
          <View style={styles.th}>
            <Text style={styles.cName}>Teilnehmer/in</Text>
            <Text style={styles.cAtt}>Teilgenommen</Text>
            <Text style={styles.cSig}>Unterschrift</Text>
          </View>
          {data.participants.map((p) => (
            <View style={styles.row} key={p.name} wrap={false}>
              <Text style={styles.cName}>{p.name}</Text>
              <Text style={styles.cAtt}>{p.attended ? "Ja" : "Nein"}</Text>
              <Text style={styles.cSig}>{p.signed ? "✓" : ""}</Text>
            </View>
          ))}
          {data.participants.length === 0 && (
            <Text style={styles.meta}>Keine Teilnehmenden erfasst.</Text>
          )}
        </View>

        <Text style={styles.footer} fixed>
          Dieser Nachweis dokumentiert die Teilnahme an der oben genannten
          Unterweisung. Erstellt mit Statura Labs Dynamics. © Verumsell SRL.
        </Text>
      </Page>
    </Document>
  );
}
