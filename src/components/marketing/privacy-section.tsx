import { getMarketingDictionary } from "@/lib/i18n/dictionaries/marketing";
import { getLocale } from "@/lib/i18n/get-locale";
import { Eyebrow } from "./eyebrow";

export async function PrivacySection() {
  const locale = await getLocale();
  const dict = getMarketingDictionary(locale).privacy;

  return (
    <section className="bg-teal">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <Eyebrow>{dict.eyebrow}</Eyebrow>
        <h2 className="mt-4 max-w-2xl font-heading text-3xl font-bold text-ivory">
          {dict.heading}
        </h2>

        <div className="mt-14 grid grid-cols-1 gap-10 min-[860px]:grid-cols-3 min-[860px]:gap-8">
          {dict.items.map((item) => (
            <div key={item.heading} className="flex flex-col gap-3">
              <span
                aria-hidden="true"
                className="size-2 rounded-full bg-coral"
              />
              <h3 className="font-heading text-lg font-bold text-ivory">
                {item.heading}
              </h3>
              <p className="text-sm text-ivory/70">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
