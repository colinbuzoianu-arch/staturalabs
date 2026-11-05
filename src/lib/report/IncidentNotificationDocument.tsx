import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { IncidentNotificationData } from "./get-incident-notification-data";

// P10d §D.4: the pre-filled data sheet for a statutory accident notification
// (AUVA Unfallmeldung / DE Unfallanzeige). German, same palette/type system as
// the SGD/AWK. Explicitly a DATA SHEET to support the notification — NOT a
// look-alike of the authority's own form (stated on the page). Country-gated
// to a verified pack (AT/DE) by the route before this renders. Reads only the
// coarse injury classification, never the encrypted free-text medical fields.
const COLOR = {
  teal: "#0E3733",
  ivory: "#F2ECE1",
  coral: "#E35C3A",
  sageDark: "#568076",
  white: "#FFFFFF",
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: COLOR.ivory,
    padding: 36,
    paddingBottom: 56,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: COLOR.teal,
  },
  title: { fontFamily: "Helvetica-Bold", fontSize: 17, marginBottom: 2 },
  subtitle: { fontSize: 10, color: COLOR.sageDark, marginBottom: 2 },
  divider: {
    borderBottomWidth: 1.5,
    borderBottomColor: COLOR.coral,
    marginVertical: 10,
  },
  sectionTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    marginTop: 12,
    marginBottom: 4,
  },
  row: { flexDirection: "row", marginBottom: 2 },
  label: { width: 150, color: COLOR.sageDark },
  value: { flex: 1 },
  deadlineBox: {
    backgroundColor: COLOR.white,
    borderLeftWidth: 3,
    borderLeftColor: COLOR.coral,
    padding: 8,
    marginVertical: 6,
  },
  deadlineText: { fontFamily: "Helvetica-Bold", fontSize: 12 },
  note: {
    fontSize: 8,
    color: COLOR.sageDark,
    marginTop: 4,
  },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 36,
    right: 36,
    fontSize: 7,
    color: COLOR.sageDark,
    borderTopWidth: 0.5,
    borderTopColor: COLOR.sageDark,
    paddingTop: 6,
  },
});

const TYPE_DE: Record<string, string> = {
  ARBEITSUNFALL: "Arbeitsunfall",
  WEGEUNFALL: "Wegunfall",
  BERUFSKRANKHEIT_VERDACHT: "Berufskrankheit-Verdacht",
  BEINAHEUNFALL: "Beinaheunfall",
  ERSTE_HILFE: "Erste-Hilfe-Fall",
  BRAND: "Brand",
  SACHSCHADEN: "Sachschaden",
  UMWELTEREIGNIS: "Umweltereignis / Leckage",
  FAHRZEUGEREIGNIS: "Fahrzeugereignis",
  SECURITY_VORFALL: "Security-Vorfall",
  GEWALT_UEBERGRIFF: "Gewalt / Übergriff",
  BEHOERDE_BEANSTANDUNG: "Behördenbesuch / Beanstandung",
  SONSTIGES: "Sonstiges",
};
const ROLE_DE: Record<string, string> = {
  INJURED: "verletzt",
  WITNESS: "Zeuge/Zeugin",
  FIRST_AIDER: "Ersthelfer/in",
  OTHER: "sonstige",
};
const INJURY_DE: Record<string, string> = {
  WOUND_LACERATION: "Wunde/Schnitt",
  BRUISE_CONTUSION: "Prellung/Quetschung",
  FRACTURE: "Knochenbruch",
  DISLOCATION_SPRAIN_STRAIN: "Verrenkung/Verstauchung",
  AMPUTATION: "Amputation",
  CONCUSSION_INTERNAL_INJURY: "Gehirnerschütterung/innere Verletzung",
  BURN_SCALD_FROSTBITE: "Verbrennung/Erfrierung",
  POISONING_INFECTION: "Vergiftung/Infektion",
  ASPHYXIA_DROWNING: "Erstickung/Ertrinken",
  EFFECT_OF_NOISE_VIBRATION: "Lärm/Vibration",
  EFFECT_OF_TEMPERATURE_RADIATION: "Temperatur/Strahlung",
  SHOCK: "Schock",
  MULTIPLE_INJURIES: "Mehrfachverletzungen",
  OTHER: "Sonstige",
  UNKNOWN: "Unbekannt",
};
const REGION_DE: Record<string, string> = {
  HEAD: "Kopf",
  NECK: "Hals",
  TORSO_BACK: "Rumpf/Rücken",
  SHOULDER_ARM: "Schulter/Arm",
  HAND_FINGER: "Hand/Finger",
  HIP_LEG: "Hüfte/Bein",
  FOOT_TOE: "Fuß/Zehe",
  INTERNAL: "Innere Organe",
  MULTIPLE: "Mehrere",
  OTHER: "Sonstige",
  UNKNOWN: "Unbekannt",
};

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dutyLine(duty: IncidentNotificationData["duty"]): string {
  switch (duty.duty.kind) {
    case "deadline":
      return `Frist: bis ${fmt(duty.duty.dueAt)} (${duty.duty.durationDays} Tage)`;
    case "immediate":
      return "Frist: sofort / unverzüglich";
    case "asSoonAsPossible":
      return "Frist: so rasch wie möglich";
    default:
      return "Keine Meldepflicht hinterlegt";
  }
}

