import { revalidatePath } from "next/cache";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/field";
import type { CountryCode } from "@/generated/prisma/enums";
import { trialDaysLeft, trialState } from "@/lib/admin/tenant-kind";
import {
  createTrial,
  reseedTrial,
  TRIAL_COUNTRIES,
  TRIAL_DEFAULT_DURATION_DAYS,
  TrialGateError,
} from "@/lib/admin/trial";
import {
  approveTrialDeletion,
  cancelTrialDeletion,
  convertTrialToCustomer,
  extendTrial,
  runTrialLifecycle,
} from "@/lib/admin/trial-lifecycle";
import { trialUserLimit } from "@/lib/admin/trial-limits";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { getAdminDictionary } from "@/lib/i18n/dictionaries/admin";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";

// P18 A.2/A.5: Testzugänge — create a prospect trial and see every trial at a
// glance. super_admin only (the /admin layout and every action re-check).
export default async function TrialsPage({
  searchParams,
}: {
  searchParams: Promise<{
    created?: string;
    error?: string;
    ran?: string;
    deleted?: string;
  }>;
}) {
  await requireSuperAdmin();
  const { created, error, ran, deleted } = await searchParams;
  const locale = await getLocale();
  const dict = getAdminDictionary(locale).trialsPage;
  const companiesDict = getAdminDictionary(locale).companiesPage;

  async function createTrialAction(formData: FormData) {
    "use server";
    const actor = await requireSuperAdmin();
    const name = formData.get("companyName");
    const email = formData.get("contactEmail");
    const contactName = formData.get("contactName");
    const country = formData.get("country");
    const durationRaw = formData.get("durationDays");
    const startingData = formData.get("startingData");
    const notes = formData.get("notes");
    const { redirect } = await import("next/navigation");

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof country !== "string" ||
      !(TRIAL_COUNTRIES as readonly string[]).includes(country)
    ) {
      redirect("/admin/trials?error=invalid");
      return;
    }
    const companyName: string = name;
    const contactEmail: string = email;
    const countryCode = country as CountryCode;
    try {
      const result = await createTrial({
        companyName,
        contactEmail,
        contactName: typeof contactName === "string" ? contactName : null,
        country: countryCode,
        durationDays:
          typeof durationRaw === "string" && durationRaw.length > 0
            ? Number.parseInt(durationRaw, 10)
            : TRIAL_DEFAULT_DURATION_DAYS,
        withDemoData: startingData !== "empty",
        notes: typeof notes === "string" ? notes : null,
        actorUserId: actor.id,
      });
      revalidatePath("/admin/trials");
      redirect(
        `/admin/trials?created=${result.companyId}${result.seedError ? "&error=seed" : ""}`,
      );
    } catch (err) {
      if (err instanceof TrialGateError) {
        redirect(`/admin/trials?error=${err.message}`);
      }
      throw err;
    }
  }

  // --- A.4 founder actions. Each is audited in its gate and redirects, so the
  // result is visible rather than silently applied.
  async function runLifecycleAction() {
    "use server";
    const actor = await requireSuperAdmin();
    const result = await runTrialLifecycle({ actorUserId: actor.id });
    const { redirect } = await import("next/navigation");
    redirect(
      `/admin/trials?ran=${result.reminders.created}-${result.locked}-${result.proposed}`,
    );
  }

  async function extendAction(formData: FormData) {
    "use server";
    const actor = await requireSuperAdmin();
    const companyId = formData.get("companyId");
    const days = formData.get("days");
    if (typeof companyId !== "string") return;
    await extendTrial({
      companyId,
      days:
        typeof days === "string" && days.length > 0
          ? Number.parseInt(days, 10)
          : 30,
      actorUserId: actor.id,
    });
    revalidatePath("/admin/trials");
  }

  async function convertAction(formData: FormData) {
    "use server";
    const actor = await requireSuperAdmin();
    const companyId = formData.get("companyId");
    if (typeof companyId !== "string") return;
    await convertTrialToCustomer({ companyId, actorUserId: actor.id });
    revalidatePath("/admin/trials");
  }

  async function reseedAction(formData: FormData) {
    "use server";
    const actor = await requireSuperAdmin();
    const companyId = formData.get("companyId");
    if (typeof companyId !== "string") return;
    await reseedTrial({ companyId, actorUserId: actor.id });
    revalidatePath("/admin/trials");
  }

  async function approveDeletionAction(formData: FormData) {
    "use server";
    const actor = await requireSuperAdmin();
    const proposalId = formData.get("proposalId");
    const confirmName = formData.get("confirmName");
    const expectedName = formData.get("expectedName");
    const { redirect } = await import("next/navigation");
    if (typeof proposalId !== "string") return;
    // Double confirm (A.4 "Löschen (double confirm)"): the founder types the
    // tenant's name. An irreversible cross-tenant delete is not a one-click.
    if (
      typeof confirmName !== "string" ||
      typeof expectedName !== "string" ||
      confirmName.trim() !== expectedName.trim()
    ) {
      redirect("/admin/trials?error=name-mismatch");
      return;
    }
    await approveTrialDeletion({ proposalId, actorUserId: actor.id });
    redirect("/admin/trials?deleted=1");
  }

  async function cancelDeletionAction(formData: FormData) {
    "use server";
    const actor = await requireSuperAdmin();
    const proposalId = formData.get("proposalId");
    if (typeof proposalId !== "string") return;
    await cancelTrialDeletion({ proposalId, actorUserId: actor.id });
    revalidatePath("/admin/trials");
  }

  const now = new Date();
  const proposals = await prisma.trialDeletionProposal.findMany({
    where: { status: "PROPOSED" },
    orderBy: { proposedAt: "asc" },
  });
  const trials = await prisma.company.findMany({
    where: {
      OR: [{ tenantKind: "TRIAL" }, { trialConvertedAt: { not: null } }],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      tenantKind: true,
      homeCountry: true,
      createdAt: true,
      trialExpiresAt: true,
      trialLockedAt: true,
      trialConvertedAt: true,
      trialContactEmail: true,
      trialSeeded: true,
      _count: { select: { platformUsers: true, sites: true } },
    },
  });

  // A.5: "last activity" and "AI usage" per trial, from data that already
  // exists — the audit log (any mutation in the tenant) and the AI counters.
  // No per-user tracking: both are tenant aggregates.
  const trialIds = trials.map((t) => t.id);
  const [lastEvents, aiUsage, sdsUploads] = await Promise.all([
    trialIds.length > 0
      ? prisma.auditEvent.groupBy({
          by: ["companyId"],
          where: { companyId: { in: trialIds } },
          _max: { createdAt: true },
        })
      : Promise.resolve([]),
    trialIds.length > 0
      ? prisma.aiUsageCounter.groupBy({
          by: ["companyId"],
          where: { companyId: { in: trialIds } },
          _sum: { calls: true },
        })
      : Promise.resolve([]),
    trialIds.length > 0
      ? prisma.safetyDataSheet.groupBy({
          by: ["substanceId"],
          where: { substance: { companyId: { in: trialIds } } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
  ]);
  const lastActivity = new Map(
    lastEvents.map((e) => [e.companyId, e._max.createdAt]),
  );
  const aiCalls = new Map(aiUsage.map((a) => [a.companyId, a._sum.calls ?? 0]));
  const sdsCount = sdsUploads.length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold">
          {dict.heading}
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-foreground-muted">
          {dict.intro}
        </p>
      </div>

      {created && (
        <p className="rounded-[var(--radius-md)] border border-border bg-surface p-3 text-sm">
          {dict.createdBanner}{" "}
          <Link
            href={`/admin/tenants/${created}`}
            className="text-accent hover:underline"
          >
            {dict.openTenant}
          </Link>
        </p>
      )}
      {error && (
        <p className="rounded-[var(--radius-md)] border border-coral bg-surface p-3 text-sm text-coral">
          {error === "seed"
            ? dict.seedFailed
            : error === "name-mismatch"
              ? dict.proposalNameMismatch
              : dict.createFailed}
        </p>
      )}
      {deleted && (
        <p className="rounded-[var(--radius-md)] border border-border bg-surface p-3 text-sm">
          {dict.proposalDeleted}
        </p>
      )}

      <Card>
        <CardHeader title={dict.createHeading} />
        <CardBody>
          <form
            action={createTrialAction}
            className="flex flex-col gap-3 text-sm"
          >
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="trial-name">{dict.companyNameLabel}</Label>
                <Input
                  id="trial-name"
                  name="companyName"
                  required
                  className="w-64"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="trial-contact-name">
                  {dict.contactNameLabel}
                </Label>
                <Input
                  id="trial-contact-name"
                  name="contactName"
                  className="w-56"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="trial-email">{dict.contactEmailLabel}</Label>
                <Input
                  id="trial-email"
                  name="contactEmail"
                  type="email"
                  required
                  className="w-64"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="trial-country">{dict.countryLabel}</Label>
                <Select id="trial-country" name="country">
                  {TRIAL_COUNTRIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="trial-duration">{dict.durationLabel}</Label>
                <Input
                  id="trial-duration"
                  name="durationDays"
                  type="number"
                  min={1}
                  max={365}
                  defaultValue={TRIAL_DEFAULT_DURATION_DAYS}
                  className="w-24"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="trial-data">{dict.startingDataLabel}</Label>
                <Select id="trial-data" name="startingData" defaultValue="demo">
                  <option value="demo">{dict.startingDataDemo}</option>
                  <option value="empty">{dict.startingDataEmpty}</option>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="trial-notes">{dict.notesLabel}</Label>
                <Input id="trial-notes" name="notes" className="w-72" />
              </div>
            </div>
            <p className="text-xs text-foreground-subtle">{dict.termsNote}</p>
            <p className="text-xs text-foreground-subtle">
              {dict.createHint
                .replace("{users}", String(trialUserLimit("TRIAL") ?? 0))
                .replace("{days}", String(TRIAL_DEFAULT_DURATION_DAYS))}
            </p>
            <Button type="submit" className="self-start">
              {dict.createButton}
            </Button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={dict.lifecycleHeading} />
        <CardBody className="flex flex-col gap-3">
          <p className="text-sm text-foreground-muted">{dict.lifecycleIntro}</p>
          <form action={runLifecycleAction}>
            <Button type="submit">{dict.lifecycleRun}</Button>
          </form>
          {ran && (
            <p className="text-sm text-foreground">
              {(() => {
                const [reminders, locked, proposed] = ran.split("-");
                return dict.lifecycleRan
                  .replace("{reminders}", reminders ?? "0")
                  .replace("{locked}", locked ?? "0")
                  .replace("{proposed}", proposed ?? "0");
              })()}
            </p>
          )}
          {proposals.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="font-heading text-xs font-bold uppercase tracking-wide text-foreground-subtle">
                {dict.proposalsHeading}
              </h3>
              <p className="text-xs text-foreground-muted">
                {dict.proposalsIntro}
              </p>
              {proposals.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-wrap items-end gap-3 rounded border border-coral p-3 text-sm"
                >
                  <span className="font-medium text-foreground">
                    {p.companyName}
                  </span>
                  <span className="text-xs text-foreground-muted">
                    {dict.proposalGraceEnded.replace(
                      "{date}",
                      p.graceEndedAt.toLocaleDateString(locale),
                    )}
                  </span>
                  <form
                    action={approveDeletionAction}
                    className="flex items-end gap-2"
                  >
                    <input type="hidden" name="proposalId" value={p.id} />
                    <input
                      type="hidden"
                      name="expectedName"
                      value={p.companyName}
                    />
                    <div className="flex flex-col gap-1">
                      <Label htmlFor={`confirm-${p.id}`}>
                        {dict.proposalConfirmLabel}
                      </Label>
                      <Input
                        id={`confirm-${p.id}`}
                        name="confirmName"
                        required
                        className="w-64"
                      />
                    </div>
                    <button
                      type="submit"
                      className="rounded-[var(--radius-md)] bg-coral px-3 py-2 text-xs font-medium text-white"
                    >
                      {dict.proposalApprove}
                    </button>
                  </form>
                  <form action={cancelDeletionAction}>
                    <input type="hidden" name="proposalId" value={p.id} />
                    <button
                      type="submit"
                      className="pb-2 text-xs text-foreground-subtle hover:text-accent hover:underline"
                    >
                      {dict.proposalKeep}
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {trials.length === 0 ? (
        <p className="text-sm text-foreground-muted">{dict.empty}</p>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-foreground-subtle">
                  <th className="px-5 py-3 font-medium">{dict.colCompany}</th>
                  <th className="px-3 py-3 font-medium">{dict.colContact}</th>
                  <th className="px-3 py-3 font-medium">{dict.colCountry}</th>
                  <th className="px-3 py-3 font-medium">{dict.colExpires}</th>
                  <th className="px-3 py-3 font-medium">{dict.colState}</th>
                  <th className="px-3 py-3 text-right font-medium">
                    {dict.colUsers}
                  </th>
                  <th className="px-3 py-3 font-medium">
                    {dict.colLastActivity}
                  </th>
                  <th className="px-3 py-3 text-right font-medium">
                    {dict.colAiCalls}
                  </th>
                  <th className="px-5 py-3 font-medium">{dict.colActions}</th>
                </tr>
              </thead>
              <tbody>
                {trials.map((t) => {
                  const state = trialState(t, now);
                  const daysLeft = trialDaysLeft(t.trialExpiresAt, now);
                  const limit = trialUserLimit(t.tenantKind) ?? null;
                  const last = lastActivity.get(t.id) ?? null;
                  return (
                    <tr
                      key={t.id}
                      className="border-b border-border last:border-0 hover:bg-surface"
                    >
                      <td className="px-5 py-3">
                        <Link
                          href={`/admin/tenants/${t.id}`}
                          className="font-medium text-foreground hover:text-accent"
                        >
                          {t.name}
                        </Link>
                        {t.trialSeeded && (
                          <span className="ml-2 text-xs text-foreground-subtle">
                            {dict.seededMarker}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-foreground-muted">
                        {t.trialContactEmail ?? "—"}
                      </td>
                      <td className="px-3 py-3 text-foreground-muted">
                        {t.homeCountry ?? "—"}
                      </td>
                      <td className="px-3 py-3 text-foreground-muted">
                        {t.trialExpiresAt
                          ? `${t.trialExpiresAt.toLocaleDateString(locale)}${
                              daysLeft !== null && daysLeft > 0
                                ? ` (${daysLeft} ${dict.daysLeft})`
                                : ""
                            }`
                          : "—"}
                      </td>
                      <td className="px-3 py-3">
                        <Badge
                          tone={
                            state === "locked"
                              ? "high"
                              : state === "expiring-soon"
                                ? "elevated"
                                : state === "converted"
                                  ? "low"
                                  : "outline"
                          }
                        >
                          {companiesDict.trialStateLabels[state]}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {t._count.platformUsers}
                        {limit !== null ? ` / ${limit}` : ""}
                      </td>
                      <td className="px-3 py-3 text-foreground-muted">
                        {last ? last.toLocaleDateString(locale) : "—"}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {aiCalls.get(t.id) ?? 0}
                      </td>
                      <td className="px-5 py-3">
                        {t.tenantKind === "TRIAL" ? (
                          <div className="flex flex-wrap items-center gap-3 text-xs">
                            <form
                              action={extendAction}
                              className="flex items-center gap-1"
                            >
                              <input
                                type="hidden"
                                name="companyId"
                                value={t.id}
                              />
                              <input
                                name="days"
                                type="number"
                                min={1}
                                max={365}
                                defaultValue={30}
                                aria-label={dict.extendLabel}
                                className="w-16 rounded border border-border bg-background px-1 py-0.5"
                              />
                              <button
                                type="submit"
                                className="text-accent hover:underline"
                              >
                                {dict.extend}
                              </button>
                            </form>
                            {t.trialSeeded && (
                              <form action={reseedAction}>
                                <input
                                  type="hidden"
                                  name="companyId"
                                  value={t.id}
                                />
                                <button
                                  type="submit"
                                  className="text-accent hover:underline"
                                >
                                  {dict.reset}
                                </button>
                              </form>
                            )}
                            <form action={convertAction}>
                              <input
                                type="hidden"
                                name="companyId"
                                value={t.id}
                              />
                              <button
                                type="submit"
                                className="text-accent hover:underline"
                              >
                                {dict.convert}
                              </button>
                            </form>
                          </div>
                        ) : (
                          <span className="text-xs text-foreground-subtle">
                            {dict.convertedNote}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <p className="text-xs text-foreground-subtle">
        {dict.sdsFootnote.replace("{count}", String(sdsCount))}
      </p>
    </div>
  );
}
