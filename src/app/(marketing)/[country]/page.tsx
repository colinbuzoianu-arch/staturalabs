import { notFound } from "next/navigation";
import { CountryContextSection } from "@/components/marketing/country-context-section";
import { FieldNotesSection } from "@/components/marketing/field-notes-section";
import { FinalCtaSection } from "@/components/marketing/final-cta-section";
import { HeroSection } from "@/components/marketing/hero-section";
import { PipelineSection } from "@/components/marketing/pipeline-section";
import { PrivacySection } from "@/components/marketing/privacy-section";
import { StandardsSection } from "@/components/marketing/standards-section";
import { isMarketingCountry } from "@/lib/country/countries";
import { getCountryPack } from "@/lib/country/packs";

// Section order and content match the reviewed visual prototype exactly;
// do not add sections beyond this file without checking first, except
// CountryContextSection (SLD_IMPLEMENTATION_PLAN_austria-first.md
// §4.1/§4.2), which is new and country-scoped by design. Header/footer
// come from (marketing)/[country]/layout.tsx, not this file — shared with
// this country's /about and /legal too.
export default async function MarketingPage({
  params,
}: {
  params: Promise<{ country: string }>;
}) {
  const { country } = await params;
  if (!isMarketingCountry(country)) notFound();
  const pack = getCountryPack(country);

  return (
    <>
      <HeroSection />
      <PipelineSection />
      <PrivacySection />
      <StandardsSection />
      <CountryContextSection pack={pack} />
      <FieldNotesSection />
      <FinalCtaSection />
    </>
  );
}
