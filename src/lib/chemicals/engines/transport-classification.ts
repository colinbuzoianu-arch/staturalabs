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

// ILLUSTRATIVE fixture — NOT the official ADR list. Load a licensed/curated list
// before any real use. Kept tiny on purpose (the engine is what matters).
export const TRANSPORT_FIXTURE_LIST: UnEntry[] = [
  {
    unNumber: "UN1090",
    properShippingName: "ACETONE",
    transportClass: "3",
    packingGroup: "II",
    labels: ["3"],
    specialProvisions: [],
    tunnelCode: "D/E",
    limitedQuantity: "1 L",
    exceptedQuantity: "E2",
  },
];

function normalizeUn(un: string): string {
  const t = un.trim().toUpperCase().replace(/\s+/g, "");
  return t.startsWith("UN") ? t : `UN${t}`;
}

export function lookupUnEntry(
  unNumber: string,
  list: UnEntry[] = TRANSPORT_FIXTURE_LIST,
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
