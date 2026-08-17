import type { CountryCode } from "@/generated/prisma/enums";
import type { MarketingCountry } from "./countries";

// The one place that bridges the lowercase marketing-URL segment ("at")
// and the uppercase Site.country enum value ("AT") — everything else
// should import from here rather than re-deriving the mapping (e.g.
// `.toUpperCase()`), so the two only ever drift in one spot if a market's
// naming ever needs to diverge.
export const MARKETING_COUNTRY_TO_COUNTRY_CODE: Record<
  MarketingCountry,
  CountryCode
> = {
  at: "AT",
  de: "DE",
  ch: "CH",
};

// The reverse direction — Site.country (e.g. for a report generator that
// needs this site's country pack) back to the lowercase marketing-country
// key packs/index.ts is keyed by. Partial: RO has no marketing country (no
// public-facing market yet), so a Site.country of RO correctly resolves to
// undefined rather than a guessed pack.
const COUNTRY_CODE_TO_MARKETING_COUNTRY: Partial<
  Record<CountryCode, MarketingCountry>
> = {
  AT: "at",
  DE: "de",
  CH: "ch",
};

export function countryCodeToMarketingCountry(
  country: CountryCode,
): MarketingCountry | undefined {
  return COUNTRY_CODE_TO_MARKETING_COUNTRY[country];
}
