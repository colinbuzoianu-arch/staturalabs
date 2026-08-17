import type { Metadata } from "next";
import Link from "next/link";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { MARKETING_COUNTRIES } from "@/lib/country/countries";
import { getCountryPack } from "@/lib/country/packs";
import { getMarketingDictionary } from "@/lib/i18n/dictionaries/marketing";
import { getLocale } from "@/lib/i18n/get-locale";

// "/" is a real country-chooser page, never a geo-redirect
// (SLD_IMPLEMENTATION_PLAN_austria-first.md §4.2): redirecting breaks
// crawlers and link sharing, and an Austrian prospect forwarded a /de link
// should land on /de and see German-market framing, not get bounced.
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: getMarketingDictionary(locale).countryChooser.metaTitle,
    // Relative hrefs — resolved against whatever host serves this page,
    // since no metadataBase is configured yet. One de-* alternate per
    // market (all three are German-first by default, see
    // src/lib/country/packs/*.ts `defaultLocale`).
    alternates: {
      languages: {
        "de-AT": "/at",
        "de-DE": "/de",
        "de-CH": "/ch",
      },
    },
  };
}

export default async function CountryChooserPage() {
  const locale = await getLocale();
  const dict = getMarketingDictionary(locale).countryChooser;

  return (
    <>
      <MarketingHeader />
      <main className="bg-ivory">
        <div className="mx-auto max-w-3xl px-6 py-24">
          <p className="font-technical text-xs uppercase tracking-[0.2em] text-coral">
            {dict.eyebrow}
          </p>
          <h1 className="mt-4 font-heading text-3xl font-bold text-teal min-[860px]:text-4xl">
            {dict.h1}
          </h1>
          <p className="mt-6 text-base text-teal/80">{dict.lede}</p>

          <div className="mt-12 flex flex-col gap-4">
            {MARKETING_COUNTRIES.map((country) => {
              const pack = getCountryPack(country);
              return (
                <Link
                  key={country}
                  href={`/${country}`}
                  className="flex items-center justify-between rounded-lg border border-sage-dark/40 px-6 py-4 transition-colors hover:border-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral"
                >
                  <span className="font-heading text-lg font-bold text-teal">
                    {dict.countryLabels[country]}
                  </span>
                  <span className="font-technical text-xs uppercase tracking-[0.1em] text-teal/60">
                    {pack.verified
                      ? dict.statusAvailable
                      : dict.statusInPreparation}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </main>
      <MarketingFooter />
    </>
  );
}
