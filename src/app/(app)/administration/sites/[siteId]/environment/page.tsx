import { revalidatePath } from "next/cache";
import Link from "next/link";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import { createEnvironmentalAssessment } from "@/lib/env/environmental-assessment";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";
import { resolveAwkCountryPack } from "@/lib/report/awk-availability";

// E3 (SLD_IMPLEMENTATION_PLAN_hazards-and-environment.md §5.4): the
// site-level "Standort-Umweltbewertung" surface — list existing
// environmental assessments and start a new one. Site-level is the default
// scope (a boiler house / wastewater plant is often not a workstation,
// §5.2); a workstation may optionally be named. Gated by
// requireSiteAdministrationAccess, same as the OSH risk-assessments page.
export default async function EnvironmentAssessmentsPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const { site } = await requireSiteAdministrationAccess(siteId);
  const locale = await getLocale();
  const administrationDict = getAdministrationDictionary(locale);
  const dict = administrationDict.environment;
  const statusLabels = administrationDict.riskAssessmentStatusLabels;
  // E4 (§6): the AWK generator is AT-only, fail-closed for DE/CH/RO — same
  // gate as the SGD. The link only renders when a verified environmental
  // country pack exists for this site's country.
  const awkPack = resolveAwkCountryPack(site.country);

  async function toggleEmasAction() {
    "use server";
    const { site: current } = await requireSiteAdministrationAccess(siteId);
    await prisma.site.update({
      where: { id: siteId },
      data: { emasRegistered: !current.emasRegistered },
    });
    revalidatePath(`/administration/sites/${siteId}/environment`);
  }

  async function createAction(formData: FormData) {
    "use server";
    const { user } = await requireSiteAdministrationAccess(siteId);
    const d = getAdministrationDictionary(await getLocale()).environment;
    const commonDict = getAdministrationDictionary(await getLocale()).common;

    const assessedAtRaw = formData.get("assessedAt");
    if (typeof assessedAtRaw !== "string" || assessedAtRaw.trim() === "") {
      throw new Error(d.assessedAtRequired);
    }
    const assessedAt = new Date(assessedAtRaw);
    if (Number.isNaN(assessedAt.getTime())) {
      throw new Error(d.assessedAtRequired);
    }

    const workstationRaw = formData.get("workstationId");
    const workstationId =
      typeof workstationRaw === "string" && workstationRaw.length > 0
        ? workstationRaw
        : null;

    const pilotContextRaw = formData.get("pilotContext");
    const pilotContext =
      typeof pilotContextRaw === "string" && pilotContextRaw.trim().length > 0
        ? pilotContextRaw.trim()
        : null;
    const notesRaw = formData.get("notes");
    const notes =
      typeof notesRaw === "string" && notesRaw.trim().length > 0
        ? notesRaw.trim()
        : null;
    const futureDevelopmentRaw = formData.get("futureDevelopment");
    const futureDevelopment =
      typeof futureDevelopmentRaw === "string" &&
      futureDevelopmentRaw.trim().length > 0
        ? futureDevelopmentRaw.trim()
        : null;

    try {
      await createEnvironmentalAssessment({
        siteId,
        workstationId,
        assessorUserId: user.id,
        assessedAt,
        pilotContext,
        notes,
        futureDevelopment,
      });
    } catch (error) {
      throw new Error(
        commonDict.unexpectedError(
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
    revalidatePath(`/administration/sites/${siteId}/environment`);
  }

  const [assessments, workstations] = await Promise.all([
    prisma.environmentalAssessment.findMany({
      where: { siteId },
      include: {
        workstation: true,
        _count: { select: { findings: true } },
      },
      orderBy: { assessedAt: "desc" },
    }),
    prisma.workstation.findMany({
      where: { siteId },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <p className="font-technical text-xs uppercase tracking-[0.2em] text-border">
          {dict.listEyebrow}
        </p>
        <h1 className="font-heading text-2xl font-bold">{dict.listHeading}</h1>
        <p className="text-sm text-border">{dict.listDescription}</p>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-bold">{dict.createHeading}</h2>
        <form
          action={createAction}
          className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4"
        >
          <div className="flex flex-wrap gap-2">
            <label className="flex flex-col gap-1 text-sm">
              {dict.workstationScopeLabel}
              <select
                name="workstationId"
                className="rounded border border-border bg-background px-2 py-1"
              >
                <option value="">{dict.scopeSiteLevel}</option>
                {workstations.map((workstation) => (
                  <option key={workstation.id} value={workstation.id}>
                    {workstation.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {dict.assessedAtLabel}
              <input
                type="datetime-local"
                name="assessedAt"
                required
                className="rounded border border-border bg-background px-2 py-1"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            {dict.pilotContextLabel}
            <input
              name="pilotContext"
              className="rounded border border-border bg-background px-2 py-1"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {dict.notesLabel}
            <input
              name="notes"
              className="rounded border border-border bg-background px-2 py-1"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {dict.futureDevelopmentLabel}
            <input
              name="futureDevelopment"
              className="rounded border border-border bg-background px-2 py-1"
            />
          </label>
          <button
            type="submit"
            className="self-start rounded bg-accent px-3 py-1.5 text-sm font-semibold text-background"
          >
            {dict.createButton}
          </button>
        </form>
      </section>

      {/* E4 (§6): the Abfallwirtschaftskonzept generator + EMAS exemption.
          Link shown only for AT sites; the EMAS note explains the §10 Abs. 1
          exemption. */}
      <section className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
        {site.emasRegistered && (
          <p className="text-sm text-border">{dict.emasExemptNote}</p>
        )}
        {awkPack && (
          <a
            href={`/api/sites/${siteId}/awk`}
            className="self-start text-sm text-accent hover:underline"
          >
            {dict.awkLink}
          </a>
        )}
        <form action={toggleEmasAction}>
          <button
            type="submit"
            className="self-start rounded border border-border px-3 py-1.5 text-sm hover:border-accent"
          >
            {site.emasRegistered ? dict.emasUnmarkButton : dict.emasMarkButton}
          </button>
        </form>
      </section>

      {assessments.length === 0 ? (
        <p className="text-sm text-border">{dict.listEmpty}</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="py-1 pr-4">{dict.colSubject}</th>
              <th className="py-1 pr-4">{dict.colStatus}</th>
              <th className="py-1 pr-4">{dict.colAssessedAt}</th>
              <th className="py-1 pr-4">{dict.colFindings}</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody>
            {assessments.map((assessment) => (
              <tr
                key={assessment.id}
                className="border-b border-border last:border-0"
              >
                <td className="py-1 pr-4">
                  {assessment.workstation?.name ?? dict.scopeSiteLevel}
                </td>
                <td className="py-1 pr-4">{statusLabels[assessment.status]}</td>
                <td className="py-1 pr-4">
                  {assessment.assessedAt.toISOString()}
                </td>
                <td className="py-1 pr-4">{assessment._count.findings}</td>
                <td className="py-1">
                  <Link
                    href={`/administration/environmental-assessments/${assessment.id}`}
                    className="underline hover:text-accent"
                  >
                    {dict.viewLink}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
