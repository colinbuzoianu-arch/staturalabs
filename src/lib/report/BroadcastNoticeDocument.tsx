import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { BrandMark } from "./brand-mark";

// The notice-board version of a safety information: A4, German, built to be
// printed and pinned up where people without an account (or without a phone in
// their hand) will read it. Same @react-pdf pattern as every other generated
// document here.
//
// It carries the title, the publication date, the SENDER'S ROLE (not their
// private details — a notice says "EHS-Fachkraft", not a home address), the
// site, and the message text. Deliberately NO recipient list: a notice board is
// a public surface, and who has confirmed is internal proof, not an aushang.

export type BroadcastNoticeData = {
  title: string;
  bodyText: string;
  publishedAt: string | null; // ISO yyyy-mm-dd
  priorityLabel: string;
  domainLabel: string;
  senderRoleLabel: string;
  companyName: string;
  siteName: string;
  confirmationDueAt: string | null;
  requiresConfirmation: boolean;
  isSafetyAlert: boolean;
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#fbf9f4",
    padding: 48,
    fontSize: 12,
    fontFamily: "Helvetica",
    color: "#1b2a2a",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
    borderBottom: "2 solid #0f766e",
    paddingBottom: 10,
  },
  kicker: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 2,
    color: "#0f766e",
  },
  kickerAlert: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 2,
    color: "#c2410c",
  },
  h1: { fontSize: 24, fontFamily: "Helvetica-Bold", marginTop: 6 },
  meta: { marginTop: 8, fontSize: 10, color: "#374151" },
  body: { marginTop: 24, fontSize: 13, lineHeight: 1.5 },
  confirmBox: {
    marginTop: 28,
    padding: 12,
    border: "1.5 solid #0f766e",
  },
  confirmTitle: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  confirmText: { marginTop: 4, fontSize: 10, color: "#374151" },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 48,
    right: 48,
    fontSize: 8,
    color: "#6b7280",
    borderTop: "1 solid #d6d3cb",
    paddingTop: 6,
  },
});

export function BroadcastNoticeDocument({
  data,
}: {
  data: BroadcastNoticeData;
}) {
  return (
    <Document title={data.title}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text
              style={data.isSafetyAlert ? styles.kickerAlert : styles.kicker}
            >
              {data.priorityLabel.toUpperCase()}
            </Text>
            <Text style={styles.h1}>{data.title}</Text>
            <Text style={styles.meta}>
              {`${data.companyName} · ${data.siteName}`}
            </Text>
            <Text style={styles.meta}>
              {`Veröffentlicht: ${data.publishedAt ?? "—"} · Bereich: ${data.domainLabel} · Absender: ${data.senderRoleLabel}`}
            </Text>
          </View>
          <BrandMark />
        </View>

        <Text style={styles.body}>{data.bodyText}</Text>

        {data.requiresConfirmation && (
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>
              Gelesen und verstanden — Bestätigung erforderlich
            </Text>
            <Text style={styles.confirmText}>
              {data.confirmationDueAt
                ? `Bitte bis ${data.confirmationDueAt} in der App bestätigen. Wer keinen Zugang hat, bestätigt bei der Führungskraft.`
                : "Bitte in der App bestätigen. Wer keinen Zugang hat, bestätigt bei der Führungskraft."}
            </Text>
          </View>
        )}

        <Text style={styles.footer} fixed>
          Aushang zur Sicherheitsinformation · Statura Labs Dynamics. Dieser
          Aushang enthält keine personenbezogenen Daten; die Bestätigungen
          werden in der Anwendung geführt.
        </Text>
      </Page>
    </Document>
  );
}
