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
  TRIAL_COUNTRIES,
  TRIAL_DEFAULT_DURATION_DAYS,
  TrialGateError,
} from "@/lib/admin/trial";
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
  searchParams: Promise<{ created?: string; error?: string }>;
}) {
  await requireSuperAdmin();
  const { created, error } = await searchParams;
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

  const now = new Date();
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
          {error === "seed" ? dict.seedFailed : dict.createFailed}
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
                  <th className="px-5 py-3 text-right font-medium">
                    {dict.colAiCalls}
                  </th>
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
                      <td className="px-5 py-3 text-right tabular-nums">
                        {aiCalls.get(t.id) ?? 0}
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
