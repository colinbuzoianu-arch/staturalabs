import { describe, expect, it } from "vitest";
import {
  buildConfirmedPayload,
  emptySdsExtraction,
} from "../sds-extraction-schema";
import {
  mapToSdsDraft,
  renderSdsDraftText,
  SDS_SECTION_TITLES_DE,
} from "./sds-authoring";

describe("mapToSdsDraft", () => {
  it("produces exactly 16 sections with REACH Annex II titles", () => {
    const d = mapToSdsDraft("Test", null);
    expect(d.sections).toHaveLength(16);
    expect(d.sections[0].title).toBe(SDS_SECTION_TITLES_DE[1]);
    expect(d.sections[15].number).toBe(16);
  });
  it("leaves unfilled sections explicitly empty, never invented", () => {
    const d = mapToSdsDraft("Test", null);
    expect(d.sections.every((s) => s.body.includes("zu ergänzen"))).toBe(true);
  });
  it("fills sections from confirmed data", () => {
    const c = {
      ...buildConfirmedPayload(emptySdsExtraction()),
      productIdentifier: "Aceton",
      signalWord: "Gefahr",
      statementCodes: ["H225"],
      section4FirstAid: "Frische Luft.",
    };
    const d = mapToSdsDraft("Aceton", c);
    expect(d.sections[0].body).toContain("Aceton");
    expect(d.sections[1].body).toContain("H225");
    expect(d.sections[3].body).toBe("Frische Luft.");
  });
});

describe("renderSdsDraftText", () => {
  it("renders all 16 ABSCHNITT headers", () => {
    const text = renderSdsDraftText(mapToSdsDraft("X", null)).value ?? "";
    for (let n = 1; n <= 16; n++) expect(text).toContain(`ABSCHNITT ${n}:`);
    expect(text).toContain("ENTWURF");
  });
});
