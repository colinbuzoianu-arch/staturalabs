import type { Metadata } from "next";
import { PILOT_MAILTO } from "@/components/marketing/constants";
import { Eyebrow } from "@/components/marketing/eyebrow";
import { getMarketingDictionary } from "@/lib/i18n/dictionaries/marketing";
import { getLocale } from "@/lib/i18n/get-locale";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getMarketingDictionary(await getLocale()).about.metaTitle };
}

export default async function AboutPage() {
  const dict = getMarketingDictionary(await getLocale()).about;

  return (
    <div className="bg-ivory">
      <div className="mx-auto max-w-3xl px-5 py-16 min-[860px]:px-6 min-[860px]:py-24">
        <Eyebrow>{dict.eyebrow}</Eyebrow>
        <h1 className="mt-4 font-heading text-3xl font-bold text-teal min-[860px]:text-4xl">
          {dict.h1}
        </h1>

        <div className="mt-8 flex flex-col gap-5 text-base text-teal/80">
          {dict.paragraphs.map((p) => (
            <p key={p.slice(0, 24)}>{p}</p>
          ))}
        </div>

        <div className="mt-14">
          <Eyebrow>{dict.whereWeAreNow.eyebrow}</Eyebrow>
          <p className="mt-4 text-base text-teal/80">
            {dict.whereWeAreNow.paragraph}
          </p>
        </div>

        <a
          href={PILOT_MAILTO}
          className="mt-10 inline-block rounded-md bg-coral px-6 py-3 font-heading text-sm font-bold text-teal transition-opacity hover:opacity-90"
        >
          {dict.cta}
        </a>
      </div>
    </div>
  );
}
