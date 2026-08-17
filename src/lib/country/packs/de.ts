import type { CountryPack } from "./types";

// Stub — SLD_IMPLEMENTATION_PLAN_austria-first.md §4.2/§7 B1: /de ships
// with the same shell as /at but no legally-verified German-market
// content yet. The terminology/legalReferences values below are drawn
// from §4.1's AT-vs-DE comparison table, not independently checked
// against a German primary source — do not wire them into legal-facing
// copy or flip `verified` to true without doing that verification first.
export const de: CountryPack = {
  code: "de",
  countryCode: "DE",
  defaultLocale: "de",
  verified: false,
  terminology: {
    evaluationProcess: "Gefährdungsbeurteilung",
    assessmentDocument: "Dokumentation der Gefährdungsbeurteilung",
    enforcementAuthority: "Gewerbeaufsicht / Amt für Arbeitsschutz",
    insuranceBody: "Berufsgenossenschaft",
    workerRepRole: "Sicherheitsbeauftragter",
  },
  legalReferences: {
    oshFramework: "ArbSchG (Arbeitsschutzgesetz) — not yet verified",
    dataProtectionFramework: "DSGVO (GDPR)",
  },
  sgdTemplateVariant: null,
  // Not shown until `verified` is true — see CountryContextSection.
  positioningLine: { en: "", de: "", ro: "" },
};
