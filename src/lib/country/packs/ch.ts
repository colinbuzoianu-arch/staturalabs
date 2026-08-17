import type { CountryPack } from "./types";

// Stub — SLD_IMPLEMENTATION_PLAN_austria-first.md §4.2/§7 B1 and
// ERGO_COMPLIANCE_BY_DESIGN.md §5: Swiss OSH sits under a materially
// different legal framework (ArG/UVG with SUVA/SECO, revDSG rather than
// GDPR) that has not been verified against a primary source (the SUVA
// Grenzwert-Liste in particular). Ships as a positioning-only page — see
// the unverified branch of CountryContextSection — until that
// verification happens and `verified` flips to true.
export const ch: CountryPack = {
  code: "ch",
  countryCode: "CH",
  defaultLocale: "de",
  verified: false,
  terminology: {
    evaluationProcess: "Risikobeurteilung",
    assessmentDocument:
      "not yet verified — Swiss documentation shape unreviewed",
    enforcementAuthority: "SUVA / SECO",
    insuranceBody: "SUVA",
    workerRepRole: "not yet verified",
  },
  legalReferences: {
    oshFramework: "ArG / UVG — not yet verified",
    dataProtectionFramework: "revDSG — not yet verified",
  },
  sgdTemplateVariant: null,
  positioningLine: { en: "", de: "", ro: "" },
};
