import { describe, expect, it } from "vitest";
import {
  emptySdsExtraction,
  normalizeSdsExtraction,
  parseSdsExtractionResponse,
  SdsExtractionParseError,
} from "./sds-extraction-schema";

describe("normalizeSdsExtraction", () => {
  it("coerces a well-formed payload and keeps evidence", () => {
    const r = normalizeSdsExtraction({
      productIdentifier: {
        value: "Aceton",
        page: 1,
        snippet: "1.1 Produktidentifikator: Aceton",
      },
      statementCodes: {
        value: ["H225", "H319", "H336"],
        page: 2,
        snippet: "H225 H319 H336",
      },
      components: [
        { casNumber: { value: "67-64-1", page: 3, snippet: "67-64-1" } },
      ],
      citedLimits: [
        {
          substance: { value: "Aceton" },
          value: { value: "1200" },
          unit: { value: "mg/m³" },
          type: { value: "AGW" },
        },
      ],
    });
    expect(r.productIdentifier.value).toBe("Aceton");
    expect(r.productIdentifier.page).toBe(1);
    expect(r.statementCodes.value).toEqual(["H225", "H319", "H336"]);
    expect(r.components[0].casNumber.value).toBe("67-64-1");
    expect(r.citedLimits[0].unit.value).toBe("mg/m³");
    // untouched fields default to null, never guessed
    expect(r.supplier.value).toBeNull();
    expect(r.wgk.value).toBeNull();
  });
  it("defaults missing/malformed fields to null and never throws", () => {
    const r = normalizeSdsExtraction({
      productIdentifier: "not an object",
      pictograms: { value: "nope" },
      components: "x",
    });
    expect(r.productIdentifier.value).toBeNull();
    expect(r.pictograms.value).toBeNull();
    expect(r.components).toEqual([]);
  });
  it("handles null / undefined input", () => {
    expect(normalizeSdsExtraction(null).supplier.value).toBeNull();
    expect(normalizeSdsExtraction(undefined).components).toEqual([]);
  });
  it("rejects a non-positive page number", () => {
    const r = normalizeSdsExtraction({ supplier: { value: "X", page: -3 } });
    expect(r.supplier.page).toBeNull();
  });
});

describe("emptySdsExtraction", () => {
  it("has every scalar/array field null and empty arrays", () => {
    const e = emptySdsExtraction();
    expect(e.productIdentifier.value).toBeNull();
    expect(e.rPhrases.value).toBeNull();
    expect(e.components).toEqual([]);
    expect(e.citedLimits).toEqual([]);
  });
});

describe("parseSdsExtractionResponse", () => {
  it("parses a bare JSON object", () => {
    const r = parseSdsExtractionResponse(
      '{"supplier":{"value":"ACME","page":1,"snippet":"ACME"}}',
    );
    expect(r.supplier.value).toBe("ACME");
  });
  it("strips a ```json fence", () => {
    const r = parseSdsExtractionResponse(
      '```json\n{"version":{"value":"2.1"}}\n```',
    );
    expect(r.version.value).toBe("2.1");
  });
  it("recovers a JSON object from surrounding prose", () => {
    const r = parseSdsExtractionResponse(
      'Here is the data: {"ph":{"value":"7"}} done.',
    );
    expect(r.ph.value).toBe("7");
  });
  it("throws on non-JSON", () => {
    expect(() => parseSdsExtractionResponse("sorry, I cannot")).toThrow(
      SdsExtractionParseError,
    );
  });
  it("throws on a JSON array (not an object)", () => {
    expect(() => parseSdsExtractionResponse("[1,2,3]")).toThrow(
      SdsExtractionParseError,
    );
  });
});
