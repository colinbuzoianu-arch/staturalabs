// P15 S2: the typed shape of an AI SDS extraction draft. Pure (no server-only) —
// unit-tested and shared by the extraction engine (server) and the review form
// (client). Every extracted field carries its EVIDENCE (page number + the text
// snippet it came from), per §2 S2: the user accepts/edits/rejects field by
// field, so the UI must always be able to show where a value came from. The
// model is instructed to return null for anything not on the page and NEVER to
// fill a value from its own knowledge (§0.7/§7); `normalizeSdsExtraction` coerces
// whatever the model returns into this shape, defaulting anything missing or
// malformed to null rather than guessing.

export type Evidence = { page: number | null; snippet: string | null };
export type Field<T> = {
  value: T | null;
  page: number | null;
  snippet: string | null;
};

export type SdsComponentDraft = {
  name: Field<string>;
  casNumber: Field<string>;
  ecNumber: Field<string>;
  concentration: Field<string>;
  classification: Field<string>;
  specificConcentrationLimits: Field<string>;
  mFactor: Field<string>;
  acuteToxicityEstimate: Field<string>;
};

export type SdsCitedLimitDraft = {
  substance: Field<string>;
  value: Field<string>;
  unit: Field<string>;
  type: Field<string>;
};

export type SdsExtractionResult = {
  // Section 1
  productIdentifier: Field<string>;
  ufi: Field<string>;
  supplier: Field<string>;
  emergencyPhone: Field<string>;
  // Header
  revisionDate: Field<string>;
  version: Field<string>;
  language: Field<string>;
  // Section 2
  classification: Field<string>;
  signalWord: Field<string>;
  pictograms: Field<string[]>;
  statementCodes: Field<string[]>;
  // Section 3
  components: SdsComponentDraft[];
  // Section 8
  citedLimits: SdsCitedLimitDraft[];
  // Section 9
  flashPoint: Field<string>;
  boilingPoint: Field<string>;
  density: Field<string>;
  vapourPressure: Field<string>;
  ph: Field<string>;
  physicalState: Field<string>;
  // Section 14
  unNumber: Field<string>;
  properShippingName: Field<string>;
  transportClass: Field<string>;
  packingGroup: Field<string>;
  adrRid: Field<string>;
  imdg: Field<string>;
  iata: Field<string>;
  marinePollutant: Field<string>;
  // Section 15
  wgk: Field<string>;
  lagerklasse: Field<string>;
  // Legacy (read-only, never computed/shown on new docs — §0.4)
  rPhrases: Field<string[]>;
  sPhrases: Field<string[]>;
};

const SCALAR_FIELDS = [
  "productIdentifier",
  "ufi",
  "supplier",
  "emergencyPhone",
  "revisionDate",
  "version",
  "language",
  "classification",
  "signalWord",
  "flashPoint",
  "boilingPoint",
  "density",
  "vapourPressure",
  "ph",
  "physicalState",
  "unNumber",
  "properShippingName",
  "transportClass",
  "packingGroup",
  "adrRid",
  "imdg",
  "iata",
  "marinePollutant",
  "wgk",
  "lagerklasse",
] as const;

const STRING_ARRAY_FIELDS = [
  "pictograms",
  "statementCodes",
  "rPhrases",
  "sPhrases",
] as const;

const COMPONENT_FIELDS = [
  "name",
  "casNumber",
  "ecNumber",
  "concentration",
  "classification",
  "specificConcentrationLimits",
  "mFactor",
  "acuteToxicityEstimate",
] as const;

const LIMIT_FIELDS = ["substance", "value", "unit", "type"] as const;

