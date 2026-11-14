import {
  BERECHNUNGSVORSCHLAG_DE,
  type PreparedResult,
  prepared,
} from "./prepared";

// P15 §3 `transport.classification` (PREPARED, flag OFF). A data model for UN
// dangerous-goods entries + a lookup. Per §3, NO official dangerous-goods list is
// imported (ADR has no official machine-readable list; IMDG/IATA are licensed) —
// the model is "ready to load a licensed or curated list", and ships with a small
// ILLUSTRATIVE fixture only. Classification→UN derivation needs the official ADR
// criteria (regulatory thresholds) and is NOT implemented from recollection
// (§0.7/§7) — see CHEMISTRY_ENGINE_NOTES. Result is a Berechnungsvorschlag.

export type UnEntry = {
  unNumber: string;
  properShippingName: string;
  transportClass: string;
  packingGroup?: string | null;
  labels: string[];
  specialProvisions: string[];
  tunnelCode?: string | null;
  limitedQuantity?: string | null;
  exceptedQuantity?: string | null;
};

// Curated DEMO_LIST (P16 §3.3). The investigation found NO official UNECE
// machine-readable ADR Table A under open reuse terms (UNECE publishes PDF under
// UN copyright; third-party CSVs are licensed/unclear — DATA_SOURCES_AND_LICENSES).
// So this is a small curated demo list for the prospect sandbox — **NOT
// ADR-verified and not authoritative.** It is used in both environments; a UN
// number outside it resolves to the honest "Gefahrgutliste nicht geladen" gap. It
// must be replaced by a licensed/official list before any real transport use.
export const TRANSPORT_LIST_IS_DEMO = true;

export const TRANSPORT_DEMO_LIST: UnEntry[] = [
  {
    unNumber: "UN1090",
    properShippingName: "ACETONE",
    transportClass: "3",
    packingGroup: "II",
    labels: ["3"],
    specialProvisions: [],
    tunnelCode: "D/E",
  },
  {
    unNumber: "UN1170",
    properShippingName: "ETHANOL",
    transportClass: "3",
    packingGroup: "II",
    labels: ["3"],
    specialProvisions: [],
    tunnelCode: "D/E",
  },
  {
    unNumber: "UN1219",
    properShippingName: "ISOPROPANOL",
    transportClass: "3",
    packingGroup: "II",
    labels: ["3"],
    specialProvisions: [],
    tunnelCode: "D/E",
  },
  {
    unNumber: "UN1307",
    properShippingName: "XYLENES",
    transportClass: "3",
    packingGroup: "III",
    labels: ["3"],
    specialProvisions: [],
    tunnelCode: "D/E",
  },
  {
    unNumber: "UN1294",
    properShippingName: "TOLUENE",
    transportClass: "3",
    packingGroup: "II",
    labels: ["3"],
    specialProvisions: [],
    tunnelCode: "D/E",
  },
];

// Back-compat alias for the P15 name.
export const TRANSPORT_FIXTURE_LIST = TRANSPORT_DEMO_LIST;

function normalizeUn(un: string): string {
  const t = un.trim().toUpperCase().replace(/\s+/g, "");
  return t.startsWith("UN") ? t : `UN${t}`;
}

export function lookupUnEntry(
  unNumber: string,
  list: UnEntry[] = TRANSPORT_DEMO_LIST,
): PreparedResult<UnEntry> {
  const key = normalizeUn(unNumber);
  const hit = list.find((e) => normalizeUn(e.unNumber) === key);
  return hit
    ? prepared(hit, BERECHNUNGSVORSCHLAG_DE)
    : prepared<UnEntry>(
        null,
        BERECHNUNGSVORSCHLAG_DE,
        `no entry for ${key} in the loaded list`,
      );
}
