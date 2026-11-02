import { ACTION_STATUS_TONE, Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { requireSiteAccess } from "@/lib/auth/require-access";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";

// Dokumente › Erzeugte Dokumente (SLD_RESTRUCTURE_PLAN_platform-modules.md
// §2.2 rule 4, §7.2): the archive of every generated document for this site.
// Read-only; a download link opens a gated, short-lived signed URL. Viewable
// by anyone who can access the site (requireSiteAccess), not gated to the
// write surface — it's an evidence view.
export default async function GeneratedDocumentsPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  await requireSiteAccess(siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).documentsPage;

  const docs = await prisma.generatedDocument.findMany({
    where: { siteId },
    orderBy: { generatedAt: "desc" },
  });

  const userIds = [
    ...new Set(
      docs
        .map((d) => d.generatedByUserId)
        .filter((id): id is string => id !== null),
    ),
  ];
  const users = await prisma.platformUser.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  });
  const userNames = new Map(users.map((u) => [u.id, u.name]));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-foreground-subtle">
          {dict.eyebrow}
        </p>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-foreground">
          {dict.generatedHeading}
        </h1>
      </div>

      <Card>
        <CardHeader
          title={dict.generatedHeading}
          description={dict.generatedIntro}
        />
        <CardBody>
          {docs.length === 0 ? (
            <EmptyState title={dict.generatedEmpty} />
          ) : (
            <ul className="divide-y divide-border">
              {docs.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Badge tone={ACTION_STATUS_TONE.VERIFIED}>
                      {dict.typeLabels[d.type]}
                    </Badge>
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-foreground">
                        {d.title}
                      </span>
                      <span className="text-xs text-foreground-subtle">
                        {d.generatedAt
                          .toISOString()
                          .slice(0, 16)
                          .replace("T", " ")}
                        {" · "}
                        {d.generatedByUserId
                          ? (userNames.get(d.generatedByUserId) ??
                            dict.unknownUser)
                          : dict.systemUser}
                        {" · "}
                        {(d.fileSize / 1024).toFixed(0)} KB
                      </span>
                    </span>
                  </span>
                  <a
                    href={`/api/generated-documents/${d.id}`}
                    className="shrink-0 text-accent hover:underline"
                  >
                    {dict.download}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
