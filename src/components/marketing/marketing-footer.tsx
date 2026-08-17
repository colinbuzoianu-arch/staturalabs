import Link from "next/link";
import type { MarketingCountry } from "@/lib/country/countries";
import { getMarketingDictionary } from "@/lib/i18n/dictionaries/marketing";
import { getLocale } from "@/lib/i18n/get-locale";

// `country` scopes the About/Legal links to the current market
// (/at/about vs. /de/about, etc.) — defaults to "at" for the one caller
// with no country in scope (the top-level country-chooser page), matching
// "the existing /, /about, /legal content becomes /at/* first"
// (SLD_IMPLEMENTATION_PLAN_austria-first.md §4.2).
export async function MarketingFooter({
  country = "at",
}: {
  country?: MarketingCountry;
}) {
  const year = new Date().getFullYear();
  const locale = await getLocale();
  const dict = getMarketingDictionary(locale);

  return (
    <footer className="bg-teal">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 py-8 text-center min-[860px]:flex-row min-[860px]:items-center min-[860px]:justify-between min-[860px]:text-left">
        <div className="flex flex-col items-center gap-4 min-[860px]:flex-row min-[860px]:items-center min-[860px]:gap-6">
          {/* Logotype mark only, not prose — see CLAUDE.md brand rules. */}
          <span className="font-wordmark text-sm tracking-[0.2em] text-ivory">
            SLD
          </span>
          <nav className="flex gap-5 text-xs text-sage-light">
            <Link href={`/${country}/about`} className="hover:text-ivory">
              {dict.footer.about}
            </Link>
            <Link href={`/${country}/legal`} className="hover:text-ivory">
              {dict.footer.legal}
            </Link>
          </nav>
        </div>
        <p className="text-xs text-sage-light">{dict.footer.copyright(year)}</p>
      </div>
    </footer>
  );
}
