import { revalidatePath } from "next/cache";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  type AudienceScopeValue,
  BroadcastAudiencePicker,
} from "@/components/broadcast-compose";
import { Badge } from "@/components/ui/badge";
import type {
  BroadcastDomain,
  BroadcastPriority,
} from "@/generated/prisma/enums";
import { userCan } from "@/lib/auth/company-role-bundle";
import { requireSiteAccess } from "@/lib/auth/require-access";
import {
  type AudienceInput,
  BroadcastGateError,
  createBroadcast,
  resolveSenderScope,
} from "@/lib/broadcasts/broadcast";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";

// Sicherheitsinformationen: compose + the sender's own list (drafts and
// published). The audience picker offers only the groups the sender's scope
// allows; the server re-checks every target through the one audience guard, so
// hiding an option in the UI is convenience, never the control.
export default async function BroadcastsSentPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { siteId } = await params;
  const { error } = await searchParams;
  const { user, site } = await requireSiteAccess(siteId);
  const locale = await getLocale();
  const administration = getAdministrationDictionary(locale);
  const dict = administration.broadcasts;
  // The sender surface. A read-only role (works council, employee) has no
  // business in the draft list — their surfaces are the inbox, the archive and
  // the aggregate status. 404, not a redirect, same as every other gate here.
  const canSend = await userCan(user, "broadcasts.write");
  if (!canSend) notFound();
  const companyId = site.companyId;

  async function createAction(formData: FormData) {
    "use server";
    const { user: actor, site: s } = await requireSiteAccess(siteId);
    if (!(await userCan(actor, "broadcasts.write"))) {
      redirect(`/app/s/${siteId}/broadcasts/sent?error=errorOutsideScope`);
    }
    const title = formData.get("title");
    const body = formData.get("body");
    if (typeof title !== "string" || title.trim().length === 0) {
      redirect(`/app/s/${siteId}/broadcasts/sent?error=errorTitleRequired`);
    }
    if (typeof body !== "string" || body.trim().length === 0) {
      redirect(`/app/s/${siteId}/broadcasts/sent?error=errorBodyRequired`);
    }

    // Positional pairing: the picker always submits a target field per scope
    // field, so index i of one belongs to index i of the other.
    const scopes = formData.getAll("audienceScope").map(String);
    const targets = formData.getAll("audienceTarget").map(String);
    const audiences: AudienceInput[] = scopes.map((scope, i) => {
      const target = targets[i] ?? "";
      switch (scope) {
        case "SITE":
          return { scope: "SITE", siteId: target || null };
        case "ORG_UNIT":
          return { scope: "ORG_UNIT", orgUnitId: target || null };
        case "WORKSTATION":
          return { scope: "WORKSTATION", workstationId: target || null };
        case "ROLE":
          return {
            scope: "ROLE",
            role: (target || null) as AudienceInput["role"],
          };
        default:
          return { scope: "COMPANY" };
      }
    });
    if (audiences.length === 0) {
      redirect(`/app/s/${siteId}/broadcasts/sent?error=errorAudienceRequired`);
    }

    const companyWide = formData.get("scope") === "COMPANY";
    const requiresConfirmation = formData.get("requiresConfirmation") === "on";
    const dueRaw = formData.get("confirmationDueAt");
    const linkKind = String(formData.get("linkKind") ?? "");
    const linkId = String(formData.get("linkId") ?? "");

    try {
      const created = await createBroadcast({
        user: actor,
        companyId: s.companyId,
        siteId: companyWide ? null : s.id,
        title,
        body,
        priority: String(formData.get("priority")) as BroadcastPriority,
        domain: String(formData.get("domain")) as BroadcastDomain,
        documentId: linkKind === "document" && linkId ? linkId : null,
        incidentId: linkKind === "incident" && linkId ? linkId : null,
        operatingInstructionId:
          linkKind === "operatingInstruction" && linkId ? linkId : null,
        actionId: linkKind === "action" && linkId ? linkId : null,
        requiresConfirmation,
        confirmationDueAt:
          requiresConfirmation &&
          typeof dueRaw === "string" &&
          dueRaw.length > 0
            ? new Date(`${dueRaw}T23:59:59.999Z`)
            : null,
        audiences,
      });
      revalidatePath(`/app/s/${siteId}/broadcasts/sent`);
      redirect(`/app/s/${siteId}/broadcasts/${created.id}`);
    } catch (err) {
      if (err instanceof BroadcastGateError) {
        redirect(`/app/s/${siteId}/broadcasts/sent?error=errorOutsideScope`);
      }
      throw err;
    }
  }

  const sender = await resolveSenderScope(user);
  const senderSiteIds = [...sender.siteIds];

  const [broadcasts, sites, orgUnits, workstations] = await Promise.all([
    prisma.broadcast.findMany({
      where: {
        companyId,
        status: { in: ["DRAFT", "PUBLISHED"] },
        // A sender sees the company-wide messages and those of their own sites.
        OR: [{ siteId: null }, { siteId: { in: senderSiteIds } }],
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        publishedAt: true,
        confirmationDueAt: true,
        siteId: true,
        _count: { select: { recipients: true } },
      },
    }),
    prisma.site.findMany({
      where: { companyId, id: { in: senderSiteIds } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.orgUnit.findMany({
      where: {
        site: { companyId },
        ...(sender.orgUnitIds ? { id: { in: [...sender.orgUnitIds] } } : {}),
        siteId: { in: senderSiteIds },
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.workstation.findMany({
      where: {
        siteId: { in: senderSiteIds },
        ...(sender.orgUnitIds
          ? { orgUnitId: { in: [...sender.orgUnitIds] } }
          : {}),
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const confirmedCounts = await prisma.broadcastRecipient.groupBy({
    by: ["broadcastId"],
    where: {
      broadcastId: { in: broadcasts.map((b) => b.id) },
      confirmedAt: { not: null },
    },
    _count: { _all: true },
  });
  const confirmedByBroadcast = new Map(
    confirmedCounts.map((c) => [c.broadcastId, c._count._all]),
  );

  // Which audience groups this sender may even offer. A leader has no
  // company/site/role audience (audience-scope.ts refuses them), so the picker
  // does not pretend otherwise.
  const allowedScopes: AudienceScopeValue[] =
    sender.orgUnitIds !== null
      ? ["ORG_UNIT", "WORKSTATION"]
      : sender.role === "COMPANY_ADMIN"
        ? ["COMPANY", "SITE", "ORG_UNIT", "WORKSTATION", "ROLE"]
        : ["SITE", "ORG_UNIT", "WORKSTATION", "ROLE"];

  const linkable = await loadLinkables(companyId, senderSiteIds);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
      <div>
        <p className="font-technical text-xs uppercase tracking-[0.2em] text-foreground-subtle">
          {dict.eyebrow}
        </p>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-foreground">
          {dict.sentHeading}
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">{dict.intro}</p>
      </div>

      {error && (
        <p className="rounded-lg border border-coral bg-surface p-3 text-sm text-coral">
          {(dict as unknown as Record<string, string>)[error] ?? error}
        </p>
      )}

      {!canSend && (
        <p className="text-sm text-foreground-muted">{dict.readOnlyNote}</p>
      )}

      {canSend && (
        <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <h2 className="font-heading text-sm font-bold">
            {dict.composeHeading}
          </h2>
          <form action={createAction} className="flex flex-col gap-3 text-sm">
            <label className="flex flex-col gap-1">
              {dict.titleLabel}
              <input
                name="title"
                required
                className="rounded border border-border bg-background px-2 py-1"
              />
            </label>
            <label className="flex flex-col gap-1">
              {dict.bodyLabel}
              <textarea
                name="body"
                required
                rows={6}
                className="rounded border border-border bg-background px-2 py-1"
              />
              <span className="text-xs text-foreground-muted">
                {dict.bodyHint}
              </span>
            </label>

            <div className="flex flex-wrap gap-3">
              <label className="flex flex-col gap-1">
                {dict.priorityLabel}
                <select
                  name="priority"
                  className="rounded border border-border bg-background px-2 py-1"
                >
                  <option value="INFO">{dict.priorityLabels.INFO}</option>
                  <option value="SAFETY_ALERT">
                    {dict.priorityLabels.SAFETY_ALERT}
                  </option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                {dict.domainLabel}
                <select
                  name="domain"
                  className="rounded border border-border bg-background px-2 py-1"
                >
                  <option value="OSH">{dict.domainLabels.OSH}</option>
                  <option value="ENVIRONMENT">
                    {dict.domainLabels.ENVIRONMENT}
                  </option>
                  <option value="GENERAL">{dict.domainLabels.GENERAL}</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                {dict.scopeLabel}
                <select
                  name="scope"
                  className="rounded border border-border bg-background px-2 py-1"
                >
                  <option value="SITE">{dict.scopeThisSite}</option>
                  {sender.role === "COMPANY_ADMIN" && (
                    <option value="COMPANY">{dict.scopeCompany}</option>
                  )}
                </select>
              </label>
            </div>

            <BroadcastAudiencePicker
              dict={{
                audienceHeading: dict.audienceHeading,
                audienceHint: dict.audienceHint,
                audienceScopeLabel: dict.audienceScopeLabel,
                audienceTargetLabel: dict.audienceTargetLabel,
                audienceAdd: dict.audienceAdd,
                audienceRemove: dict.audienceRemove,
                audienceEmpty: dict.audienceEmpty,
                audienceScopeLabels: dict.audienceScopeLabels,
                roleLabels: administration.usersPage.roleLabels,
                none: dict.none,
              }}
              allowedScopes={allowedScopes}
              sites={sites}
              orgUnits={orgUnits}
              workstations={workstations}
              roles={["SITE_ADMIN", "EHS_SPECIALIST", "MANAGER", "EMPLOYEE"]}
            />

            <div className="flex flex-wrap gap-3">
              <label className="flex flex-col gap-1">
                {dict.linkLabel}
                <select
                  name="linkKind"
                  className="rounded border border-border bg-background px-2 py-1"
                >
                  <option value="">{dict.linkNone}</option>
                  <option value="document">{dict.linkDocument}</option>
                  <option value="incident">{dict.linkIncident}</option>
                  <option value="operatingInstruction">
                    {dict.linkOperatingInstruction}
                  </option>
                  <option value="action">{dict.linkAction}</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                {dict.audienceTargetLabel}
                <select
                  name="linkId"
                  className="rounded border border-border bg-background px-2 py-1"
                >
                  <option value="">{dict.none}</option>
                  {linkable.map((l) => (
                    <option key={`${l.kind}:${l.id}`} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="requiresConfirmation" />
                {dict.requiresConfirmationLabel}
              </label>
              <label className="flex flex-col gap-1">
                {dict.confirmationDueLabel}
                <input
                  type="date"
                  name="confirmationDueAt"
                  className="rounded border border-border bg-background px-2 py-1"
                />
              </label>
            </div>

            <button
              type="submit"
              className="self-start rounded-[var(--radius-md)] bg-accent px-4 py-2 font-medium text-background"
            >
              {dict.saveDraft}
            </button>
          </form>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-sm font-bold">{dict.sentHeading}</h2>
        {broadcasts.length === 0 ? (
          <p className="text-sm text-foreground-muted">{dict.sentEmpty}</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-foreground-muted">
                <th className="py-1 pr-4">{dict.colTitle}</th>
                <th className="py-1 pr-4">{dict.colPriority}</th>
                <th className="py-1 pr-4">{dict.colStatus}</th>
                <th className="py-1 pr-4">{dict.colPublished}</th>
                <th className="py-1 pr-4">{dict.colRecipients}</th>
                <th className="py-1 pr-4">{dict.colConfirmed}</th>
              </tr>
            </thead>
            <tbody>
              {broadcasts.map((b) => (
                <tr key={b.id} className="border-b border-border last:border-0">
                  <td className="py-1.5 pr-4 font-medium">
                    <Link
                      href={`/app/s/${siteId}/broadcasts/${b.id}`}
                      className="text-foreground hover:text-accent hover:underline"
                    >
                      {b.title}
                    </Link>
                  </td>
                  <td className="py-1.5 pr-4">
                    <Badge
                      tone={b.priority === "SAFETY_ALERT" ? "high" : "info"}
                    >
                      {dict.priorityLabels[b.priority]}
                    </Badge>
                  </td>
                  <td className="py-1.5 pr-4 text-foreground-muted">
                    {dict.statusLabels[b.status]}
                  </td>
                  <td className="py-1.5 pr-4 text-foreground-muted">
                    {b.publishedAt
                      ? b.publishedAt.toLocaleDateString(locale)
                      : dict.none}
                  </td>
                  <td className="py-1.5 pr-4 text-foreground-muted">
                    {b._count.recipients}
                  </td>
                  <td className="py-1.5 pr-4 text-foreground-muted">
                    {confirmedByBroadcast.get(b.id) ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

// The linkable records a sender may point at. Deliberately small and recent:
// a link is a convenience, not a browser.
async function loadLinkables(
  companyId: string,
  siteIds: readonly string[],
): Promise<{ kind: string; id: string; label: string }[]> {
  const [documents, incidents, operatingInstructions, actions] =
    await Promise.all([
      prisma.document.findMany({
        where: { companyId },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, title: true },
      }),
      prisma.incident.findMany({
        where: { companyId },
        orderBy: { occurredAt: "desc" },
        take: 20,
        select: { id: true, title: true },
      }),
      prisma.operatingInstruction.findMany({
        where: { siteId: { in: [...siteIds] }, status: "APPROVED" },
        orderBy: { updatedAt: "desc" },
        take: 20,
        select: { id: true, substance: { select: { tradeName: true } } },
      }),
      prisma.action.findMany({
        where: { siteId: { in: [...siteIds] } },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, title: true },
      }),
    ]);
  return [
    ...documents.map((d) => ({
      kind: "document",
      id: d.id,
      label: `📄 ${d.title}`,
    })),
    ...incidents.map((i) => ({
      kind: "incident",
      id: i.id,
      label: `⚠ ${i.title}`,
    })),
    ...operatingInstructions.map((o) => ({
      kind: "operatingInstruction",
      id: o.id,
      label: `🧪 ${o.substance.tradeName}`,
    })),
    ...actions.map((a) => ({
      kind: "action",
      id: a.id,
      label: `🛠 ${a.title}`,
    })),
  ];
}
