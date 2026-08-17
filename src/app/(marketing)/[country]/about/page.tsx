import type { Metadata } from "next";
import { PILOT_MAILTO } from "@/components/marketing/constants";
import { Eyebrow } from "@/components/marketing/eyebrow";
import { getMarketingDictionary } from "@/lib/i18n/dictionaries/marketing";
import { getLocale } from "@/lib/i18n/get-locale";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: getMarketingDictionary(locale).about.metaTitle };
}

export default async function AboutPage() {
  const locale = await getLocale();
  const dict = getMarketingDictionary(locale).about;

  return (
    <div className="bg-ivory">
      <div className="mx-auto max-w-3xl px-6 py-24">
        <Eyebrow>{dict.eyebrow}</Eyebrow>
        <h1 className="mt-4 font-heading text-3xl font-bold text-teal min-[860px]:text-4xl">
          {dict.h1}
        </h1>

        <div className="mt-8 flex flex-col gap-5 text-base text-teal/80">
          {dict.paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>

        <div className="mt-16 flex flex-col gap-12">
          <section>
            <Eyebrow>{dict.grounded.eyebrow}</Eyebrow>
            <p className="mt-4 text-base text-teal/80">
              {dict.grounded.paragraph}
            </p>
          </section>

          <section>
            <Eyebrow>{dict.whereWeAreNow.eyebrow}</Eyebrow>
            <p className="mt-4 text-base text-teal/80">
              {dict.whereWeAreNow.paragraph}
            </p>
          </section>
        </div>

        <a
          href={PILOT_MAILTO}
          className="mt-16 inline-block rounded-md bg-coral px-6 py-3 font-heading font-bold text-teal transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral"
        >
          {dict.cta}
        </a>
      </div>
    </div>
  );
}
