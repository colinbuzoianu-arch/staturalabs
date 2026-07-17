import { FieldNotesSection } from "@/components/marketing/field-notes-section";
import { FinalCtaSection } from "@/components/marketing/final-cta-section";
import { HeroSection } from "@/components/marketing/hero-section";
import { PipelineSection } from "@/components/marketing/pipeline-section";
import { PrivacySection } from "@/components/marketing/privacy-section";
import { StandardsSection } from "@/components/marketing/standards-section";

// Section order and content match the reviewed visual prototype exactly;
// do not add sections beyond this file without checking first. Header/
// footer come from the (marketing) route group's layout.tsx now, not this
// file — shared with /about and /legal.
export default function MarketingPage() {
  return (
    <>
      <HeroSection />
      <PipelineSection />
      <PrivacySection />
      <StandardsSection />
      <FieldNotesSection />
      <FinalCtaSection />
    </>
  );
}
