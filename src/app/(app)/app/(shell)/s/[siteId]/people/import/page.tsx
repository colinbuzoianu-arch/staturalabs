import Link from "next/link";
import { redirect } from "next/navigation";
import { PersonCsvImport } from "@/components/person-csv-import";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import {
  autoDetectMapping,
  buildImportPlan,
  parseCsv,
} from "@/lib/people/csv-import";
import { importPersons } from "@/lib/people/person";
import { prisma } from "@/lib/prisma";

// P7b CSV import route. The register links here; on import the server
// re-parses and re-validates from the raw CSV (never the client preview).
export default async function PeopleImportPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const { site } = await requireSiteAdministrationAccess(siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).peopleImport;
  const companyId = site.companyId;

  async function fetchContext(cId: string) {
    const [persons, orgUnits] = await Promise.all([
      prisma.person.findMany({
        where: { companyId: cId, personnelNumber: { not: null } },
        select: { id: true, personnelNumber: true },
      }),
      prisma.orgUnit.findMany({
        where: { site: { companyId: cId } },
        select: { id: true, name: true },
      }),
    ]);
    const existing: [string, string][] = persons
      .filter((p) => p.personnelNumber)
      .map((p) => [p.personnelNumber as string, p.id]);
    const orgByName: [string, string][] = orgUnits.map((o) => [
      o.name.toLowerCase(),
      o.id,
    ]);
    return { existing, orgByName };
  }

  const { existing, orgByName } = await fetchContext(companyId);

  async function importAction(formData: FormData) {
    "use server";
    const { user, site: s } = await requireSiteAdministrationAccess(siteId);
    const csv = formData.get("csv");
    if (typeof csv !== "string" || csv.trim().length === 0) {
      redirect(`/app/s/${siteId}/people`);
    }
    const rows = parseCsv((csv as string).trim());
    if (rows.length < 2) redirect(`/app/s/${siteId}/people`);
    const [header, ...dataRows] = rows;
    const mapping = autoDetectMapping(header);

    // Re-fetch context fresh inside the action (own request context).
    const [persons, orgUnits] = await Promise.all([
      prisma.person.findMany({
        where: { companyId: s.companyId, personnelNumber: { not: null } },
        select: { id: true, personnelNumber: true },
      }),
      prisma.orgUnit.findMany({
        where: { site: { companyId: s.companyId } },
        select: { id: true, name: true },
      }),
    ]);
    const plan = buildImportPlan(dataRows, mapping, {
      existingByPersonnelNumber: new Map(
        persons
          .filter((p) => p.personnelNumber)
          .map((p) => [p.personnelNumber as string, p.id]),
      ),
      orgUnitIdByName: new Map(
        orgUnits.map((o) => [o.name.toLowerCase(), o.id]),
      ),
    });
    const { created, updated } = await importPersons(
      s.companyId,
      user.id,
      plan.rows,
    );
    redirect(`/app/s/${siteId}/people?imported=${created}&updated=${updated}`);
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
      <div>
        <p className="font-technical text-xs uppercase tracking-[0.2em] text-foreground-subtle">
          {dict.eyebrow}
        </p>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-foreground">
          {dict.heading}
        </h1>
      </div>
      <Link
        href={`/app/s/${siteId}/people`}
        className="text-sm text-accent hover:underline"
      >
        {dict.backLink}
      </Link>
      <PersonCsvImport
        action={importAction}
        existingPersonnelNumbers={existing}
        orgUnitsByName={orgByName}
        labels={{
          intro: dict.intro,
          pasteLabel: dict.pasteLabel,
          fileLabel: dict.fileLabel,
          detectedMapping: dict.detectedMapping,
          notDetected: dict.notDetected,
          summary: dict.summary,
          previewHeading: dict.previewHeading,
          colRow: dict.colRow,
          colAction: dict.colAction,
          colName: dict.colName,
          colReason: dict.colReason,
          importButton: dict.importButton,
          nothingToImport: dict.nothingToImport,
          fieldLabels: dict.fieldLabels,
          actionLabels: dict.actionLabels,
          reasonLabels: dict.reasonLabels,
        }}
      />
    </div>
  );
}
