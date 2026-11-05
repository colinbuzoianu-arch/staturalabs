import { revalidatePath } from "next/cache";
import Link from "next/link";
import type { ComplianceState, LegalDomain } from "@/generated/prisma/enums";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import {
  parseApplicability,
  suggestApplicability,
} from "@/lib/legal/applicability";
import {
  evaluateCompliance,
  getActiveLegalRequirementCatalog,
  getSiteFacts,
  raiseActionFromCompliance,
  setSiteRequirementStatus,
} from "@/lib/legal/legal-register";
import { prisma } from "@/lib/prisma";

const COMPLIANCE_STATES: ComplianceState[] = [
  "NOT_EVALUATED",
  "COMPLIANT",
  "PARTIALLY_COMPLIANT",
  "NON_COMPLIANT",
  "NOT_APPLICABLE",
];

// P11 §6.4 Rechtskataster register: the per-site requirement list with
// applicability confirmation, compliance evaluation, and raising an action.
export default async function LegalRegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<{ domain?: string; status?: string }>;
}) {
  const { siteId } = await params;
  const { domain, status } = await searchParams;
  const { site } = await requireSiteAdministrationAccess(siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).legal;
  const companyId = site.companyId;

  let catalogVersion: string;
  try {
    catalogVersion = await getActiveLegalRequirementCatalog();
  } catch {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10">
        <p className="text-sm text-foreground-muted">{dict.noneForCountry}</p>
      </div>
    );
  }

  const [requirements, siteLinks, facts] = await Promise.all([
    prisma.legalRequirement.findMany({
      where: {
        catalogVersion,
        country: site.country,
        OR: [{ companyId: null }, { companyId }],
        ...(domain === "OSH" || domain === "ENVIRONMENT"
          ? { domain: domain as LegalDomain }
          : {}),
      },
      include: { legalReference: true },
      orderBy: [{ domain: "asc" }, { code: "asc" }],
    }),
    prisma.siteLegalRequirement.findMany({
      where: { siteId },
      include: {
        evaluation: {
          include: {
            actions: { select: { id: true, title: true, status: true } },
          },
        },
      },
    }),
    getSiteFacts(siteId, companyId),
  ]);
  const linkByReq = new Map(siteLinks.map((l) => [l.legalRequirementId, l]));

  async function confirmStatusAction(formData: FormData) {
    "use server";
    const { user, site: s } = await requireSiteAdministrationAccess(siteId);
    const legalRequirementId = formData.get("requirementId");
    const st = formData.get("status");
    const rationale = formData.get("rationale");
    if (
      typeof legalRequirementId !== "string" ||
      (st !== "APPLICABLE" && st !== "NOT_APPLICABLE")
    ) {
      return;
    }
    await setSiteRequirementStatus({
      siteId,
      legalRequirementId,
      companyId: s.companyId,
      status: st,
      rationale: typeof rationale === "string" ? rationale : null,
      actorUserId: user.id,
    });
    revalidatePath(`/app/s/${siteId}/legal/register`);
  }

  async function evaluateAction(formData: FormData) {
    "use server";
    const { user, site: s } = await requireSiteAdministrationAccess(siteId);
    const id = formData.get("siteLegalRequirementId");
    const state = formData.get("state");
    const note = formData.get("note");
    if (
      typeof id !== "string" ||
      typeof state !== "string" ||
      !(COMPLIANCE_STATES as string[]).includes(state)
    ) {
      return;
    }
    await evaluateCompliance({
      siteLegalRequirementId: id,
      companyId: s.companyId,
      siteId,
      state: state as ComplianceState,
      note: typeof note === "string" ? note : null,
      actorUserId: user.id,
    });
    revalidatePath(`/app/s/${siteId}/legal/register`);
  }

  async function raiseActionAction(formData: FormData) {
    "use server";
    const { user, site: s } = await requireSiteAdministrationAccess(siteId);
    const complianceEvaluationId = formData.get("complianceEvaluationId");
    const title = formData.get("title");
    if (
      typeof complianceEvaluationId !== "string" ||
      typeof title !== "string" ||
      title.trim().length === 0
    ) {
      return;
    }
    await raiseActionFromCompliance({
      complianceEvaluationId,
      siteId,
      companyId: s.companyId,
      actorUserId: user.id,
      title,
    });
    revalidatePath(`/app/s/${siteId}/legal/register`);
  }

  // Apply the status filter in-memory (it depends on the per-site link).
  const rows = requirements
    .map((req) => {
      const link = linkByReq.get(req.id) ?? null;
      const effectiveStatus = link?.status ?? "OPEN";
      const suggestion =
        link === null
          ? suggestApplicability(parseApplicability(req.applicability), facts)
          : null;
      return { req, link, effectiveStatus, suggestion };
    })
    .filter((r) =>
      status === "APPLICABLE" ||
      status === "NOT_APPLICABLE" ||
      status === "OPEN"
        ? r.effectiveStatus === status
        : true,
    );

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

      {/* Filters */}
      <div className="flex flex-wrap gap-2 text-xs">
        <FilterLink
          siteId={siteId}
          label={dict.allDomains}
          param="domain"
          value={undefined}
          active={!domain}
        />
        <FilterLink
          siteId={siteId}
          label={dict.domainOsh}
          param="domain"
          value="OSH"
          active={domain === "OSH"}
        />
        <FilterLink
          siteId={siteId}
          label={dict.domainEnv}
          param="domain"
          value="ENVIRONMENT"
          active={domain === "ENVIRONMENT"}
        />
        <span className="mx-2 text-foreground-subtle">·</span>
        <FilterLink
          siteId={siteId}
          label={dict.allStatuses}
          param="status"
          value={undefined}
          active={!status}
        />
        <FilterLink
          siteId={siteId}
          label={dict.statusLabels.APPLICABLE}
          param="status"
          value="APPLICABLE"
          active={status === "APPLICABLE"}
        />
        <FilterLink
          siteId={siteId}
          label={dict.statusLabels.OPEN}
          param="status"
          value="OPEN"
          active={status === "OPEN"}
        />
        <FilterLink
          siteId={siteId}
          label={dict.statusLabels.NOT_APPLICABLE}
          param="status"
          value="NOT_APPLICABLE"
          active={status === "NOT_APPLICABLE"}
        />
      </div>

      <section className="flex flex-col gap-4">
        {rows.map(({ req, link, effectiveStatus, suggestion }) => (
          <div
            key={req.id}
            className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 text-sm"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <span className="font-technical text-xs text-foreground-subtle">
                  {req.code} ·{" "}
                  {req.domain === "OSH" ? dict.domainOsh : dict.domainEnv}
                </span>
                <h2 className="font-heading text-sm font-bold text-foreground">
                  {req.title}
                </h2>
              </div>
              <span className="rounded border border-border px-2 py-0.5 text-xs text-foreground-muted">
                {dict.statusLabels[effectiveStatus]}
              </span>
            </div>
            <p className="text-foreground-muted">{req.obligationSummary}</p>
            <p className="text-xs text-foreground-subtle">
              {dict.referenceLabel}:{" "}
              {req.legalReference ? (
                <>
                  {req.legalReference.code}{" "}
                  <a
                    href={req.legalReference.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent hover:underline"
                  >
                    {dict.sourceLink}
                  </a>
                </>
              ) : (
                dict.noReference
              )}
            </p>
            {link?.reviewRequired && (
              <p className="text-xs text-info">{dict.reviewRequiredFlag}</p>
            )}

            {/* Applicability confirmation */}
            {effectiveStatus !== "APPLICABLE" && (
              <form
                action={confirmStatusAction}
                className="flex flex-wrap items-end gap-2"
              >
                <input type="hidden" name="requirementId" value={req.id} />
                {suggestion && (
                  <span className="text-xs text-foreground-subtle">
                    {dict.suggestionLabel}:{" "}
                    {dict.statusLabels[suggestion.status]}
                  </span>
                )}
                <input
                  name="rationale"
                  placeholder={dict.rationaleLabel}
                  className="flex-1 rounded border border-border bg-background px-2 py-1"
                />
                <button
                  type="submit"
                  name="status"
                  value="APPLICABLE"
                  className="rounded bg-accent px-3 py-1 text-xs font-medium text-background"
                >
                  {dict.confirmApplicable}
                </button>
                <button
                  type="submit"
                  name="status"
                  value="NOT_APPLICABLE"
                  className="rounded border border-border px-3 py-1 text-xs hover:border-accent"
                >
                  {dict.confirmNotApplicable}
                </button>
              </form>
            )}
            {effectiveStatus === "NOT_APPLICABLE" && link?.rationale && (
              <p className="text-xs text-foreground-subtle">{link.rationale}</p>
            )}

            {/* Compliance evaluation (only when applicable) */}
            {effectiveStatus === "APPLICABLE" && link && (
              <div className="mt-1 flex flex-col gap-2 border-t border-border pt-2">
                <p className="text-xs text-foreground-subtle">
                  {dict.evaluateHeading}:{" "}
                  <span className="font-medium text-foreground">
                    {
                      dict.complianceLabels[
                        link.evaluation?.state ?? "NOT_EVALUATED"
                      ]
                    }
                  </span>
                  {link.evaluation?.nextReviewDue
                    ? ` · ${dict.nextReviewLabel} ${link.evaluation.nextReviewDue.toISOString().slice(0, 10)}`
                    : ""}
                </p>
                <form
                  action={evaluateAction}
                  className="flex flex-wrap items-end gap-2"
                >
                  <input
                    type="hidden"
                    name="siteLegalRequirementId"
                    value={link.id}
                  />
                  <select
                    name="state"
                    defaultValue={link.evaluation?.state ?? "NOT_EVALUATED"}
                    className="rounded border border-border bg-background px-2 py-1 text-xs"
                  >
                    {COMPLIANCE_STATES.map((s) => (
                      <option key={s} value={s}>
                        {dict.complianceLabels[s]}
                      </option>
                    ))}
                  </select>
                  <input
                    name="note"
                    placeholder={dict.evalNoteLabel}
                    className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs"
                  />
                  <button
                    type="submit"
                    className="rounded bg-accent px-3 py-1 text-xs font-medium text-background"
                  >
                    {dict.evaluateButton}
                  </button>
                </form>
                {link.evaluation &&
                  (link.evaluation.state === "NON_COMPLIANT" ||
                    link.evaluation.state === "PARTIALLY_COMPLIANT") && (
                    <>
                      {link.evaluation.actions.length > 0 && (
                        <p className="text-xs text-foreground-subtle">
                          {dict.actionsLabel}:{" "}
                          {link.evaluation.actions.map((a) => (
                            <Link
                              key={a.id}
                              href={`/app/s/${siteId}/actions/${a.id}`}
                              className="mr-2 text-accent hover:underline"
                            >
                              {a.title} ({a.status})
                            </Link>
                          ))}
                        </p>
                      )}
                      <form
                        action={raiseActionAction}
                        className="flex flex-wrap items-end gap-2"
                      >
                        <input
                          type="hidden"
                          name="complianceEvaluationId"
                          value={link.evaluation.id}
                        />
                        <input
                          name="title"
                          required
                          placeholder={dict.actionTitleLabel}
                          className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs"
                        />
                        <button
                          type="submit"
                          className="rounded border border-border px-3 py-1 text-xs hover:border-accent"
                        >
                          {dict.raiseButton}
                        </button>
                      </form>
                    </>
                  )}
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}

function FilterLink({
  siteId,
  label,
  param,
  value,
  active,
}: {
  siteId: string;
  label: string;
  param: "domain" | "status";
  value: string | undefined;
  active: boolean;
}) {
  const href = value
    ? `/app/s/${siteId}/legal/register?${param}=${value}`
    : `/app/s/${siteId}/legal/register`;
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded bg-accent px-2 py-0.5 text-background"
          : "rounded border border-border px-2 py-0.5 text-foreground-muted hover:border-accent"
      }
    >
      {label}
    </Link>
  );
}
