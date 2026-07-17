import Image from "next/image";
import { getMarketingDictionary } from "@/lib/i18n/dictionaries/marketing";
import { getLocale } from "@/lib/i18n/get-locale";
import { Eyebrow } from "./eyebrow";

export async function FieldNotesSection() {
  const locale = await getLocale();
  const dict = getMarketingDictionary(locale).fieldNotes;

  return (
    <section className="relative isolate overflow-hidden bg-ivory">
      <Image
        src="/bg/statura_bg_light.svg"
        alt=""
        aria-hidden="true"
        fill
        unoptimized
        className="-z-20 object-cover opacity-20"
      />
      {/* Scrim over the texture — same principle as the hero's gradient
          over statura_bg_dark.svg: the pattern is decoration, not
          something the four text blocks have to compete with. */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-ivory/85" />

      <div className="relative mx-auto max-w-6xl px-6 py-24">
        <Eyebrow>{dict.eyebrow}</Eyebrow>
        <h2 className="mt-4 max-w-2xl font-heading text-3xl font-bold text-teal">
          {dict.heading}
        </h2>

        <div className="mt-14 grid grid-cols-1 gap-10 min-[860px]:grid-cols-2 min-[860px]:gap-x-12 min-[860px]:gap-y-14">
          {dict.notes.map((note) => (
            <article key={note.kicker} className="flex flex-col gap-3">
              <p className="font-technical text-xs uppercase tracking-[0.15em] text-coral">
                {note.kicker}
              </p>
              <h3 className="font-heading text-lg font-bold text-teal">
                {note.heading}
              </h3>
              {note.paragraphs.map((paragraph) => (
                <p key={paragraph} className="text-sm text-teal/70">
                  {paragraph}
                </p>
              ))}
              {note.roadmapNote && (
                <p className="mt-2 border-t border-dashed border-sage-dark/50 pt-3 font-technical text-xs text-sage-dark">
                  {note.roadmapNote}
                </p>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
