import type { ConfirmedSdsData } from "./sds-extraction-schema";

// P15 S2b: a field-level diff of a new SDS revision against the previous one
// (§2 S2: "show a field-level diff against the previous version — classification
// changed, new component, new H statement"). Pure, unit-tested. Changes are shown
// in the review UI before confirm; a classification/component/H-statement change
// is what makes an existing Betriebsanweisung show "Überprüfung erforderlich"
// (P8, via the SDS revision-date comparison). Never mutates anything.

export type SdsChangeKind = "changed" | "added" | "removed";

export type SdsRevisionChange = {
  field: string;
  kind: SdsChangeKind;
  before: string | null;
  after: string | null;
};

const SCALAR_LABELS: Array<[keyof ConfirmedSdsData, string]> = [
  ["classification", "Einstufung"],
  ["signalWord", "Signalwort"],
  ["wgk", "WGK"],
  ["lagerklasse", "Lagerklasse"],
  ["flashPoint", "Flammpunkt"],
  ["unNumber", "UN-Nummer"],
  ["transportClass", "Transportklasse"],
  ["packingGroup", "Verpackungsgruppe"],
  ["physicalState", "Aggregatzustand"],
  ["supplier", "Lieferant"],
];

function norm(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t.length ? t : null;
}

function diffList(
  field: string,
  before: string[],
  after: string[],
): SdsRevisionChange[] {
  const b = new Set(before.map((x) => x.trim().toUpperCase()).filter(Boolean));
  const a = new Set(after.map((x) => x.trim().toUpperCase()).filter(Boolean));
  const out: SdsRevisionChange[] = [];
  for (const x of a) {
    if (!b.has(x)) out.push({ field, kind: "added", before: null, after: x });
  }
  for (const x of b) {
    if (!a.has(x)) out.push({ field, kind: "removed", before: x, after: null });
  }
  return out;
}

export function diffSdsRevisions(
  prev: ConfirmedSdsData | null,
  next: ConfirmedSdsData,
): SdsRevisionChange[] {
  if (!prev) return []; // first revision of a product — nothing to diff against
  const changes: SdsRevisionChange[] = [];

  for (const [key, label] of SCALAR_LABELS) {
    const before = norm(prev[key] as string | null);
    const after = norm(next[key] as string | null);
    if (before !== after) {
      changes.push({ field: label, kind: "changed", before, after });
    }
  }

  changes.push(
    ...diffList("H/P/EUH", prev.statementCodes, next.statementCodes),
  );
  changes.push(...diffList("Piktogramme", prev.pictograms, next.pictograms));

  // Components keyed by CAS (fall back to name when CAS is absent).
  const key = (c: { casNumber: string | null; name: string | null }) =>
    (norm(c.casNumber) ?? norm(c.name) ?? "").toUpperCase();
  const prevComps = new Map(
    prev.components.map((c) => [key(c), c] as const).filter(([k]) => k),
  );
  const nextComps = new Map(
    next.components.map((c) => [key(c), c] as const).filter(([k]) => k),
  );
  for (const [k, c] of nextComps) {
    if (!prevComps.has(k)) {
      changes.push({
        field: "Komponente",
        kind: "added",
        before: null,
        after: norm(c.name) ?? k,
      });
    }
  }
  for (const [k, c] of prevComps) {
    if (!nextComps.has(k)) {
      changes.push({
        field: "Komponente",
        kind: "removed",
        before: norm(c.name) ?? k,
        after: null,
      });
    }
  }

  return changes;
}
