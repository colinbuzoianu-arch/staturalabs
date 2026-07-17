import Image from "next/image";
import { PILOT_MAILTO } from "./constants";
import { Eyebrow } from "./eyebrow";

export function HeroSection() {
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

      <div className="mx-auto w-full max-w-6xl px-6 py-24">
        <div className="max-w-[620px]">
          <Eyebrow>{"Measured motion // workplace ergonomics"}</Eyebrow>
          <h1 className="mt-4 font-heading text-[34px] font-bold leading-[1.1] text-ivory min-[860px]:text-[54px]">
            Ergonomic risk, read like an instrument reads it.
          </h1>
          <p className="mt-6 text-base text-ivory/85 min-[860px]:text-lg">
            Statura Labs Dynamics turns an ordinary camera into a precision
            ergonomics assessment tool. Trunk, neck, shoulder, elbow, and knee
            angles scored against ISO 11228 and EN 1005 — in real working
            conditions, not a lab.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <a
              href={PILOT_MAILTO}
              className="rounded-md bg-coral px-5 py-3 font-heading font-bold text-teal transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ivory"
            >
              Request a pilot
            </a>
            <a
              href="#pipeline"
              className="rounded-md border border-ivory/40 px-5 py-3 font-heading font-bold text-ivory transition-colors hover:border-ivory focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ivory"
            >
              See how it works
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