export function IncidentNotificationDocument({
  data,
}: {
  data: IncidentNotificationData;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Datenblatt für die Unfallmeldung</Text>
        <Text style={styles.subtitle}>
          Vorbereitete Angaben zur gesetzlichen Meldung — kein amtliches
          Formular
        </Text>
        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>1. Betrieb / Arbeitsstätte</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Unternehmen</Text>
          <Text style={styles.value}>{data.company.name}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Arbeitsstätte</Text>
          <Text style={styles.value}>
            {data.site.name}
            {data.site.address ? `, ${data.site.address}` : ""} (
            {data.site.country})
          </Text>
        </View>

        <Text style={styles.sectionTitle}>2. Ereignis</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Art</Text>
          <Text style={styles.value}>
            {TYPE_DE[data.incident.type] ?? data.incident.type}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Zeitpunkt</Text>
          <Text style={styles.value}>{fmt(data.incident.occurredAt)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Ort</Text>
          <Text style={styles.value}>{data.incident.locationText ?? "—"}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Beschreibung</Text>
          <Text style={styles.value}>{data.incident.description}</Text>
        </View>

        <Text style={styles.sectionTitle}>3. Meldepflicht</Text>
        <View style={styles.deadlineBox}>
          <Text style={styles.deadlineText}>{dutyLine(data.duty)}</Text>
          {data.duty.clockStartsText ? (
            <Text style={styles.note}>
              Fristbeginn: {data.duty.clockStartsText}
            </Text>
          ) : null}
          {data.duty.thresholdText ? (
            <Text style={styles.note}>Schwelle: {data.duty.thresholdText}</Text>
          ) : null}
          {data.duty.legalReference ? (
            <Text style={styles.note}>
              Rechtsgrundlage: {data.duty.legalReference.code} —{" "}
              {data.duty.legalReference.obligation}
            </Text>
          ) : null}
          {data.duty.worksCouncilCoSign ? (
            <Text style={styles.note}>
              Die Unfallanzeige ist vom Betriebs-/Personalrat mitzuzeichnen (§
              193 Abs. 5 SGB VII).
            </Text>
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>4. Beteiligte Personen</Text>
        {data.involved.length === 0 ? (
          <Text style={styles.value}>Keine beteiligten Personen erfasst.</Text>
        ) : (
          data.involved.map((p) => (
            <View key={`${p.lastName}-${p.firstName}`} style={styles.row}>
              <Text style={styles.label}>
                {p.lastName}, {p.firstName}
              </Text>
              <Text style={styles.value}>
                {ROLE_DE[p.role] ?? p.role}
                {p.injuryType ? ` · ${INJURY_DE[p.injuryType]}` : ""}
                {p.bodyRegion ? ` · ${REGION_DE[p.bodyRegion]}` : ""}
                {p.incapacityDays !== null
                  ? ` · ${p.incapacityDays} Tage AU`
                  : ""}
                {p.fatal ? " · tödlich" : ""}
              </Text>
            </View>
          ))
        )}

        <Text style={styles.sectionTitle}>5. Meldung</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Status</Text>
          <Text style={styles.value}>
            {data.submission?.status === "SUBMITTED"
              ? `gemeldet am ${data.submission.submittedAt ? fmt(data.submission.submittedAt) : "—"}${
                  data.submission.referenceNumber
                    ? `, Aktenzeichen ${data.submission.referenceNumber}`
                    : ""
                }`
              : data.submission?.status === "WAIVED"
                ? "als nicht meldepflichtig vermerkt"
                : "offen"}
          </Text>
        </View>

        <Text style={styles.footer} fixed>
          Statura Labs Dynamics — vorbereitetes Datenblatt zur Unterstützung der
          gesetzlichen Unfallmeldung. Dies ist kein amtliches Meldeformular; die
          Meldung erfolgt über den zuständigen Unfallversicherungsträger (z. B.
          AUVA / Berufsgenossenschaft) in dessen Verfahren.
        </Text>
      </Page>
    </Document>
  );
}
