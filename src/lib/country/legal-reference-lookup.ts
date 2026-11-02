import type { CountryCode } from "@/generated/prisma/enums";
import type { LegalReferenceModel } from "@/generated/prisma/models";
import { prisma } from "@/lib/prisma";

// Deliberately no `import "server-only"` — directly unit-testable, same split
// as exposure-limit-lookup.ts, which this mirrors
// (SLD_RESTRUCTURE_PLAN_platform-modules.md §4.2).

type ReferenceCandidate = {
  country: CountryCode;
  topic: string;
};

// Pure core — filter rows by country + topic. No ambiguity to detect (the DB's
// LegalReference_catalogVersion_country_code_key already guards duplicates);
// kept a separate pure function to match the codebase's match/lookup split and
// stay independently testable. Returns every match (a country/topic can have
// several references, e.g. DE risk-assessment = ArbSchG §5 + §6 + DGUV V1).
export function matchLegalReferences<T extends ReferenceCandidate>(
  references: readonly T[],
  country: CountryCode,
  topic: string,
): T[] {
  return references.filter(
    (ref) => ref.country === country && ref.topic === topic,
  );
}

// Given (country, topic, catalogVersion), returns every matching
// LegalReference, or [] on no match — NEVER a fallback to another country's
// reference (ERGO_COMPLIANCE_BY_DESIGN.md §3.15/§4). A country with no row for
// a topic is an honest gap to show ("no legal reference configured for this
// topic in {country}"), never a reason to borrow another jurisdiction's law.
//
// Takes catalogVersion explicitly rather than resolving the active version
// itself (that is getActiveLegalReferenceCatalog's job), mirroring
// lookupExposureLimits — so a caller can also render references under a past
// catalogue version without that meaning "this is now active."
export async function lookupLegalReferences(params: {
  country: CountryCode;
  topic: string;
  catalogVersion: string;
}): Promise<LegalReferenceModel[]> {
  const candidates = await prisma.legalReference.findMany({
    where: { catalogVersion: params.catalogVersion, topic: params.topic },
    orderBy: { code: "asc" },
  });

  return matchLegalReferences(candidates, params.country, params.topic);
}
