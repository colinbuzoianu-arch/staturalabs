import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdministrationAccess } from "@/lib/auth/require-access";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import {
  completeOnboarding,
  getOnboardingStatus,
  loadSampleData,
  removeSampleData,
} from "@/lib/onboarding/onboarding";
import { prisma } from "@/lib/prisma";

// P13 §3 onboarding wizard. A guided first-run for a tenant's company_admin:
// status derived from the tenant's own data, links into the real surfaces,
// a clearly-marked removable sample, resumable + skippable.
export default async function OnboardingPage() {
  const user = await requireAdministrationAccess();
  if (!user.companyId) redirect("/app/sites");
  const companyId = user.companyId;
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).onboarding;

  const firstSite = await prisma.site.findFirst({
    where: { companyId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, country: true },
  });
  const status = await getOnboardingStatus(companyId);

  async function loadSampleAction() {
    "use server";
    const u = await requireAdministrationAccess();
    if (!u.companyId) return;
    const s = await prisma.site.findFirst({
      where: { companyId: u.companyId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!s) return;
    await loadSampleData({
      companyId: u.companyId,
      siteId: s.id,
      actorUserId: u.id,
    });
    revalidatePath("/app/onboarding");
  }
  async function removeSampleAction() {
    "use server";
    const u = await requireAdministrationAccess();
    if (!u.companyId) return;
    await removeSampleData({ companyId: u.companyId, actorUserId: u.id });
    revalidatePath("/app/onboarding");
  }
  async function finishAction() {
    "use server";
    const u = await requireAdministrationAccess();
    if (!u.companyId) return;
    await completeOnboarding(u.companyId, u.id);
    redirect("/app/sites");
  }

  const siteId = firstSite?.id;
  const Step = ({
    done,
    title,
    desc,
    href,
  }: {
    done: boolean;
    title: string;
    desc: string;
    href?: string;
  }) => (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-surface p-4">
      <div>
        <p className="font-heading text-sm font-bold text-foreground">
          <span className={done ? "text-status-low" : "text-foreground-subtle"}>
            {done ? "✓ " : "○ "}
          </span>
          {title}
          <span className="ml-2 text-xs text-foreground-subtle">
            {done ? dict.done : dict.todo}
          </span>
        </p>
        <p className="mt-1 text-sm text-foreground-muted">{desc}</p>
      </div>
      {href && (
        <Link
          href={href}
          className="text-sm text-accent hover:underline whitespace-nowrap"
        >
          {dict.open}
        </Link>
      )}
    </div>
  );

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-6 py-10">
      <div>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-foreground">
          {dict.heading}
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">{dict.intro}</p>
      </div>

      <Step
        done
        title={dict.stepCompanySite}
        desc={`${dict.stepCompanySiteDesc}${firstSite ? ` — ${firstSite.name} (${firstSite.country})` : ""}`}
        href={siteId ? `/app/s/${siteId}` : undefined}
      />
      <Step
        done={status.hasOrgUnits && status.hasWorkstations}
        title={dict.stepOrganisation}
        desc={dict.stepOrganisationDesc}
        href={siteId ? `/app/s/${siteId}/settings/org-units` : undefined}
      />
      <Step
        done={status.hasPersons}
        title={dict.stepPeople}
        desc={dict.stepPeopleDesc}
        href={siteId ? `/app/s/${siteId}/people` : undefined}
      />
      <Step
        done={status.hasAssessment}
        title={dict.stepAssessment}
        desc={dict.stepAssessmentDesc}
        href={siteId ? `/app/s/${siteId}/risk` : undefined}
      />

      <div className="flex items-start justify-between gap-4 rounded-lg border border-dashed border-border bg-surface p-4">
        <div>
          <p className="font-heading text-sm font-bold text-foreground">
            {dict.stepSample}
          </p>
          <p className="mt-1 text-sm text-foreground-muted">
            {dict.stepSampleDesc}
          </p>
          {status.hasSample && (
            <p className="mt-1 text-xs text-info">{dict.sampleLoaded}</p>
          )}
        </div>
        <form action={status.hasSample ? removeSampleAction : loadSampleAction}>
          <button
            type="submit"
            className="rounded border border-border px-3 py-1.5 text-sm hover:border-accent"
          >
            {status.hasSample ? dict.removeSample : dict.loadSample}
          </button>
        </form>
      </div>

      <div className="flex gap-3">
        <form action={finishAction}>
          <button
            type="submit"
            className="rounded-[var(--radius-md)] bg-accent px-4 py-2 text-sm font-medium text-background"
          >
            {dict.finish}
          </button>
        </form>
        <form action={finishAction}>
          <button
            type="submit"
            className="rounded border border-border px-4 py-2 text-sm"
          >
            {dict.skip}
          </button>
        </form>
      </div>
    </div>
  );
}
