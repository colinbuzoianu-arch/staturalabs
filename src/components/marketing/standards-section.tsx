import { getMarketingDictionary } from "@/lib/i18n/dictionaries/marketing";
import { getLocale } from "@/lib/i18n/get-locale";
import { Eyebrow } from "./eyebrow";

export async function StandardsSection() {
  const locale = await getLocale();
  const dict = getMarketingDictionary(locale).standards;

  return (
    <section className="bg-ivory">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-6 py-24 min-[860px]:grid-cols-2 min-[860px]:gap-16">
        <div>
          <Eyebrow>{dict.eyebrow}</Eyebrow>
          <h2 className="mt-4 font-heading text-3xl font-bold text-teal">
            {dict.heading}
          </h2>
          <p className="mt-6 text-base text-teal/70">{dict.paragraph}</p>
        </div>

        <div className="flex flex-col gap-6">
          {dict.cards.map((card) => (
            <div
              key={card.tag}
              className="rounded-lg border border-sage-dark/40 p-6"
            >
              <p className="font-technical text-sm font-bold tracking-[0.1em] text-coral">
                {card.tag}
              </p>
              <p className="mt-2 font-heading text-lg font-bold text-teal">
                {card.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
