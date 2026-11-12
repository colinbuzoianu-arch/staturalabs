import type { Metadata } from "next";
import { Eyebrow } from "@/components/marketing/eyebrow";
import { getMarketingDictionary } from "@/lib/i18n/dictionaries/marketing";
import { getLocale } from "@/lib/i18n/get-locale";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getMarketingDictionary(await getLocale()).legal.metaTitle };
}

export default async function LegalPage() {
  const dict = getMarketingDictionary(await getLocale()).legal;
  const sections = [
    dict.thisWebsite,
    dict.dataHandling,
    dict.terms,
    dict.company,
  ];

  return (
    <div className="bg-ivory">
      <div className="mx-auto max-w-3xl px-6 py-24">
        <h1 className="font-heading text-3xl font-bold text-teal min-[860px]:text-4xl">
          {dict.h1}
        </h1>

        <div className="mt-10 flex flex-col gap-10">
          {sections.map((s) => (
            <section key={s.heading}>
              <Eyebrow>{s.heading}</Eyebrow>
              <p className="mt-3 text-base text-teal/80">{s.paragraph}</p>
            </section>
          ))}

          <section>
            <Eyebrow>{dict.contact.heading}</Eyebrow>
            <p className="mt-3 text-base text-teal/80">
              {dict.contact.prefix}{" "}
              <a
                href="mailto:contact@verumsell.com"
                className="text-coral hover:underline"
              >
                contact@verumsell.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
