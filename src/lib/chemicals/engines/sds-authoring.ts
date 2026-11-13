import type { ConfirmedSdsData } from "../sds-extraction-schema";
import {
  BERECHNUNGSVORSCHLAG_DE,
  type PreparedResult,
  prepared,
} from "./prepared";

// P15 §3 `sds.authoring` (PREPARED, flag OFF). A 16-section SDS skeleton per REACH
// Annex II (as amended by 2020/878) + a mapping from the data we already hold +
// a plain-text draft render. NO phrase catalogue (EuPhraC is licensed) — free
// text only (§3). The section STRUCTURE is a fixed REACH Annex II list, not a
// regulatory threshold; sections we cannot fill are left explicitly empty, never
// invented (§0.7/§7). Never offered to a customer while the flag is OFF.

export const SDS_SECTION_TITLES_DE: Record<number, string> = {
  1: "Bezeichnung des Stoffs bzw. Gemischs und des Unternehmens",
  2: "Mögliche Gefahren",
  3: "Zusammensetzung / Angaben zu Bestandteilen",
  4: "Erste-Hilfe-Maßnahmen",
  5: "Maßnahmen zur Brandbekämpfung",
  6: "Maßnahmen bei unbeabsichtigter Freisetzung",
  7: "Handhabung und Lagerung",
  8: "Begrenzung und Überwachung der Exposition / persönliche Schutzausrüstung",
  9: "Physikalische und chemische Eigenschaften",
  10: "Stabilität und Reaktivität",
  11: "Toxikologische Angaben",
  12: "Umweltbezogene Angaben",
  13: "Hinweise zur Entsorgung",
  14: "Angaben zum Transport",
  15: "Rechtsvorschriften",
  16: "Sonstige Angaben",
};

export type SdsAuthoringSection = {
  number: number;
  title: string;
  body: string;
};
export type SdsAuthoringDraft = {
  productName: string;
  sections: SdsAuthoringSection[];
};

function joinNonEmpty(parts: (string | null | undefined)[]): string {
  return parts.filter((p) => p?.trim()).join("\n");
}

// Map the confirmed SDS data we hold into the 16 sections. Sections without
// source data get an explicit "[Keine Daten — zu ergänzen]" placeholder, never
// invented content.
export function mapToSdsDraft(
  productName: string,
  c: ConfirmedSdsData | null,
): SdsAuthoringDraft {
  const EMPTY = "[Keine Daten — zu ergänzen]";
  const body: Record<number, string> = {
    1: joinNonEmpty([
      c?.productIdentifier && `Produkt: ${c.productIdentifier}`,
      c?.supplier && `Lieferant: ${c.supplier}`,
      c?.emergencyPhone && `Notruf: ${c.emergencyPhone}`,
    ]),
    2: joinNonEmpty([
      c?.classification && `Einstufung: ${c.classification}`,
      c?.signalWord && `Signalwort: ${c.signalWord}`,
      c?.pictograms?.length ? `Piktogramme: ${c.pictograms.join(", ")}` : null,
      c?.statementCodes?.length
        ? `H/P/EUH: ${c.statementCodes.join(", ")}`
        : null,
    ]),
    3: c?.components?.length
      ? c.components
          .map((comp) =>
            joinNonEmpty([
              comp.name,
              comp.casNumber && `CAS ${comp.casNumber}`,
              comp.concentration,
              comp.classification,
            ]),
          )
          .join("\n")
      : "",
    4: c?.section4FirstAid ?? "",
    5: c?.section5FireFighting ?? "",
    6: c?.section6AccidentalRelease ?? "",
    7: c?.section7HandlingStorage ?? "",
    8: c?.citedLimits?.length
      ? c.citedLimits
          .map((l) =>
            joinNonEmpty([
              l.substance,
              l.value && `${l.value} ${l.unit ?? ""}`.trim(),
              l.type,
            ]),
          )
          .join("\n")
      : "",
    9: joinNonEmpty([
      c?.physicalState && `Aggregatzustand: ${c.physicalState}`,
      c?.flashPoint && `Flammpunkt: ${c.flashPoint}`,
      c?.boilingPoint && `Siedepunkt: ${c.boilingPoint}`,
      c?.density && `Dichte: ${c.density}`,
      c?.vapourPressure && `Dampfdruck: ${c.vapourPressure}`,
      c?.ph && `pH: ${c.ph}`,
    ]),
    10: "",
    11: "",
    12: joinNonEmpty([c?.wgk && `WGK: ${c.wgk}`]),
    13: c?.section13Disposal ?? "",
    14: joinNonEmpty([
      c?.unNumber && `UN: ${c.unNumber}`,
      c?.properShippingName,
      c?.transportClass && `Klasse: ${c.transportClass}`,
      c?.packingGroup && `VG: ${c.packingGroup}`,
    ]),
    15: joinNonEmpty([
      c?.wgk && `WGK: ${c.wgk}`,
      c?.lagerklasse && `Lagerklasse: ${c.lagerklasse}`,
    ]),
    16: "",
  };
  return {
    productName,
    sections: Array.from({ length: 16 }, (_, i) => i + 1).map((n) => ({
      number: n,
      title: SDS_SECTION_TITLES_DE[n],
      body: body[n]?.trim() ? body[n] : EMPTY,
    })),
  };
}

export function renderSdsDraftText(
  draft: SdsAuthoringDraft,
): PreparedResult<string> {
  const lines = [`SICHERHEITSDATENBLATT (ENTWURF) — ${draft.productName}`, ""];
  for (const s of draft.sections) {
    lines.push(`ABSCHNITT ${s.number}: ${s.title}`, s.body, "");
  }
  return prepared(lines.join("\n"), BERECHNUNGSVORSCHLAG_DE);
}
