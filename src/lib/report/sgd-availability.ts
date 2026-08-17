import type { CountryCode } from "@/generated/prisma/enums";
import { countryCodeToMarketingCountry } from "@/lib/country/country-code";
import { getCountryPack } from "@/lib/country/packs";
import type { CountryPack } from "@/lib/country/packs/types";

// The one place that decides "can an SGD be generated for a site in this
// country" — shared by the route handlers (which must actually enforce it)
// and the read-only dashboard (which must decide whether to render the
// link at all). A country only qualifies once its pack is both verified
// (ERGO_COMPLIANCE_BY_DESIGN.md §5 — an unverified legal claim is worse
// than an absent one) AND has a real sgdTemplateVariant — today that's AT
// only; DE/CH stay excluded even though their packs exist, because no
// DOK-VO-equivalent template has been built or reviewed for them yet.
export function resolveSgdCountryPack(
  country: CountryCode,
): CountryPack | null {
  const marketingCountry = countryCodeToMarketingCountry(country);
  if (!marketingCountry) return null;
  const pack = getCountryPack(marketingCountry);
  if (!pack.verified || !pack.sgdTemplateVariant) return null;
  return pack;
}
