import type { Metadata } from "next";
import { PILOT_MAILTO } from "@/components/marketing/constants";
import { Eyebrow } from "@/components/marketing/eyebrow";

export const metadata: Metadata = {
  title: "About",
};

export default function AboutPage() {
  return (
    <div className="bg-ivory">
      <div className="mx-auto max-w-3xl px-6 py-24">
        <Eyebrow>About</Eyebrow>
        <h1 className="mt-4 font-heading text-3xl font-bold text-teal min-[860px]:text-4xl">
          Built to measure what used to be guessed.
        </h1>

        <div className="mt-8 flex flex-col gap-5 text-base text-teal/80">
          <p>
            Statura Labs Dynamics started from a simple frustration: ergonomic
            risk in industrial workplaces is usually assessed by eye, on a
            clipboard, once a year if at all — not because anyone doesn't care,
            but because proper instrumented assessment has always meant
            wearables, specialized sensors, or an outside consultant's time. We
            set out to build something that runs on a camera you probably
            already own.
          </p>
          <p>
            Statura is built by an engineer with a background in industrial
            occupational health and safety systems, developed under Verumsell
            SRL, a Romania-based software studio. The product is in active
            technical pilot with industrial manufacturing partners. We're
            building it deliberately and in the open about what's proven versus
            what's still in development, rather than rushing a polished claim
            ahead of the evidence.
          </p>
        </div>

        <div className="mt-16 flex flex-col gap-12">
          <section>
            <Eyebrow>Grounded, not guessed</Eyebrow>
            <p className="mt-4 text-base text-teal/80">
              Every threshold in Statura's scoring engine is built on
              established occupational ergonomics standards — ISO 11228 and EN
              1005 — not a proprietary black box. The architecture was built
              around data minimization and current AI Act guidance from the
              first line of code, not retrofitted after the fact.
            </p>
          </section>

          <section>
            <Eyebrow>Where we are now</Eyebrow>
            <p className="mt-4 text-base text-teal/80">
              Statura Labs Dynamics is currently in technical pilot with
              industrial manufacturing partners, not yet a commercial product.
              If you want to see it measure a real workstation, we'd like to
              hear from you.
            </p>
          </section>
        </div>

        <a
          href={PILOT_MAILTO}
          className="mt-16 inline-block rounded-md bg-coral px-6 py-3 font-heading font-bold text-teal transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral"
        >
          Request a pilot
        </a>
      </div>
    </div>
  );
}
