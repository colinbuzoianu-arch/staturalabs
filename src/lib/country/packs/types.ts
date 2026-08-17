import type { CountryCode } from "@/generated/prisma/enums";
import type { Locale } from "@/lib/i18n/locale";
import type { MarketingCountry } from "../countries";

// Which market-specific words this pack uses for concepts the product
// already has generic names for — SLD_IMPLEMENTATION_PLAN_austria-first.md
// §4.1's table. Using the German words from one market in another reads as
// a vendor who didn't do the homework, which is precisely the objection
// this exists to avoid.
export interface CountryPackTerminology {
  /** The employer's own periodic risk/ergonomic evaluation process. */
  evaluationProcess: string;
  /** The document the evaluation's results must be recorded in. */
  assessmentDocument: string;
  /** The public authority that inspects/enforces workplace OSH law here. */
  enforcementAuthority: string;
  /** The statutory accident-insurance / OSH-prevention body. */
  insuranceBody: string;
  /** The on-site worker safety-representative role. */
  workerRepRole: string;
}

export interface CountryPackLegalReferences {
  /** The primary OSH statute/framework for this jurisdiction. */
  oshFramework: string;
  /** The data-protection framework that governs this market's privacy copy. */
  dataProtectionFramework: string;
}

export interface CountryPack {
  code: MarketingCountry;
  /** The Site.country enum value this pack corresponds to. */
  countryCode: CountryCode;
  /**
   * Locale set on first visit to this country's routes, only if no locale
   * cookie exists yet (§4.2) — an explicit language choice always wins,
   * this never overwrites one.
   */
  defaultLocale: Locale;
  /**
   * Whether this pack's terminology/legal references have been checked
   * against a primary source (RIS / arbeitsinspektion.gv.at for AT, this
   * market's own equivalent otherwise) and are safe to present as real
   * content. false means the marketing route for this country ships as
   * positioning-only, with an honest "in Vorbereitung"-style placeholder
   * instead of the fields below being rendered
   * (ERGO_COMPLIANCE_BY_DESIGN.md §5 — an unverified legal claim is worse
   * than an empty page). Do not flip this to true without that
   * verification having actually happened.
   */
  verified: boolean;
  terminology: CountryPackTerminology;
  legalReferences: CountryPackLegalReferences;
  /**
   * The DOK-VO-shaped SGD template variant name this market's generated
   * document should use (SLD_IMPLEMENTATION_PLAN_austria-first.md §7 B5).
   * null until B5 actually builds the generator — no market has one yet.
   */
  sgdTemplateVariant: string | null;
  /**
   * One honest, terminology-forward sentence per UI locale, shown on this
   * country's homepage when verified. Only rendered when `verified` is
   * true — see CountryContextSection.
   */
  positioningLine: Record<Locale, string>;
}
