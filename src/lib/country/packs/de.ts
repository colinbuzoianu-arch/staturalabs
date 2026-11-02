import type { CountryPack } from "./types";

// Germany — verified (P3, SLD_P3_LEGAL_CATALOGUE_APPROVED.md, founder-approved
// 2026-11-02 via delegated desk research against gesetze-im-internet.de). The
// risk-module legal references are seeded in the `v1-dach-2026`
// LegalReference catalogue; the terminology below is the de-DE market
// vocabulary from §4.1/§4.3. `verified: true` turns on the DE hub terminology
// (resolveCountryTerm) and the DE statutory document (Dokumentation der
// Gefährdungsbeurteilung, §§5–6 ArbSchG). DE environmental law is NOT verified
// yet, so `environmental` stays null.
export const de: CountryPack = {
  code: "de",
  countryCode: "DE",
  defaultLocale: "de",
  verified: true,
  terminology: {
    evaluationProcess: "Gefährdungsbeurteilung",
    assessmentDocument: "Dokumentation der Gefährdungsbeurteilung",
    enforcementAuthority: "Gewerbeaufsicht / Amt für Arbeitsschutz",
    insuranceBody: "Berufsgenossenschaft",
    workerRepRole: "Sicherheitsbeauftragter",
  },
  legalReferences: {
    oshFramework: "ArbSchG (Arbeitsschutzgesetz) §§5–6, DGUV Vorschrift 1 / 2",
    dataProtectionFramework: "DSGVO (GDPR), BDSG",
  },
  // P3: the DE statutory-document variant rendered by SgdDocument.tsx /
  // sgd-framing.ts — "Dokumentation der Gefährdungsbeurteilung (§§5–6
  // ArbSchG)". Non-null + verified is what turns DE SGD generation on
  // (resolveSgdCountryPack); CH stays null.
  sgdTemplateVariant: "gbu-doc-de-v1",
  environmental: null,
  positioningLine: {
    en: "Built in the vocabulary German labour inspectorates already use — the Gefährdungsbeurteilung and its documentation under §§5–6 ArbSchG.",
    de: "Aufgebaut in der Sprache, die deutsche Arbeitsschutzbehörden bereits verwenden — die Gefährdungsbeurteilung und ihre Dokumentation nach §§5–6 ArbSchG.",
    ro: "Construit în terminologia deja folosită de autoritățile germane de protecția muncii — Gefährdungsbeurteilung și documentarea ei conform §§5–6 ArbSchG.",
  },
};
