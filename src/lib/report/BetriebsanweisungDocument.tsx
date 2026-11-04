import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { BrandMark } from "./brand-mark";
import type { BetriebsanweisungData } from "./get-betriebsanweisung-data";

// P8 §3.2 Betriebsanweisung — German only, orange-framed (common convention),
// one page. Same @react-pdf approach as the other generators.
const COLOR = {
  teal: "#0E3733",
  ivory: "#F2ECE1",
  orange: "#C7641E",
  grey: "#555",
  white: "#FFFFFF",
};

const PICTO_DE: Record<string, string> = {
  GHS01: "Explodierende Bombe",
  GHS02: "Flamme",
  GHS03: "Flamme über Kreis",
  GHS04: "Gasflasche",
  GHS05: "Ätzwirkung",
  GHS06: "Totenkopf",
  GHS07: "Ausrufezeichen",
  GHS08: "Gesundheitsgefahr",
  GHS09: "Umwelt",
};
const SIGNAL_DE: Record<string, string> = {
  GEFAHR: "Gefahr",
  ACHTUNG: "Achtung",
  NONE: "—",
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: COLOR.white,
    padding: 28,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: COLOR.teal,
  },
  frame: { borderWidth: 3, borderColor: COLOR.orange, padding: 14 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: COLOR.orange,
    paddingBottom: 6,
    marginBottom: 8,
  },
  title: { fontFamily: "Helvetica-Bold", fontSize: 14, color: COLOR.orange },
  meta: { fontSize: 8, color: COLOR.grey },
  draft: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: COLOR.orange,
  },
  sectionTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    marginTop: 8,
    marginBottom: 2,
  },
  p: { marginBottom: 2, lineHeight: 1.3 },
  footer: {
    marginTop: 10,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: COLOR.grey,
    fontSize: 7.5,
    color: COLOR.grey,
  },
});

function cmrLine(d: BetriebsanweisungData): string | null {
  const parts: string[] = [];
  if (d.substance.carcinogenicCategory !== "NONE")
    parts.push(`krebserzeugend ${d.substance.carcinogenicCategory}`);
  if (d.substance.mutagenicCategory !== "NONE")
    parts.push(`keimzellmutagen ${d.substance.mutagenicCategory}`);
  if (d.substance.reprotoxicCategory !== "NONE")
    parts.push(`reproduktionstoxisch ${d.substance.reprotoxicCategory}`);
  return parts.length > 0 ? parts.join(", ").replace(/CAT_/g, "Kat. ") : null;
}

export function BetriebsanweisungDocument({
  data,
}: {
  data: BetriebsanweisungData;
}) {
  const cmr = cmrLine(data);
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.frame}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>Betriebsanweisung</Text>
              <Text style={styles.meta}>
                {data.companyName} · {data.siteName} ·{" "}
                {new Date().toISOString().slice(0, 10)}
              </Text>
            </View>
            <BrandMark />
          </View>

          {data.status !== "APPROVED" ? (
            <Text style={styles.draft}>
              ENTWURF — vor Gebrauch durch verantwortliche Person freigeben
            </Text>
          ) : (
            <Text style={styles.meta}>
              Freigegeben
              {data.approvedByName ? ` von ${data.approvedByName}` : ""}
              {data.approvedAt
                ? ` am ${data.approvedAt.toISOString().slice(0, 10)}`
                : ""}
            </Text>
          )}

          <Text style={styles.sectionTitle}>1. Gefahrstoffbezeichnung</Text>
          <Text style={styles.p}>
            {data.substance.tradeName}
            {data.substance.manufacturer
              ? ` (${data.substance.manufacturer})`
              : ""}
          </Text>

          <Text style={styles.sectionTitle}>
            2. Gefahren für Mensch und Umwelt
          </Text>
          <Text style={styles.p}>
            Signalwort: {SIGNAL_DE[data.substance.signalWord] ?? "—"}
          </Text>
          {data.pictograms.length > 0 && (
            <Text style={styles.p}>
              Piktogramme:{" "}
              {data.pictograms
                .map((p) => `${p} (${PICTO_DE[p] ?? p})`)
                .join(", ")}
            </Text>
          )}
          {cmr && <Text style={styles.p}>Besondere Eigenschaften: {cmr}</Text>}
          {data.hStatements.length > 0 && (
            <Text style={styles.p}>
              {data.hStatements
                .map((h) => `${h.code}${h.text ? ` ${h.text}` : ""}`)
                .join("; ")}
            </Text>
          )}

          <Text style={styles.sectionTitle}>
            3. Schutzmaßnahmen und Verhaltensregeln
          </Text>
          <Text style={styles.p}>
            Technische und organisatorische Schutzmaßnahmen vorrangig vor
            persönlicher Schutzausrüstung (STOP-Prinzip). Expositionswege:{" "}
            {[...new Set(data.uses.flatMap((u) => u.exposureRoutes))].join(
              ", ",
            ) || "—"}
            .
          </Text>

          <Text style={styles.sectionTitle}>4. Verhalten im Gefahrfall</Text>
          <Text style={styles.p}>
            Austritt/Brand: Bereich räumen, Zündquellen entfernen, Notruf.
          </Text>

          <Text style={styles.sectionTitle}>5. Erste Hilfe</Text>
          <Text style={styles.p}>
            Nach Expositionsweg handeln; Ersthelfer verständigen.
          </Text>

          <Text style={styles.sectionTitle}>6. Sachgerechte Entsorgung</Text>
          <Text style={styles.p}>
            Entsprechend dem zugeordneten Abfallstrom entsorgen.
          </Text>

          <Text style={styles.footer}>
            {data.currentSdsRevisionDate
              ? `Erstellt auf Grundlage des Sicherheitsdatenblatts vom ${data.currentSdsRevisionDate.toISOString().slice(0, 10)}. `
              : "Kein aktuelles Sicherheitsdatenblatt hinterlegt. "}
            {data.legalReferenceCode
              ? `Rechtsgrundlage: ${data.legalReferenceCode}.`
              : ""}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
