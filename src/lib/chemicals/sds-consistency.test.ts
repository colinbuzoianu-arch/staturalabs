import { describe, expect, it } from "vitest";
import { checkSdsConsistency, type SdsHintCode } from "./sds-consistency";
import {
  buildConfirmedPayload,
  emptySdsExtraction,
} from "./sds-extraction-schema";

const now = new Date("2026-11-13");
function c(over: Record<string, unknown> = {}) {
  return { ...buildConfirmedPayload(emptySdsExtraction()), ...over };
}
function run(
  over: Record<string, unknown>,
  opts: Partial<{ siteRequiresDe: boolean; staleYears: number }> = {},
): SdsHintCode[] {
  return checkSdsConsistency(c(over), {
    siteRequiresDe: opts.siteRequiresDe ?? true,
    now,
    staleYears: opts.staleYears ?? 3,
  }).map((h) => h.code);
}

describe("checkSdsConsistency", () => {
  it("flags H-codes without a signal word", () => {
    expect(run({ statementCodes: ["H225"], signalWord: null })).toContain(
      "missing-signal-word",
    );
  });
  it("does not flag when signal word is present", () => {
    expect(
      run({
        statementCodes: ["H225"],
        signalWord: "Gefahr",
        pictograms: ["GHS02"],
      }),
    ).not.toContain("missing-signal-word");
  });
  it("flags GHS02 without a flammable H-code", () => {
    expect(
      run({
        pictograms: ["GHS02"],
        statementCodes: ["H319"],
        signalWord: "Achtung",
      }),
    ).toContain("flammable-pictogram-no-h");
  });
  it("flags a flammable H-code without GHS02", () => {
    expect(run({ statementCodes: ["H225"], signalWord: "Gefahr" })).toContain(
      "flammable-h-no-pictogram",
    );
  });
  it("flags a marine-pollutant flag with no aquatic H-code", () => {
    expect(
      run({
        marinePollutant: "ja",
        statementCodes: ["H225"],
        signalWord: "Gefahr",
        pictograms: ["GHS02"],
      }),
    ).toContain("aquatic-flag-no-h");
  });
  it("flags an aquatic H-code with the marine flag negative", () => {
    expect(
      run({
        statementCodes: ["H410"],
        signalWord: "Achtung",
        pictograms: ["GHS09"],
        marinePollutant: "nein",
      }),
    ).toContain("aquatic-h-no-flag");
  });
  it("does not flag aquatic when both agree", () => {
    const codes = run({
      statementCodes: ["H410"],
      signalWord: "Achtung",
      pictograms: ["GHS09"],
      marinePollutant: "ja",
    });
    expect(codes).not.toContain("aquatic-flag-no-h");
    expect(codes).not.toContain("aquatic-h-no-flag");
  });
  it("flags a non-German SDS for a DE-requiring site", () => {
    expect(
      run({
        language: "en",
        statementCodes: ["H225"],
        signalWord: "Gefahr",
        pictograms: ["GHS02"],
      }),
    ).toContain("not-german");
  });
  it("does not flag an English SDS when the site does not require German", () => {
    expect(run({ language: "en" }, { siteRequiresDe: false })).not.toContain(
      "not-german",
    );
  });
  it("flags a stale revision", () => {
    expect(run({ revisionDate: "01.01.2020" }, { staleYears: 3 })).toContain(
      "stale-revision",
    );
  });
  it("does not flag a recent revision", () => {
    expect(
      run({ revisionDate: "01.06.2026" }, { staleYears: 3 }),
    ).not.toContain("stale-revision");
  });
  it("flags a hazardous SDS with no components", () => {
    expect(
      run({
        statementCodes: ["H225"],
        signalWord: "Gefahr",
        pictograms: ["GHS02"],
      }),
    ).toContain("no-components");
  });
  it("is quiet on a clean, coherent SDS", () => {
    const codes = run({
      statementCodes: ["H225", "H319"],
      signalWord: "Gefahr",
      pictograms: ["GHS02", "GHS07"],
      language: "de",
      revisionDate: "01.06.2026",
      components: [
        {
          name: "Aceton",
          casNumber: "67-64-1",
          ecNumber: null,
          concentration: "99%",
          classification: null,
          specificConcentrationLimits: null,
          mFactor: null,
          acuteToxicityEstimate: null,
        },
      ],
    });
    expect(codes).toEqual([]);
  });
});
