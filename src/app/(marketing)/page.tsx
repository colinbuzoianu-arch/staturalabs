import type { Metadata } from "next";
import Link from "next/link";
import { PILOT_MAILTO } from "@/components/marketing/constants";
import { getMarketingDictionary } from "@/lib/i18n/dictionaries/marketing";
import { getLocale } from "@/lib/i18n/get-locale";

export async function generateMetadata(): Promise<Metadata> {
  const dict = getMarketingDictionary(await getLocale());
  return {
    title: dict.meta.title,
    description: dict.meta.description,
  };
}

export default async function LandingPage() {
  const locale = await getLocale();
  const dict = getMarketingDictionary(locale);
  const { hero, platform, modules, documents, dach, trust, finalCta } = dict;

  return (
    <>
      {/* Hero */}
      <section className="bg-teal text-ivory">
        <div className="mx-auto max-w-5xl px-5 py-16 min-[860px]:px-6 min-[860px]:py-28">
          <p className="font-technical text-xs uppercase tracking-[0.2em] text-coral">
            {hero.eyebrow}
          </p>
          <h1 className="mt-5 max-w-3xl font-heading text-[1.7rem] font-bold leading-tight hyphens-auto min-[860px]:text-5xl">
            {hero.h1}
          </h1>
          <p className="mt-6 max-w-2xl text-base text-ivory/85 min-[860px]:text-lg">
            {hero.lede}
          </p>
          <div className="mt-9 flex flex-col gap-3 min-[860px]:flex-row min-[860px]:items-center">
            <a
              href={PILOT_MAILTO}
              className="w-full rounded-md bg-coral px-6 py-3 text-center font-heading text-sm font-bold text-teal transition-opacity hover:opacity-90 min-[860px]:w-auto"
            >
              {hero.ctaPrimary}
            </a>
            <a
              href="#module"
              className="w-full rounded-md border border-sage-dark/50 px-6 py-3 text-center font-heading text-sm font-bold text-ivory transition-colors hover:border-ivory min-[860px]:w-auto"
            >
              {hero.ctaSecondary}
            </a>
          </div>
        </div>
      </section>

      {/* Platform */}
      <section className="bg-ivory">
        <div className="mx-auto max-w-5xl px-5 py-14 min-[860px]:px-6 min-[860px]:py-20">
          <p className="font-technical text-xs uppercase tracking-[0.2em] text-coral">
            {platform.eyebrow}
          </p>
          <h2 className="mt-4 max-w-3xl font-heading text-2xl font-bold text-teal hyphens-auto min-[860px]:text-3xl">
            {platform.heading}
          </h2>
          <div className="mt-6 grid gap-5 min-[860px]:grid-cols-2">
            {platform.paragraphs.map((p) => (
              <p key={p.slice(0, 24)} className="text-base text-teal/80">
                {p}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* Modules */}
      <section id="module" className="scroll-mt-20 bg-teal text-ivory">
        <div className="mx-auto max-w-6xl px-5 py-14 min-[860px]:px-6 min-[860px]:py-20">
          <p className="font-technical text-xs uppercase tracking-[0.2em] text-coral">
            {modules.eyebrow}
          </p>
          <h2 className="mt-4 max-w-3xl font-heading text-2xl font-bold hyphens-auto min-[860px]:text-3xl">
            {modules.heading}
          </h2>
          <p className="mt-4 max-w-2xl text-base text-ivory/80">
            {modules.lede}
          </p>
          <div className="mt-10 grid gap-4 min-[860px]:grid-cols-2 min-[1100px]:grid-cols-3">
            {modules.items.map((m) => (
              <div
                key={m.title}
                className="rounded-lg border border-sage-dark/40 bg-teal/40 p-5"
              >
                <h3 className="font-heading text-base font-bold text-ivory hyphens-auto">
                  {m.title}
                </h3>
                <p className="mt-2 text-sm text-ivory/75">{m.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Documents */}
      <section className="bg-ivory">
        <div className="mx-auto max-w-5xl px-5 py-14 min-[860px]:px-6 min-[860px]:py-20">
          <p className="font-technical text-xs uppercase tracking-[0.2em] text-coral">
            {documents.eyebrow}
          </p>
          <h2 className="mt-4 max-w-3xl font-heading text-2xl font-bold text-teal hyphens-auto min-[860px]:text-3xl">
            {documents.heading}
          </h2>
          <p className="mt-4 max-w-2xl text-base text-teal/80">
            {documents.paragraph}
          </p>
          <div className="mt-10 grid gap-4 min-[860px]:grid-cols-2">
            {documents.items.map((d) => (
              <div
                key={d.title}
                className="rounded-lg border border-sage-dark/30 bg-white/40 p-5"
              >
                <h3 className="font-heading text-base font-bold text-teal hyphens-auto">
                  {d.title}
                </h3>
                <p className="mt-2 text-sm text-teal/75">{d.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DACH */}
      <section className="bg-sage-light/40">
        <div className="mx-auto max-w-5xl px-5 py-14 min-[860px]:px-6 min-[860px]:py-20">
          <p className="font-technical text-xs uppercase tracking-[0.2em] text-coral">
            {dach.eyebrow}
          </p>
          <h2 className="mt-4 max-w-3xl font-heading text-2xl font-bold text-teal hyphens-auto min-[860px]:text-3xl">
            {dach.heading}
          </h2>
          <p className="mt-4 max-w-2xl text-base text-teal/80">
            {dach.paragraph}
          </p>
          <ul className="mt-8 flex flex-col gap-3">
            {dach.points.map((point) => (
              <li
                key={point.slice(0, 16)}
                className="flex items-start gap-3 text-base text-teal"
              >
                <span aria-hidden className="mt-1 text-coral">
                  ▸
                </span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Trust / GDPR */}
      <section className="bg-ivory">
        <div className="mx-auto max-w-5xl px-5 py-14 min-[860px]:px-6 min-[860px]:py-20">
          <p className="font-technical text-xs uppercase tracking-[0.2em] text-coral">
            {trust.eyebrow}
          </p>
          <h2 className="mt-4 max-w-3xl font-heading text-2xl font-bold text-teal hyphens-auto min-[860px]:text-3xl">
            {trust.heading}
          </h2>
          <div className="mt-10 grid gap-6 min-[860px]:grid-cols-3">
            {trust.items.map((t) => (
              <div key={t.title}>
                <h3 className="font-heading text-base font-bold text-teal hyphens-auto">
                  {t.title}
                </h3>
                <p className="mt-2 text-sm text-teal/75">{t.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-teal text-ivory">
        <div className="mx-auto flex max-w-5xl flex-col items-start gap-6 px-5 py-14 min-[860px]:px-6 min-[860px]:py-20 min-[860px]:items-center min-[860px]:text-center">
          <p className="font-technical text-xs uppercase tracking-[0.2em] text-coral">
            {finalCta.eyebrow}
          </p>
          <h2 className="max-w-2xl font-heading text-2xl font-bold min-[860px]:text-4xl">
            {finalCta.heading}
          </h2>
          <p className="max-w-xl text-base text-ivory/80">
            {finalCta.paragraph}
          </p>
          <a
            href={PILOT_MAILTO}
            className="rounded-md bg-coral px-6 py-3 font-heading text-sm font-bold text-teal transition-opacity hover:opacity-90"
          >
            {finalCta.cta}
          </a>
          <p className="text-xs text-ivory/60">
            <Link href="/legal" className="hover:text-ivory">
              {dict.footer.legal}
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
