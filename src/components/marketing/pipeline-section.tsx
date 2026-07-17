import { getMarketingDictionary } from "@/lib/i18n/dictionaries/marketing";
import { getLocale } from "@/lib/i18n/get-locale";
import { Eyebrow } from "./eyebrow";

export async function PipelineSection() {
  const locale = await getLocale();
  const dict = getMarketingDictionary(locale).pipeline;

  return (
    <section id="pipeline" className="scroll-mt-20 bg-ivory">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <Eyebrow>{dict.eyebrow}</Eyebrow>
        <h2 className="mt-4 max-w-2xl font-heading text-3xl font-bold text-teal">
          {dict.heading}
        </h2>

        <div className="mt-14 grid grid-cols-1 gap-10 min-[860px]:grid-cols-4 min-[860px]:gap-8">
          {dict.steps.map((item) => (
            <div key={item.step} className="border-t border-sage-dark/40 pt-5">
              <p className="font-technical text-xs tracking-[0.15em] text-sage-dark">
                {item.step}
              </p>
              <h3 className="mt-3 font-heading text-lg font-bold text-teal">
                {item.heading}
              </h3>
              <p className="mt-2 text-sm text-teal/70">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
