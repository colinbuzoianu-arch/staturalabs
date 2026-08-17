import type { Metadata } from "next";
import { getMarketingDictionary } from "@/lib/i18n/dictionaries/marketing";
import { getLocale } from "@/lib/i18n/get-locale";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: getMarketingDictionary(locale).legal.metaTitle };
}

// Compliance-sensitive content — the English source text is used verbatim
// as specified, not paraphrased; de.ts/ro.ts are careful meaning-based
// translations, not machine-literal ones. Change any of the three only on
// explicit instruction.
export default async function LegalPage() {
  const locale = await getLocale();
  const dict = getMarketingDictionary(locale).legal;

  return (
    <div className="bg-ivory">
      <div className="mx-auto max-w-3xl px-6 py-24">
        <h1 className="font-heading text-3xl font-bold text-teal min-[860px]:text-4xl">
          {dict.h1}
        </h1>

        <div className="mt-12 flex flex-col gap-10">
          <section>
            <h2 className="font-heading text-lg font-bold text-teal">
              {dict.thisWebsite.heading}
            </h2>
            <p className="mt-3 text-base text-teal/80">
              {dict.thisWebsite.paragraph}
            </p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-teal">
              {dict.dataHandling.heading}
            </h2>
            <p className="mt-3 text-base text-teal/80">
              {dict.dataHandling.paragraph}
            </p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-teal">
              {dict.terms.heading}
            </h2>
            <p className="mt-3 text-base text-teal/80">
              {dict.terms.paragraph}
            </p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-teal">
              {dict.company.heading}
            </h2>
            <p className="mt-3 text-base text-teal/80">
              {dict.company.paragraph}
            </p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-teal">
              {dict.contact.heading}
            </h2>
            <p className="mt-3 text-base text-teal/80">
              {dict.contact.prefix}{" "}
              <a href="mailto:contact@verumsell.com" className="underline">
                contact@verumsell.com
              </a>
            </p>
          </section>

          <section>
            <h2 className="font-heading text-lg font-bold text-teal">
              {dict.jurisdictionNotice.heading}
            </h2>
            <p className="mt-3 rounded-md border border-dashed border-teal/30 px-4 py-3 font-technical text-sm text-teal/70">
              {dict.jurisdictionNotice.paragraph}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
