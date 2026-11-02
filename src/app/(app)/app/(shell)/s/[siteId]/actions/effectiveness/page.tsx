import Link from "next/link";
import { ACTION_STATUS_TONE, Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";
import { ActionsTabs } from "../calendar/page";

// Maßnahmen › Wirksamkeit (SLD_RESTRUCTURE_PLAN_platform-modules.md §7.1): the
// effectiveness loop — actions IMPLEMENTED and awaiting verification, and
// actions already VERIFIED with their outcome. Read-only; the verification
// itself happens on the action detail (transitionAction), same as today.
export default async function ActionsEffectivenessPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  await requireSiteAdministrationAccess(siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).actionsViews;
  const statusLabels = getAdministrationDictionary(locale).actionStatusLabels;
  const outcomeLabels =
    getAdministrationDictionary(locale).verificationOutcomeLabels;

  const [awaiting, verified] = await Promise.all([
    prisma.action.findMany({
      where: { siteId, status: "IMPLEMENTED" },
      orderBy: { implementedAt: "desc" },
    }),
    prisma.action.findMany({
      where: { siteId, status: "VERIFIED" },
      include: { verificationAssessment: { include: { workstation: true } } },
      orderBy: { verifiedAt: "desc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-foreground-subtle">
          {dict.effectivenessEyebrow}
        </p>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-foreground">
          {dict.effectivenessHeading}
        </h1>
      </div>

      <ActionsTabs siteId={siteId} active="effectiveness" dict={dict} />

      <Card>
        <CardHeader title={`${dict.awaitingHeading} (${awaiting.length})`} />
        <CardBody>
          {awaiting.length === 0 ? (
            <EmptyState title={dict.awaitingEmpty} />
          ) : (
            <ul className="divide-y divide-border">
              {awaiting.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/app/s/${siteId}/actions/${a.id}`}
                    className="flex items-center justify-between gap-3 px-1 py-2.5 text-sm hover:text-accent"
                  >
                    <span className="flex items-center gap-2">
                      <Badge tone={ACTION_STATUS_TONE[a.status] ?? "neutral"}>
                        {statusLabels[a.status]}
                      </Badge>
                      <span className="font-medium text-foreground">
                        {a.title}
                      </span>
                    </span>
                    <span className="text-foreground-subtle">
                      {dict.openDetailLink}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={`${dict.verifiedHeading} (${verified.length})`} />
        <CardBody>
          {verified.length === 0 ? (
            <EmptyState title={dict.verifiedEmpty} />
          ) : (
            <ul className="divide-y divide-border">
              {verified.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-col gap-1 px-1 py-2.5 text-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2">
                      <Badge tone="low">{statusLabels[a.status]}</Badge>
                      <Link
                        href={`/app/s/${siteId}/actions/${a.id}`}
                        className="font-medium text-foreground hover:text-accent"
                      >
                        {a.title}
                      </Link>
                    </span>
                    <span className="text-foreground-subtle">
                      {a.verifiedAt
                        ? a.verifiedAt.toISOString().slice(0, 10)
                        : ""}
                    </span>
                  </div>
                  <div className="text-xs text-foreground-muted">
                    {a.verificationOutcome
                      ? `${dict.outcomeLabel}: ${outcomeLabels[a.verificationOutcome]}`
                      : ""}
                    {a.verificationAssessment?.workstation
                      ? ` · ${dict.verifiedAgainstLabel}: ${a.verificationAssessment.workstation.name}`
                      : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