function asPage(x: unknown): number | null {
  const n = typeof x === "number" ? x : typeof x === "string" ? Number(x) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function asSnippet(x: unknown): string | null {
  return typeof x === "string" && x.trim() ? x.trim() : null;
}

function scalarField(raw: unknown): Field<string> {
  const o = (raw ?? {}) as Record<string, unknown>;
  const v = o.value;
  return {
    value:
      typeof v === "string" && v.trim()
        ? v.trim()
        : typeof v === "number"
          ? String(v)
          : null,
    page: asPage(o.page),
    snippet: asSnippet(o.snippet),
  };
}

function arrayField(raw: unknown): Field<string[]> {
  const o = (raw ?? {}) as Record<string, unknown>;
  const v = o.value;
  const arr = Array.isArray(v)
    ? v
        .map((x) => (typeof x === "string" ? x.trim() : String(x)))
        .filter((x) => x.length > 0)
    : null;
  return {
    value: arr?.length ? arr : null,
    page: asPage(o.page),
    snippet: asSnippet(o.snippet),
  };
}

const emptyField = (): Field<string> => ({
  value: null,
  page: null,
  snippet: null,
});
const emptyArrayField = (): Field<string[]> => ({
  value: null,
  page: null,
  snippet: null,
});

// Coerce an arbitrary parsed object (the model's JSON output) into the typed
// result, never throwing and never inventing a value. Unknown keys are dropped;
// missing/malformed fields become null.
export function normalizeSdsExtraction(raw: unknown): SdsExtractionResult {
  const o = (raw ?? {}) as Record<string, unknown>;
  const out = {} as SdsExtractionResult;

  for (const key of SCALAR_FIELDS) {
    (out as unknown as Record<string, Field<string>>)[key] = scalarField(
      o[key],
    );
  }
  for (const key of STRING_ARRAY_FIELDS) {
    (out as unknown as Record<string, Field<string[]>>)[key] = arrayField(
      o[key],
    );
  }

  const rawComponents = Array.isArray(o.components) ? o.components : [];
  out.components = rawComponents.slice(0, 200).map((c) => {
    const co = (c ?? {}) as Record<string, unknown>;
    const comp = {} as SdsComponentDraft;
    for (const f of COMPONENT_FIELDS) {
      (comp as unknown as Record<string, Field<string>>)[f] = scalarField(
        co[f],
      );
    }
    return comp;
  });

  const rawLimits = Array.isArray(o.citedLimits) ? o.citedLimits : [];
  out.citedLimits = rawLimits.slice(0, 200).map((l) => {
    const lo = (l ?? {}) as Record<string, unknown>;
    const lim = {} as SdsCitedLimitDraft;
    for (const f of LIMIT_FIELDS) {
      (lim as unknown as Record<string, Field<string>>)[f] = scalarField(lo[f]);
    }
    return lim;
  });

  return out;
}

export function emptySdsExtraction(): SdsExtractionResult {
  const raw: Record<string, unknown> = {};
  for (const key of SCALAR_FIELDS) raw[key] = emptyField();
  for (const key of STRING_ARRAY_FIELDS) raw[key] = emptyArrayField();
  raw.components = [];
  raw.citedLimits = [];
  return raw as unknown as SdsExtractionResult;
}

// A compact, human-readable description of the JSON shape the model must return,
// embedded in the extraction prompt. Keeping it here (next to the type) keeps the
// prompt and the parser in lockstep.
export const SDS_EXTRACTION_JSON_SHAPE = `{
  // Every field is { "value": <string|null>, "page": <number|null>, "snippet": <string|null> }.
  // "value" null when the field is not present in the SDS. "page" = 1-based PDF page; "snippet" = the exact text it came from.
  // Array-valued fields (pictograms, statementCodes, rPhrases, sPhrases) use "value": [<string>, ...] or null.
  "productIdentifier": {}, "ufi": {}, "supplier": {}, "emergencyPhone": {},
  "revisionDate": {}, "version": {}, "language": {},
  "classification": {}, "signalWord": {}, "pictograms": {}, "statementCodes": {},
  "components": [ { "name": {}, "casNumber": {}, "ecNumber": {}, "concentration": {}, "classification": {}, "specificConcentrationLimits": {}, "mFactor": {}, "acuteToxicityEstimate": {} } ],
  "citedLimits": [ { "substance": {}, "value": {}, "unit": {}, "type": {} } ],
  "flashPoint": {}, "boilingPoint": {}, "density": {}, "vapourPressure": {}, "ph": {}, "physicalState": {},
  "unNumber": {}, "properShippingName": {}, "transportClass": {}, "packingGroup": {}, "adrRid": {}, "imdg": {}, "iata": {}, "marinePollutant": {},
  "wgk": {}, "lagerklasse": {},
  "rPhrases": {}, "sPhrases": {}
}`;

export class SdsExtractionParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SdsExtractionParseError";
  }
}

