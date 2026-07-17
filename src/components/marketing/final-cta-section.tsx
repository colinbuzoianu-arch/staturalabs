import { getMarketingDictionary } from "@/lib/i18n/dictionaries/marketing";
import { getLocale } from "@/lib/i18n/get-locale";
import { PILOT_MAILTO } from "./constants";

export async function FinalCtaSection() {
  const locale = await getLocale();
  const dict = getMarketingDictionary(locale).finalCta;

  return (
    <section id="cta" className="bg-teal">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 py-24">
        {/* Deliberately not styled as an "eyebrow" (uppercase/tracked) —
            spec calls this a distinct "status line," sentence case. */}
        <p className="font-technical text-sm text-coral">{dict.statusLine}</p>
        <h2 className="font-heading text-3xl font-bold text-ivory min-[860px]:text-4xl">
          {dict.heading}
        </h2>
        <a
          href={PILOT_MAILTO}
          className="rounded-md bg-coral px-6 py-3 font-heading font-bold text-teal transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ivory"
        >
          {dict.cta}
        </a>
      </div>
    </section>
  );
}
