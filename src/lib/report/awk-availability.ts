import type { CountryCode } from "@/generated/prisma/enums";
import { countryCodeToMarketingCountry } from "@/lib/country/country-code";
import { getCountryPack } from "@/lib/country/packs";
import type { CountryPack } from "@/lib/country/packs/types";

// The one place that decides "can an Abfallwirtschaftskonzept (AWK) be
// generated for a site in this country" (E4, SLD_IMPLEMENTATION_PLAN_
// hazards-and-environment.md §6) — the exact §3.15 fail-closed discipline
// resolveSgdCountryPack already applies to the SGD. A country qualifies only
// once its pack is verified AND has an environmental config with a real
// awkTemplateVariant — today AT only; DE/CH stay excluded (no verified
// environmental legal frame), RO resolves to no pack at all. Both the route
// handler (which enforces it) and the dashboard (which decides whether to
// render the link) call this.
export function resolveAwkCountryPack(
  country: CountryCode,
): CountryPack | null {
  const marketingCountry = countryCodeToMarketingCountry(country);
  if (!marketingCountry) return null;
  const pack = getCountryPack(marketingCountry);
  if (!pack.verified || !pack.environmental?.awkTemplateVariant) return null;
  return pack;
}