// Parse the model's text response into a typed result. Pure, unit-tested.
// Strips a ```json … ``` fence if present, then JSON.parses and normalizes.
// Throws SdsExtractionParseError on non-JSON (the caller stores a FAILED record
// rather than a half-parsed draft) — never returns a guessed shape.
export function parseSdsExtractionResponse(text: string): SdsExtractionResult {
  let t = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(t);
  if (fence) t = fence[1].trim();
  // Fall back to the first {...} block if the model added prose around it.
  if (!t.startsWith("{")) {
    const first = t.indexOf("{");
    const last = t.lastIndexOf("}");
    if (first >= 0 && last > first) t = t.slice(first, last + 1);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(t);
  } catch {
    throw new SdsExtractionParseError("model response was not valid JSON");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new SdsExtractionParseError("model response was not a JSON object");
  }
  return normalizeSdsExtraction(parsed);
}

// ----- Confirmed payload (S2b): the accepted values, evidence stripped -----
export type ConfirmedSdsComponent = {
  name: string | null;
  casNumber: string | null;
  ecNumber: string | null;
  concentration: string | null;
  classification: string | null;
  specificConcentrationLimits: string | null;
  mFactor: string | null;
  acuteToxicityEstimate: string | null;
};

export type ConfirmedSdsCitedLimit = {
  substance: string | null;
  value: string | null;
  unit: string | null;
  type: string | null;
};

export type ConfirmedSdsData = {
  productIdentifier: string | null;
  ufi: string | null;
  supplier: string | null;
  emergencyPhone: string | null;
  revisionDate: string | null;
  version: string | null;
  language: string | null;
  classification: string | null;
  signalWord: string | null;
  pictograms: string[];
  statementCodes: string[];
  components: ConfirmedSdsComponent[];
  citedLimits: ConfirmedSdsCitedLimit[];
  flashPoint: string | null;
  boilingPoint: string | null;
  density: string | null;
  vapourPressure: string | null;
  ph: string | null;
  physicalState: string | null;
  unNumber: string | null;
  properShippingName: string | null;
  transportClass: string | null;
  packingGroup: string | null;
  adrRid: string | null;
  imdg: string | null;
  iata: string | null;
  marinePollutant: string | null;
  wgk: string | null;
  lagerklasse: string | null;
  rPhrases: string[];
  sPhrases: string[];
};

// Strip evidence from a (reviewed) extraction result into the confirmed values.
export function buildConfirmedPayload(
  r: SdsExtractionResult,
): ConfirmedSdsData {
  const s = (f: Field<string>) => f?.value ?? null;
  const a = (f: Field<string[]>) => f?.value ?? [];
  return {
    productIdentifier: s(r.productIdentifier),
    ufi: s(r.ufi),
    supplier: s(r.supplier),
    emergencyPhone: s(r.emergencyPhone),
    revisionDate: s(r.revisionDate),
    version: s(r.version),
    language: s(r.language),
    classification: s(r.classification),
    signalWord: s(r.signalWord),
    pictograms: a(r.pictograms),
    statementCodes: a(r.statementCodes),
    components: r.components.map((c) => ({
      name: s(c.name),
      casNumber: s(c.casNumber),
      ecNumber: s(c.ecNumber),
      concentration: s(c.concentration),
      classification: s(c.classification),
      specificConcentrationLimits: s(c.specificConcentrationLimits),
      mFactor: s(c.mFactor),
      acuteToxicityEstimate: s(c.acuteToxicityEstimate),
    })),
    citedLimits: r.citedLimits.map((l) => ({
      substance: s(l.substance),
      value: s(l.value),
      unit: s(l.unit),
      type: s(l.type),
    })),
    flashPoint: s(r.flashPoint),
    boilingPoint: s(r.boilingPoint),
    density: s(r.density),
    vapourPressure: s(r.vapourPressure),
    ph: s(r.ph),
    physicalState: s(r.physicalState),
    unNumber: s(r.unNumber),
    properShippingName: s(r.properShippingName),
    transportClass: s(r.transportClass),
    packingGroup: s(r.packingGroup),
    adrRid: s(r.adrRid),
    imdg: s(r.imdg),
    iata: s(r.iata),
    marinePollutant: s(r.marinePollutant),
    wgk: s(r.wgk),
    lagerklasse: s(r.lagerklasse),
    rPhrases: a(r.rPhrases),
    sPhrases: a(r.sPhrases),
  };
}
