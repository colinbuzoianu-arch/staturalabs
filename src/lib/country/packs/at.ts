import type { CountryPack } from "./types";

// Terminology and legal references checked against RIS (ris.bka.gv.at)
// and arbeitsinspektion.gv.at per
// SLD_IMPLEMENTATION_PLAN_austria-first.md §2(a) and §4.1 — that section's
// terminology list is not optional flavour, read it before editing this
// file. AT is the flagship market this whole plan is built around, so
// this is the one fully populated pack; DE/CH (packs/de.ts, packs/ch.ts)
// are deliberately unverified stubs until their own legal frameworks are
// checked the same way.
export const at: CountryPack = {
  code: "at",
  countryCode: "AT",
  defaultLocale: "de",
  verified: true,
  terminology: {
    evaluationProcess: "Evaluierung",
    assessmentDocument: "Sicherheits- und Gesundheitsschutzdokument (SGD)",
    enforcementAuthority: "Arbeitsinspektion",
    insuranceBody: "AUVA",
    workerRepRole: "Sicherheitsvertrauensperson (SVP)",
  },
  legalReferences: {
    oshFramework: "ASchG (ArbeitnehmerInnenschutzgesetz), DOK-VO",
    dataProtectionFramework: "DSGVO (GDPR)",
  },
  // B5 (SLD_IMPLEMENTATION_PLAN_austria-first.md §7): the DOK-VO-shaped
  // template variant for AT, rendered by src/lib/report/SgdDocument.tsx.
  // Non-null here is what gates the SGD routes/UI links to AT-sited
  // resources only — DE/CH stay null until their own SGD-equivalent
  // (Dokumentation der Gefährdungsbeurteilung / no direct Swiss analogue)
  // is separately built and reviewed.
  sgdTemplateVariant: "dok-vo-v1",
  // E4 (§6): the Austrian Abfallwirtschaftskonzept. Reference checked
  // against RIS (ris.bka.gv.at) — §10 AWG 2002, Fassung 16.02.2011, BGBl. I
  // Nr. 9/2011 — per SLD_AWK_RESEARCH_awg2002.md and founder confirmation.
  // Non-null awkTemplateVariant gates the AWK routes/UI links to AT sites
  // only; DE/CH stay null (no verified environmental frame yet).
  environmental: {
    awkTemplateVariant: "awg2002-v1",
    wasteConceptReference: "§10 AWG 2002 (Abfallwirtschaftsgesetz 2002)",
    wasteConceptReferenceUrl:
      "https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=20002086&Paragraf=10",
  },
  positioningLine: {
    en: "Built in the vocabulary Austria's Arbeitsinspektion already uses — the Evaluierung, and the Sicherheits- und Gesundheitsschutzdokument (SGD) it belongs in.",
    de: "Aufgebaut in der Sprache, die Ihre Arbeitsinspektion bereits verwendet — die Evaluierung und das Sicherheits- und Gesundheitsschutzdokument (SGD), in das sie gehört.",
    ro: "Construit în terminologia deja folosită de Arbeitsinspektion din Austria — Evaluierung și documentul SGD (Sicherheits- und Gesundheitsschutzdokument) căruia îi aparține.",
  },
};
