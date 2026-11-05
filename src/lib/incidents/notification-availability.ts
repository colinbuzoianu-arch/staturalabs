import type { CountryCode } from "@/generated/prisma/enums";
import { countryCodeToMarketingCountry } from "@/lib/country/country-code";
import { getCountryPack } from "@/lib/country/packs";
import type { CountryPack } from "@/lib/country/packs/types";

// P10d: the one place that decides "can statutory notification support render
// for a site in this country" — the §3.15 fail-closed discipline that
// resolveSgdCountryPack / resolveAwkCountryPack already apply. A country
// qualifies only when its pack is verified — AT and DE today; CH stays
// positioning-only (verified:false) so its seeded rules never render on a live
// CH site; RO resolves to no pack at all. Both the UI (whether to show the
// duty/export) and the export route (which enforces it) call this.
export function resolveNotificationCountryPack(
  country: CountryCode,
): CountryPack | null {
  const marketingCountry = countryCodeToMarketingCountry(country);
  if (!marketingCountry) return null;
  const pack = getCountryPack(marketingCountry);
  if (!pack.verified) return null;
  return pack;
}
