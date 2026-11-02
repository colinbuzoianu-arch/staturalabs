import type { CountryCode } from "@/generated/prisma/enums";

// Country-specific framing for the statutory risk-documentation PDF
// (SLD_RESTRUCTURE_PLAN_platform-modules.md §4.3, P3 — "generalise the
// statutory document generator to DE"). The document's STRUCTURE is the same
// everywhere (identification, who/when, per-workplace findings, action
// register, applied standards, verification, history); only the legal FRAMING
// differs — the title, the statute the document is produced under, and the
// provisions cited for the norms/verification sections. Keyed by country, each
// variant corresponds to a CountryPack.sgdTemplateVariant:
//   AT "dok-vo-v1"      → Sicherheits- und Gesundheitsschutzdokument (§5 ASchG/DOK-VO)
//   DE "gbu-doc-de-v1"  → Dokumentation der Gefährdungsbeurteilung (§§5–6 ArbSchG)
// Only countries whose pack is verified AND has an sgdTemplateVariant ever
// reach here (resolveSgdCountryPack gates that) — so there is no CH framing,
// and the default throws rather than silently inventing one.
export type SgdFraming = {
  /** The document's own name in this jurisdiction. */
  docTitle: string;
  /** The statute the document is produced under, as a short "gemäß …" line. */
  legalBasisLine: string;
  /** Provision cited for the "applied standards/norms" section. */
  normsBasisRef: string;
  /** Sentence introducing the effectiveness-verification section. */
  verificationBasis: string;
  /** Statute named in the footer disclaimer. */
  disclaimerStatute: string;
};

const FRAMING: Partial<Record<CountryCode, SgdFraming>> = {
  AT: {
    docTitle: "Sicherheits- und Gesundheitsschutzdokument (SGD)",
    legalBasisLine:
      "gemäß §5 ASchG und DOK-VO (Verordnung über die Sicherheits- und Gesundheitsschutzdokumente)",
    normsBasisRef: "§5 DOK-VO",
    verificationBasis:
      "§4 Abs 4 ASchG verlangt, dass die Wirksamkeit gesetzter Maßnahmen überprüft wird.",
    disclaimerStatute: "§5 ASchG/DOK-VO",
  },
  DE: {
    docTitle: "Dokumentation der Gefährdungsbeurteilung",
    legalBasisLine:
      "gemäß §§5–6 ArbSchG (Beurteilung der Arbeitsbedingungen und deren Dokumentation)",
    normsBasisRef: "§6 ArbSchG",
    verificationBasis:
      "§3 Abs 1 ArbSchG verlangt, dass die Maßnahmen auf ihre Wirksamkeit überprüft und erforderlichenfalls angepasst werden.",
    disclaimerStatute: "§§5–6 ArbSchG",
  },
};

export function getSgdFraming(country: CountryCode): SgdFraming {
  const framing = FRAMING[country];
  if (!framing) {
    // Unreachable in practice — resolveSgdCountryPack only admits AT/DE — but
    // fail loud rather than render a document with the wrong legal framing.
    throw new Error(
      `No SGD framing for country ${country} — the statutory document generator is not available for this market`,
    );
  }
  return framing;
}
