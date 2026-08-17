import type { CountryPack } from "@/lib/country/packs";
import { getMarketingDictionary } from "@/lib/i18n/dictionaries/marketing";
import { getLocale } from "@/lib/i18n/get-locale";
import { Eyebrow } from "./eyebrow";

// Only real, non-legal-opinion content goes here: named terminology and
// authorities (Evaluierung, Arbeitsinspektion, AUVA, SVP — factual labels,
// not compliance claims) for a verified pack
// (SLD_IMPLEMENTATION_PLAN_austria-first.md §4.1), or an honest
// "in Vorbereitung" placeholder for an unverified one (§4.2,
// ERGO_COMPLIANCE_BY_DESIGN.md §5) — never a fabricated legal claim for a
// market that hasn't been checked against a primary source. The SGD
// generator itself doesn't exist yet (that's B5) — this section names the
// vocabulary Statura is built around, it does not claim the document is
// already produced.
export async function CountryContextSection({ pack }: { pack: CountryPack }) {
  const locale = await getLocale();
  const dict = getMarketingDictionary(locale).countryContext;

  if (!pack.verified) {
    return (
      <section className="bg-ivory">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <Eyebrow>{dict.eyebrow}</Eyebrow>
          <h2 className="mt-4 font-heading text-2xl font-bold text-teal">
            {dict.unverifiedHeading}
          </h2>
          <p className="mt-4 rounded-md border border-dashed border-teal/30 px-4 py-3 font-technical text-sm text-teal/70">
            {dict.unverifiedNote}
          </p>
        </div>
      </section>
    );
  }

  const terms = [
    pack.terminology.evaluationProcess,
    pack.terminology.assessmentDocument,
    pack.terminology.enforcementAuthority,
    pack.terminology.insuranceBody,
    pack.terminology.workerRepRole,
  ];

  return (
    <section className="bg-ivory">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Eyebrow>{dict.eyebrow}</Eyebrow>
        <h2 className="mt-4 font-heading text-2xl font-bold text-teal">
          {dict.verifiedHeading}
        </h2>
        <p className="mt-4 text-base text-teal/80">
          {pack.positioningLine[locale]}
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {terms.map((term) => (
            <span
              key={term}
              className="rounded-full border border-sage-dark/40 px-3 py-1 font-technical text-xs text-teal/80"
            >
              {term}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
