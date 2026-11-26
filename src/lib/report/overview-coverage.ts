import "server-only";

import type { CountryCode } from "@/generated/prisma/enums";
import { getActiveLegalRequirementCatalog } from "@/lib/legal/legal-register";
import { prisma } from "@/lib/prisma";

// P18 B.4: the Produktüberblick's legal-coverage figures.
//
// Read from the INSTALLATION's active legal-requirement catalogue, never from a
// hand-maintained sales claim — the plan's requirement ("AT/DE legal coverage
// from the catalogue, honest gaps named"). A country with no system rows is
// reported as a gap in the same list, in the same words, rather than left out
// so the page reads complete.
//
// Only system rows (companyId null) are counted: a tenant's own additions are
// their data, not the product's coverage.

export type CoverageRow = {
  country: CountryCode;
  osh: number;
  environment: number;
  withReference: number;
};

// The markets the overview speaks about. CH is listed deliberately: it has no
// verified content yet, and the honest gap is part of the sales story.
const OVERVIEW_COUNTRIES: CountryCode[] = ["AT", "DE", "CH"];

const COUNTRY_LABELS: Record<string, string> = {
  AT: "Österreich",
  DE: "Deutschland",
  CH: "Schweiz",
  RO: "Rumänien",
};

export async function getLegalCoverage(): Promise<{
  catalogVersion: string;
  rows: CoverageRow[];
  referenceCount: number;
}> {
  const catalogVersion = await getActiveLegalRequirementCatalog();

  const grouped = await prisma.legalRequirement.groupBy({
    by: ["country", "domain"],
    where: { catalogVersion, companyId: null },
    _count: { _all: true },
  });
  const withReference = await prisma.legalRequirement.groupBy({
    by: ["country"],
    where: { catalogVersion, companyId: null, legalReferenceId: { not: null } },
    _count: { _all: true },
  });
  const referenceCount = await prisma.legalReference.count();

  const rows = OVERVIEW_COUNTRIES.map((country) => ({
    country,
    osh:
      grouped.find((g) => g.country === country && g.domain === "OSH")?._count
        ._all ?? 0,
    environment:
      grouped.find((g) => g.country === country && g.domain === "ENVIRONMENT")
        ?._count._all ?? 0,
    withReference:
      withReference.find((g) => g.country === country)?._count._all ?? 0,
  }));

  return { catalogVersion, rows, referenceCount };
}

// Render the coverage as Markdown bullets, so it flows through the same
// Markdown → PDF pipeline as the rest of the document instead of needing a
// table (which the renderer deliberately does not support).
export function coverageMarkdown(
  coverage: Awaited<ReturnType<typeof getLegalCoverage>>,
): string {
  const lines = coverage.rows.map((row) => {
    const label = COUNTRY_LABELS[row.country] ?? row.country;
    const total = row.osh + row.environment;
    if (total === 0) {
      return `- **${label}** — noch kein geprüfter Rechtsbestand hinterlegt. Standorte lassen sich anlegen und fachlich führen; länderspezifische Dokumente erzeugt die Anwendung nicht.`;
    }
    return `- **${label}** — ${total} Rechtspflichten im Bestand (${row.osh} Arbeitnehmerschutz, ${row.environment} Umwelt), davon ${row.withReference} mit verknüpftem Rechtsverweis.`;
  });
  lines.push(
    `- **Rechtsverweise insgesamt**: ${coverage.referenceCount} geprüfte Fundstellen im Bestand (Fassung ${coverage.catalogVersion}).`,
  );
  return lines.join("\n");
}
