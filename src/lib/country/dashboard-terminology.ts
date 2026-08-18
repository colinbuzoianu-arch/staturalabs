import type { CountryCode } from "@/generated/prisma/enums";
import type { Locale } from "@/lib/i18n/locale";
import { countryCodeToMarketingCountry } from "./country-code";
import { getCountryPack } from "./packs";
import type { CountryPackTerminology } from "./packs/types";

// B8c item 8 (SLD_NEXT_STEPS_B8b-B8f.md): "where the dashboard currently
// says 'Risk assessment'/'Gefährdungsbeurteilung,' the AT path should say
// 'Evaluierung'" — the country pack's own terminology (already used on
// the /at marketing page via CountryContextSection) wasn't being consumed
// anywhere in the authenticated dashboard before this.
//
// Deliberately German-only: a CountryPackTerminology value (Evaluierung,
// SGD, Arbeitsinspektion, ...) is itself German-language legal vocabulary
// for one specific market, not a translation source with en/ro forms —
// substituting it into an English or Romanian sentence wouldn't read as
// the correct legal term, just as a stray foreign word. So this only ever
// returns non-null when locale is "de", and only for a country whose pack
// is verified (unverified packs, per ERGO_COMPLIANCE_BY_DESIGN.md §5, are
// exactly the ones this app must not present as settled terminology).
// Callers fall back to their existing locale-dictionary term when this
// returns null — same "explicit gap over silent guess" precedent as B4's
// exposure-limit lookup and B5's SGD country gate, not a TODO to fill in
// for every country later.
export function resolveCountryTerm(
  key: keyof CountryPackTerminology,
  country: CountryCode,
  locale: Locale,
): string | null {
  if (locale !== "de") return null;
  const marketingCountry = countryCodeToMarketingCountry(country);
  if (!marketingCountry) return null;
  const pack = getCountryPack(marketingCountry);
  if (!pack.verified) return null;
  return pack.terminology[key];
}
