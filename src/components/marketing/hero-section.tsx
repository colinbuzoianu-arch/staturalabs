import Image from "next/image";
import { getMarketingDictionary } from "@/lib/i18n/dictionaries/marketing";
import { getLocale } from "@/lib/i18n/get-locale";
import { PILOT_MAILTO } from "./constants";
import { Eyebrow } from "./eyebrow";

export async function HeroSection() {
  const locale = await getLocale();
  const dict = getMarketingDictionary(locale).hero;

  return (
    <section className="relative isolate flex min-h-[640px] items-center overflow-hidden bg-teal">
      <Image
        src="/bg/statura_bg_dark.svg"
        alt=""
        aria-hidden="true"
        fill
        unoptimized
        priority
        className="-z-20 object-cover"
      />
      {/* Opaque teal on the left (where the text sits) fading to fully
          transparent by ~78% width, so the right side of the pattern shows
          through clearly while the copy stays legible. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{
          background:
            "linear-gradient(to right, var(--color-teal) 0%, var(--color-teal) 38%, transparent 78%)",
        }}
      />

      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 px-6 py-24 min-[860px]:grid-cols-[minmax(0,620px)_1fr]">
        <div>
          <Eyebrow>{dict.eyebrow}</Eyebrow>
          <h1 className="mt-4 font-heading text-[34px] font-bold leading-[1.1] text-ivory min-[860px]:text-[54px]">
            {dict.h1}
          </h1>
          <p className="mt-6 text-base text-ivory/85 min-[860px]:text-lg">
            {dict.lede}
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <a
              href={PILOT_MAILTO}
              className="rounded-md bg-coral px-5 py-3 font-heading font-bold text-teal transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ivory"
            >
              {dict.ctaPrimary}
            </a>
            <a
              href="#pipeline"
              className="rounded-md border border-ivory/40 px-5 py-3 font-heading font-bold text-ivory transition-colors hover:border-ivory focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ivory"
            >
              {dict.ctaSecondary}
            </a>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-ivory/20 shadow-2xl">
          {/* Muted/autoplay/loop/playsInline, no controls: a decorative
              background-style clip, not a media player — mirrors how the
              bg SVGs elsewhere in this hero are `aria-hidden`. */}
          <video
            src="/hero-weight-lifting.mp4"
            aria-hidden="true"
            tabIndex={-1}
            autoPlay
            loop
            muted
            playsInline
            className="aspect-[4/5] w-full object-cover min-[860px]:aspect-[3/4]"
          />
        </div>
      </div>
    </section>
  );
}
