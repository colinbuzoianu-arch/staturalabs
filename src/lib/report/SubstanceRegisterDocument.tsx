import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { BrandMark } from "./brand-mark";
import type { SubstanceRegisterData } from "./get-substance-register-data";

// P8 §3.3 substance register — German, country-gated. DE: statutory
// Gefahrstoffverzeichnis (§6 Abs. 12). AT: Arbeitsstoffliste as part of the
// evaluation (NOT a stand-alone statutory register — the header says so).
const COLOR = {
  teal: "#0E3733",
  ivory: "#F2ECE1",
  grey: "#555",
  border: "#C9C0B0",
  white: "#FFFFFF",
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: COLOR.ivory,
    padding: 32,
    paddingBottom: 56,
    fontFamily: "Helvetica",
    fontSize: 8.5,
    color: COLOR.teal,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: COLOR.teal,
    paddingBottom: 6,
    marginBottom: 6,
  },
  title: { fontFamily: "Helvetica-Bold", fontSize: 13 },
  meta: { fontSize: 8, color: COLOR.grey },
  subnote: { fontSize: 8, color: COLOR.grey, marginBottom: 8 },
  tr: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: COLOR.border,
    paddingVertical: 3,
  },
  th: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLOR.teal,
    paddingBottom: 3,
    fontFamily: "Helvetica-Bold",
  },
  cName: { width: "26%", paddingRight: 4 },
  cClass: { width: "22%", paddingRight: 4 },
  cQty: { width: "12%", paddingRight: 4 },
  cArea: { width: "26%", paddingRight: 4 },
  cSds: { width: "14%" },
  sectionTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    marginTop: 12,
    marginBottom: 2,
  },
  empty: { fontSize: 9, color: COLOR.grey, marginTop: 6 },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 32,
    right: 32,
    fontSize: 7.5,
    color: COLOR.grey,
    borderTopWidth: 1,
    borderTopColor: COLOR.border,
    paddingTop: 5,
  },
});

export function SubstanceRegisterDocument({
  data,
}: {
  data: SubstanceRegisterData;
}) {
  const title = data.isStatutoryRegister
    ? "Gefahrstoffverzeichnis"
    : "Arbeitsstoffliste";
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.meta}>
              {data.companyName} · {data.siteName} ·{" "}
              {new Date().toISOString().slice(0, 10)}
            </Text>
          </View>
          <BrandMark />
        </View>
        {!data.isStatutoryRegister && (
          <Text style={styles.subnote}>
            Arbeitsstoffliste als Bestandteil der Arbeitsplatzevaluierung (kein
            eigenständiges gesetzlich vorgeschriebenes Verzeichnis).
          </Text>
        )}

        <View style={styles.th}>
          <Text style={styles.cName}>Bezeichnung</Text>
          <Text style={styles.cClass}>Einstufung</Text>
          <Text style={styles.cQty}>Menge/Jahr</Text>
          <Text style={styles.cArea}>Arbeitsbereiche</Text>
          <Text style={styles.cSds}>SDB</Text>
        </View>
        {data.rows.length === 0 ? (
          <Text style={styles.empty}>Keine Gefahrstoffe in Verwendung.</Text>
        ) : (
          data.rows.map((r) => (
            <View style={styles.tr} key={r.tradeName}>
              <Text style={styles.cName}>{r.tradeName}</Text>
              <Text style={styles.cClass}>{r.classification}</Text>
              <Text style={styles.cQty}>{r.quantityClass}</Text>
              <Text style={styles.cArea}>{r.workAreas}</Text>
              <Text style={styles.cSds}>{r.sdsRef}</Text>
            </View>
          ))
        )}

        {data.excludedLowHazard.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              Anhang: Stoffe mit geringer Gefährdung (ausgenommen, § 6 Abs. 13)
            </Text>
            {data.excludedLowHazard.map((e) => (
              <Text style={styles.meta} key={e.tradeName}>
                {e.tradeName}
                {e.rationale ? ` — ${e.rationale}` : ""}
              </Text>
            ))}
          </>
        )}

        <Text style={styles.footer} fixed>
          {data.legalReferenceCode
            ? `Rechtsgrundlage: ${data.legalReferenceCode}. `
            : ""}
          Erzeugt mit Statura Labs Dynamics.
        </Text>
      </Page>
    </Document>
  );
}
