import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { hasPermission } from "@/lib/auth/permissions";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import { IMPORT_ENTITIES, type ImportEntityKey } from "@/lib/import/registry";
import { ImportClient } from "./import-client";

// P14 G3: the shared bulk-import surface. One reusable pipeline (upload → column
// auto-mapping → dry-run preview → commit) with a downloadable template per
// entity. Person-safe entities only (workforce figures, person-free incidents);
// the people/health compartments are never imported here.
export default async function ImportPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const { user } = await requireSiteAdministrationAccess(siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).settingsImport;

  const entities = IMPORT_ENTITIES.filter((e) =>
    hasPermission(user, e.permission),
  ).map((e) => e.key as ImportEntityKey);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-foreground-subtle">
          {dict.eyebrow}
        </p>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-foreground">
          {dict.heading}
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">{dict.intro}</p>
      </div>

      {entities.length === 0 ? (
        <p className="text-sm text-foreground-subtle">{dict.noEntities}</p>
      ) : (
        <Card>
          <CardHeader title={dict.cardTitle} />
          <CardBody>
            <ImportClient
              siteId={siteId}
              entities={entities}
              dict={{
                heading: dict.heading,
                intro: dict.intro,
                entityLabel: dict.entityLabel,
                templateLink: dict.templateLink,
                pasteLabel: dict.pasteLabel,
                fileLabel: dict.fileLabel,
                previewButton: dict.previewButton,
                commitButton: dict.commitButton,
                previewing: dict.previewing,
                committing: dict.committing,
                summaryCreate: dict.summaryCreate,
                summaryUpdate: dict.summaryUpdate,
                summarySkip: dict.summarySkip,
                summaryError: dict.summaryError,
                colRow: dict.colRow,
                colStatus: dict.colStatus,
                colDetail: dict.colDetail,
                committedMsg: dict.committedMsg,
                noRows: dict.noRows,
                statusLabels: dict.statusLabels,
                reasonLabels: dict.reasonLabels,
                entityLabels: dict.entityLabels,
              }}
            />
          </CardBody>
        </Card>
      )}
    </div>
  );
}
