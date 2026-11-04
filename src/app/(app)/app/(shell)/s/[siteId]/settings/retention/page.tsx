import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canAccessCompany } from "@/lib/auth/rbac";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import {
  approveSubstanceRetentionBatch,
  cancelSubstanceRetentionBatch,
  generateSubstanceRetentionProposal,
} from "@/lib/chemicals/substance-retention-batch";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import {
  approveRetentionBatch,
  cancelRetentionBatch,
  generateRetentionProposal,
  setRetentionAutoExecute,
} from "@/lib/people/retention-batch";
import { prisma } from "@/lib/prisma";

// P7d §C.4: data-retention settings — company policy, auto-execute toggle,
// on-demand "run the job" (propose), and batch review/approval. Company-admin
// only for mutations; others see a read-only note.
export default async function RetentionPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<{ proposed?: string; subProposed?: string }>;
}) {
  const { siteId } = await params;
  const { proposed, subProposed } = await searchParams;
  const { user, site } = await requireSiteAdministrationAccess(siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).retentionPage;
  const companyId = site.companyId;
  const canManage = canAccessCompany(user, companyId);

  async function runCheckAction() {
    "use server";
    const { user: actor, site: s } =
      await requireSiteAdministrationAccess(siteId);
    if (!canAccessCompany(actor, s.companyId)) return;
    const batch = await generateRetentionProposal(s.companyId, actor.id);
    redirect(
      `/app/s/${siteId}/settings/retention?proposed=${batch ? "1" : "0"}`,
    );
  }

  async function approveAction(formData: FormData) {
    "use server";
    const { user: actor, site: s } =
      await requireSiteAdministrationAccess(siteId);
    if (!canAccessCompany(actor, s.companyId)) return;
    const id = formData.get("batchId");
    if (typeof id === "string" && id.length > 0) {
      await approveRetentionBatch(id, s.companyId, actor.id);
    }
    revalidatePath(`/app/s/${siteId}/settings/retention`);
  }

  async function cancelAction(formData: FormData) {
    "use server";
    const { user: actor, site: s } =
      await requireSiteAdministrationAccess(siteId);
    if (!canAccessCompany(actor, s.companyId)) return;
    const id = formData.get("batchId");
    if (typeof id === "string" && id.length > 0) {
      await cancelRetentionBatch(id, s.companyId, actor.id);
    }
    revalidatePath(`/app/s/${siteId}/settings/retention`);
  }

  async function toggleAutoExecuteAction(formData: FormData) {
    "use server";
    const { user: actor, site: s } =
      await requireSiteAdministrationAccess(siteId);
    if (!canAccessCompany(actor, s.companyId)) return;
    await setRetentionAutoExecute(
      s.companyId,
      formData.get("value") === "on",
      actor.id,
    );
    revalidatePath(`/app/s/${siteId}/settings/retention`);
  }

  async function runSubstanceCheckAction() {
    "use server";
    const { user: actor, site: s } =
      await requireSiteAdministrationAccess(siteId);
    if (!canAccessCompany(actor, s.companyId)) return;
    const batch = await generateSubstanceRetentionProposal(
      s.companyId,
      actor.id,
    );
    redirect(
      `/app/s/${siteId}/settings/retention?subProposed=${batch ? "1" : "0"}`,
    );
  }

  async function approveSubstanceAction(formData: FormData) {
    "use server";
    const { user: actor, site: s } =
      await requireSiteAdministrationAccess(siteId);
    if (!canAccessCompany(actor, s.companyId)) return;
    const id = formData.get("batchId");
    if (typeof id === "string" && id.length > 0) {
      await approveSubstanceRetentionBatch(id, s.companyId, actor.id);
    }
    revalidatePath(`/app/s/${siteId}/settings/retention`);
  }

  async function cancelSubstanceAction(formData: FormData) {
    "use server";
    const { user: actor, site: s } =
      await requireSiteAdministrationAccess(siteId);
    if (!canAccessCompany(actor, s.companyId)) return;
    const id = formData.get("batchId");
    if (typeof id === "string" && id.length > 0) {
      await cancelSubstanceRetentionBatch(id, s.companyId, actor.id);
    }
    revalidatePath(`/app/s/${siteId}/settings/retention`);
  }

  const [settings, config, batches, substanceBatches] = await Promise.all([
    prisma.companyRetentionSetting.findMany({ where: { companyId } }),
    prisma.companyRetentionConfig.findUnique({ where: { companyId } }),
    prisma.retentionBatch.findMany({
      where: { companyId },
      include: { _count: { select: { items: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.substanceRetentionBatch.findMany({
      where: { companyId },
      include: { _count: { select: { items: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);
  const autoExecute = config?.autoExecute ?? false;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
      <div>
        <p className="font-technical text-xs uppercase tracking-[0.2em] text-foreground-subtle">
          {dict.eyebrow}
        </p>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-foreground">
          {dict.heading}
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">{dict.intro}</p>
      </div>

      <p className="rounded-lg border border-border bg-surface p-3 text-xs text-foreground-muted">
        {dict.basisNote}
      </p>

      {proposed === "1" && (
        <p className="rounded-lg border border-info bg-surface p-3 text-sm text-foreground">
          {dict.proposedBanner.replace("{n}", "")}
        </p>
      )}
      {proposed === "0" && (
        <p className="rounded-lg border border-border bg-surface p-3 text-sm text-foreground-muted">
          {dict.noCandidatesBanner}
        </p>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="font-heading text-sm font-bold">{dict.policyHeading}</h2>
        <ul className="text-sm text-foreground-muted">
          {settings.map((s) => (
            <li key={s.id}>
              {dict.recordTypeLabels[s.recordType]}: {s.retention}
            </li>
          ))}
        </ul>
        <div className="mt-1 flex items-center gap-3 text-sm">
          <span>
            {dict.autoExecuteLabel}:{" "}
            <span className="font-medium">
              {autoExecute ? dict.autoExecuteOn : dict.autoExecuteOff}
            </span>
          </span>
          {canManage && (
            <form action={toggleAutoExecuteAction}>
              <input
                type="hidden"
                name="value"
                value={autoExecute ? "off" : "on"}
              />
              <button
                type="submit"
                className="rounded border border-border px-2 py-1 text-xs hover:border-accent"
              >
                {autoExecute
                  ? dict.autoExecuteToggleOff
                  : dict.autoExecuteToggleOn}
              </button>
            </form>
          )}
        </div>
      </section>

      {canManage ? (
        <form action={runCheckAction}>
          <button
            type="submit"
            className="self-start rounded-[var(--radius-md)] bg-accent px-4 py-2 text-sm font-medium text-background"
          >
            {dict.runCheck}
          </button>
        </form>
      ) : (
        <p className="text-sm text-foreground-muted">{dict.readOnlyNote}</p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-sm font-bold">
          {dict.batchesHeading}
        </h2>
        {batches.length === 0 ? (
          <p className="text-sm text-foreground-muted">{dict.batchesEmpty}</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {batches.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded border border-border bg-surface p-3"
              >
                <span>
                  <span className="font-medium text-foreground">
                    {b.status === "PROPOSED"
                      ? dict.batchProposed
                      : b.status === "APPROVED"
                        ? dict.batchApproved
                        : dict.batchCancelled}
                  </span>{" "}
                  <span className="text-foreground-muted">
                    · {b._count.items} {dict.batchPersons} ·{" "}
                    {b.createdAt.toISOString().slice(0, 10)}
                  </span>
                </span>
                {canManage && b.status === "PROPOSED" && (
                  <span className="flex gap-2">
                    <form action={approveAction}>
                      <input type="hidden" name="batchId" value={b.id} />
                      <button
                        type="submit"
                        className="rounded bg-accent px-2 py-1 text-xs font-medium text-background"
                      >
                        {dict.approve}
                      </button>
                    </form>
                    <form action={cancelAction}>
                      <input type="hidden" name="batchId" value={b.id} />
                      <button
                        type="submit"
                        className="text-xs text-foreground-subtle hover:text-accent hover:underline"
                      >
                        {dict.cancel}
                      </button>
                    </form>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3 border-t border-border pt-6">
        <div>
          <h2 className="font-heading text-sm font-bold">
            {dict.substanceHeading}
          </h2>
          <p className="mt-1 text-xs text-foreground-muted">
            {dict.substanceIntro}
          </p>
        </div>

        {subProposed === "1" && (
          <p className="rounded-lg border border-info bg-surface p-3 text-sm text-foreground">
            {dict.substanceProposedBanner}
          </p>
        )}
        {subProposed === "0" && (
          <p className="rounded-lg border border-border bg-surface p-3 text-sm text-foreground-muted">
            {dict.substanceNoCandidates}
          </p>
        )}

        {canManage && (
          <form action={runSubstanceCheckAction}>
            <button
              type="submit"
              className="self-start rounded-[var(--radius-md)] bg-accent px-4 py-2 text-sm font-medium text-background"
            >
              {dict.substanceRunCheck}
            </button>
          </form>
        )}

        <h3 className="font-heading text-xs font-bold text-foreground-muted">
          {dict.substanceBatchesHeading}
        </h3>
        {substanceBatches.length === 0 ? (
          <p className="text-sm text-foreground-muted">{dict.batchesEmpty}</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {substanceBatches.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded border border-border bg-surface p-3"
              >
                <span>
                  <span className="font-medium text-foreground">
                    {b.status === "PROPOSED"
                      ? dict.batchProposed
                      : b.status === "APPROVED"
                        ? dict.batchApproved
                        : dict.batchCancelled}
                  </span>{" "}
                  <span className="text-foreground-muted">
                    · {b._count.items} {dict.substanceRecords} ·{" "}
                    {b.createdAt.toISOString().slice(0, 10)}
                  </span>
                </span>
                {canManage && b.status === "PROPOSED" && (
                  <span className="flex gap-2">
                    <form action={approveSubstanceAction}>
                      <input type="hidden" name="batchId" value={b.id} />
                      <button
                        type="submit"
                        className="rounded bg-accent px-2 py-1 text-xs font-medium text-background"
                      >
                        {dict.substanceApprove}
                      </button>
                    </form>
                    <form action={cancelSubstanceAction}>
                      <input type="hidden" name="batchId" value={b.id} />
                      <button
                        type="submit"
                        className="text-xs text-foreground-subtle hover:text-accent hover:underline"
                      >
                        {dict.cancel}
                      </button>
                    </form>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
