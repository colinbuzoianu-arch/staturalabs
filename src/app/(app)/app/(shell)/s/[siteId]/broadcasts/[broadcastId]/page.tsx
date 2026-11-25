import { revalidatePath } from "next/cache";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { userCan } from "@/lib/auth/company-role-bundle";
import { requireSiteAccess } from "@/lib/auth/require-access";
import {
  BroadcastGateError,
  checkBroadcastPublishable,
  transitionBroadcast,
} from "@/lib/broadcasts/broadcast";
import {
  publishBroadcast,
  refreshBroadcastRecipients,
} from "@/lib/broadcasts/publish";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";

// One broadcast: what was written, who it goes to, and (once published) the
// delivery/confirmation totals. The per-person list is slice 3; this page
// already shows the aggregate so publishing can be verified end to end.
export default async function BroadcastDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string; broadcastId: string }>;
  searchParams: Promise<{ error?: string; added?: string }>;
}) {
  const { siteId, broadcastId } = await params;
  const { error, added } = await searchParams;
  const { user, site } = await requireSiteAccess(siteId);
  const locale = await getLocale();
  const administration = getAdministrationDictionary(locale);
  const dict = administration.broadcasts;
  const canSend = await userCan(user, "broadcasts.write");

  const broadcast = await prisma.broadcast.findUnique({
    where: { id: broadcastId },
    include: {
      audiences: true,
      statusEvents: { orderBy: { createdAt: "asc" } },
      document: { select: { title: true } },
      incident: { select: { title: true } },
      operatingInstruction: {
        select: { substance: { select: { tradeName: true } } },
      },
      action: { select: { title: true } },
    },
  });
  // Resource-first gate: fetch, then check it belongs to a company/site this
  // user may see — 404 rather than a redirect, same as every other detail page.
  if (!broadcast || broadcast.companyId !== site.companyId) notFound();
  if (broadcast.siteId && broadcast.siteId !== siteId) notFound();

  async function publishAction() {
    "use server";
    const { user: actor } = await requireSiteAccess(siteId);
    if (!(await userCan(actor, "broadcasts.write"))) notFound();
    try {
      await publishBroadcast({ broadcastId, user: actor });
    } catch (err) {
      if (err instanceof BroadcastGateError) {
        const key =
          err.message === "audience-resolves-to-nobody"
            ? "errorNobody"
            : err.message === "outside-sites" ||
                err.message === "outside-org-units" ||
                err.message === "outside-company" ||
                err.message === "role-cannot-send"
              ? "errorOutsideScope"
              : "errorNotPublishable";
        redirect(`/app/s/${siteId}/broadcasts/${broadcastId}?error=${key}`);
      }
      throw err;
    }
    revalidatePath(`/app/s/${siteId}/broadcasts/${broadcastId}`);
  }

  async function archiveAction() {
    "use server";
    const { user: actor } = await requireSiteAccess(siteId);
    if (!(await userCan(actor, "broadcasts.write"))) notFound();
    await transitionBroadcast({ broadcastId, to: "ARCHIVED", user: actor });
    revalidatePath(`/app/s/${siteId}/broadcasts/${broadcastId}`);
  }

  async function refreshAction() {
    "use server";
    const { user: actor } = await requireSiteAccess(siteId);
    if (!(await userCan(actor, "broadcasts.write"))) notFound();
    const result = await refreshBroadcastRecipients({
      broadcastId,
      user: actor,
    });
    redirect(
      `/app/s/${siteId}/broadcasts/${broadcastId}?added=${result.added}`,
    );
  }

  const [recipientCount, confirmedCount, readCount, publishable] =
    await Promise.all([
      prisma.broadcastRecipient.count({ where: { broadcastId } }),
      prisma.broadcastRecipient.count({
        where: { broadcastId, confirmedAt: { not: null } },
      }),
      prisma.broadcastRecipient.count({
        where: { broadcastId, readAt: { not: null } },
      }),
      broadcast.status === "DRAFT"
        ? checkBroadcastPublishable(broadcastId)
        : Promise.resolve({ ok: false as const, reason: "not-draft" }),
    ]);

  const [siteNames, orgUnitNames, workstationNames] = await Promise.all([
    prisma.site.findMany({
      where: { companyId: site.companyId },
      select: { id: true, name: true },
    }),
    prisma.orgUnit.findMany({
      where: { site: { companyId: site.companyId } },
      select: { id: true, name: true },
    }),
    prisma.workstation.findMany({
      where: { site: { companyId: site.companyId } },
      select: { id: true, name: true },
    }),
  ]);
  const siteName = new Map(siteNames.map((s) => [s.id, s.name]));
  const orgUnitName = new Map(orgUnitNames.map((o) => [o.id, o.name]));
  const workstationName = new Map(workstationNames.map((w) => [w.id, w.name]));

  type AudienceRow = NonNullable<typeof broadcast>["audiences"][number];
  function audienceLabel(a: AudienceRow): string {
    const scope = dict.audienceScopeLabels[a.scope];
    if (a.scope === "SITE") {
      return `${scope}: ${a.siteId ? (siteName.get(a.siteId) ?? dict.none) : dict.none}`;
    }
    if (a.scope === "ORG_UNIT") {
      return `${scope}: ${a.orgUnitId ? (orgUnitName.get(a.orgUnitId) ?? dict.none) : dict.none}`;
    }
    if (a.scope === "WORKSTATION") {
      return `${scope}: ${a.workstationId ? (workstationName.get(a.workstationId) ?? dict.none) : dict.none}`;
    }
    if (a.scope === "ROLE") {
      return `${scope}: ${a.role ? administration.usersPage.roleLabels[a.role] : dict.none}`;
    }
    return scope;
  }

  const linkLabel = broadcast.document
    ? `${dict.linkDocument}: ${broadcast.document.title}`
    : broadcast.incident
      ? `${dict.linkIncident}: ${broadcast.incident.title}`
      : broadcast.operatingInstruction
        ? `${dict.linkOperatingInstruction}: ${broadcast.operatingInstruction.substance.tradeName}`
        : broadcast.action
          ? `${dict.linkAction}: ${broadcast.action.title}`
          : null;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
      <div>
        <Link
          href={`/app/s/${siteId}/broadcasts/sent`}
          className="text-sm text-accent hover:underline"
        >
          {dict.detailBack}
        </Link>
        <h1 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-bold text-foreground">
          {broadcast.title}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <Badge tone={broadcast.priority === "SAFETY_ALERT" ? "high" : "info"}>
            {dict.priorityLabels[broadcast.priority]}
          </Badge>
          <Badge tone="outline">{dict.domainLabels[broadcast.domain]}</Badge>
          <Badge tone="neutral">{dict.statusLabels[broadcast.status]}</Badge>
          <span className="text-foreground-muted">
            {broadcast.siteId
              ? (siteName.get(broadcast.siteId) ?? dict.none)
              : dict.scopeCompany}
          </span>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-coral bg-surface p-3 text-sm text-coral">
          {(dict as unknown as Record<string, string>)[error] ?? error}
        </p>
      )}
      {added !== undefined && (
        <p className="rounded-lg border border-border bg-surface p-3 text-sm text-foreground">
          {dict.refreshed.replace("{added}", added ?? "0")}
        </p>
      )}

      {broadcast.status !== "DRAFT" && (
        <p className="rounded-lg border border-border bg-surface p-3 text-sm text-foreground">
          {dict.publishedBanner
            .replace(
              "{date}",
              broadcast.publishedAt?.toLocaleDateString(locale) ?? dict.none,
            )
            .replace("{recipients}", String(recipientCount))
            .replace("{confirmed}", String(confirmedCount))}
          {` · ${dict.colStatus}: ${readCount} ${locale === "de" ? "gelesen" : locale === "ro" ? "citite" : "read"}`}
        </p>
      )}

      <section className="rounded-lg border border-border bg-surface p-4">
        {/* The body was sanitised by the one write gate before it was stored
            (src/lib/broadcasts/sanitise.ts): an allowlist of formatting tags,
            every attribute stripped, unsafe links removed. */}
        <div
          className="prose-sm flex flex-col gap-2 text-sm text-foreground [&_a]:text-accent [&_a]:underline [&_li]:ml-4 [&_li]:list-disc"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitised at the single write gate
          dangerouslySetInnerHTML={{ __html: broadcast.body }}
        />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-heading text-sm font-bold">
          {dict.detailAudience}
        </h2>
        <ul className="text-sm text-foreground-muted">
          {broadcast.audiences.map((a) => (
            <li key={a.id}>{audienceLabel(a)}</li>
          ))}
        </ul>
        {linkLabel && (
          <p className="text-sm text-foreground-muted">
            {dict.detailLinks}: {linkLabel}
          </p>
        )}
        {broadcast.requiresConfirmation ? (
          <p className="text-sm text-foreground-muted">
            {dict.colDue}:{" "}
            {broadcast.confirmationDueAt
              ? broadcast.confirmationDueAt.toLocaleDateString(locale)
              : dict.none}
          </p>
        ) : (
          <p className="text-sm text-foreground-muted">
            {dict.confirmNotRequired}
          </p>
        )}
      </section>

      {canSend && (
        <section className="flex flex-wrap gap-3">
          {broadcast.status === "DRAFT" && (
            <form action={publishAction}>
              <button
                type="submit"
                title={dict.publishConfirm}
                disabled={!publishable.ok}
                className="rounded-[var(--radius-md)] bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
              >
                {dict.publish}
              </button>
            </form>
          )}
          {broadcast.status === "PUBLISHED" && (
            <>
              <form action={refreshAction}>
                <button
                  type="submit"
                  className="rounded-[var(--radius-md)] border border-border px-4 py-2 text-sm font-medium text-foreground"
                >
                  {dict.refreshRecipients}
                </button>
              </form>
              <form action={archiveAction}>
                <button
                  type="submit"
                  className="rounded-[var(--radius-md)] border border-border px-4 py-2 text-sm font-medium text-foreground"
                >
                  {dict.archive}
                </button>
              </form>
            </>
          )}
          {broadcast.status === "DRAFT" && !publishable.ok && (
            <p className="self-center text-sm text-foreground-muted">
              {dict.errorNotPublishable}
            </p>
          )}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="font-heading text-sm font-bold">{dict.detailHistory}</h2>
        <ol className="text-sm text-foreground-muted">
          {broadcast.statusEvents.map((e) => (
            <li key={e.id}>
              {e.createdAt.toLocaleString(locale)} ·{" "}
              {dict.statusLabels[e.toStatus]}
              {e.note ? ` · ${e.note}` : ""}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
