import { revalidatePath } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RiskBand, type YesNoNa } from "@/generated/prisma/enums";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import {
  addInspectionObservation,
  closeInspection,
  completeInspection,
  promoteObservationToAction,
  recordInspectionAnswer,
  reopenInspection,
  startInspection,
} from "@/lib/inspections/inspection";
import { isAnswerAnswered } from "@/lib/inspections/inspection-completeness";
import { prisma } from "@/lib/prisma";

const RISK_BANDS = Object.values(RiskBand);

// P9 §7.3 inspection run/detail. Resource-first gate: fetch, then confirm the
// inspection belongs to this site (fail-closed 404, same as requireTaskAccess).
export default async function InspectionDetailPage({
  params,
}: {
  params: Promise<{ siteId: string; inspectionId: string }>;
}) {
  const { siteId, inspectionId } = await params;
  await requireSiteAdministrationAccess(siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).inspections;

  const inspection = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    include: {
      answers: { orderBy: [{ sectionTitle: "asc" }, { order: "asc" }] },
      observations: {
        orderBy: { createdAt: "asc" },
        include: { actions: { select: { id: true, title: true } } },
      },
    },
  });
  if (!inspection || inspection.siteId !== siteId) notFound();

  const editable = inspection.status === "IN_PROGRESS";
  const total = inspection.answers.filter((a) => a.required).length;
  const done = inspection.answers.filter(
    (a) => a.required && isAnswerAnswered(a),
  ).length;

  async function startAction() {
    "use server";
    await requireSiteAdministrationAccess(siteId);
    await startInspection(inspectionId, siteId);
    revalidatePath(`/app/s/${siteId}/inspections/${inspectionId}`);
  }
  async function completeAction() {
    "use server";
    const { user: actor } = await requireSiteAdministrationAccess(siteId);
    await completeInspection(inspectionId, siteId, actor.id);
    revalidatePath(`/app/s/${siteId}/inspections/${inspectionId}`);
  }
  async function closeAction() {
    "use server";
    await requireSiteAdministrationAccess(siteId);
    await closeInspection(inspectionId, siteId);
    revalidatePath(`/app/s/${siteId}/inspections/${inspectionId}`);
  }
  async function reopenAction() {
    "use server";
    await requireSiteAdministrationAccess(siteId);
    await reopenInspection(inspectionId, siteId);
    revalidatePath(`/app/s/${siteId}/inspections/${inspectionId}`);
  }

  async function recordAnswerAction(formData: FormData) {
    "use server";
    await requireSiteAdministrationAccess(siteId);
    const answerId = formData.get("answerId");
    const answerType = formData.get("answerType");
    if (typeof answerId !== "string" || typeof answerType !== "string") return;
    const get = (k: string) => {
      const v = formData.get(k);
      return typeof v === "string" && v.length > 0 ? v : null;
    };
    await recordInspectionAnswer({
      answerId,
      siteId,
      valueYesNoNa:
        answerType === "YES_NO_NA" ? (get("value") as YesNoNa | null) : null,
      valueNumber:
        answerType === "NUMBER" || answerType === "SCALE"
          ? get("value") === null
            ? null
            : Number.parseFloat(get("value") as string)
          : null,
      valueText: answerType === "TEXT" ? get("value") : null,
      valueChoice: answerType === "CHOICE" ? get("value") : null,
      documentId: answerType === "FILE" ? get("value") : null,
    });
    revalidatePath(`/app/s/${siteId}/inspections/${inspectionId}`);
  }

  async function addObservationAction(formData: FormData) {
    "use server";
    await requireSiteAdministrationAccess(siteId);
    const description = formData.get("description");
    const severity = formData.get("severity");
    if (typeof description !== "string" || description.trim().length === 0) {
      return;
    }
    await addInspectionObservation({
      inspectionId,
      siteId,
      description,
      severity:
        typeof severity === "string" &&
        (RISK_BANDS as string[]).includes(severity)
          ? (severity as RiskBand)
          : null,
    });
    revalidatePath(`/app/s/${siteId}/inspections/${inspectionId}`);
  }

  async function promoteAction(formData: FormData) {
    "use server";
    await requireSiteAdministrationAccess(siteId);
    const observationId = formData.get("observationId");
    const title = formData.get("title");
    const roleLabel = formData.get("roleLabel");
    if (
      typeof observationId !== "string" ||
      typeof title !== "string" ||
      title.trim().length === 0
    ) {
      return;
    }
    await promoteObservationToAction({
      observationId,
      siteId,
      title,
      responsibleRoleLabel: typeof roleLabel === "string" ? roleLabel : null,
    });
    revalidatePath(`/app/s/${siteId}/inspections/${inspectionId}`);
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
      <div>
        <Link
          href={`/app/s/${siteId}/inspections/planned`}
          className="text-sm text-accent hover:underline"
        >
          {dict.back}
        </Link>
        <h1 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-bold text-foreground">
          {inspection.title}
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">
          {dict.typeLabels[inspection.type]} ·{" "}
          {dict.statusLabels[inspection.status]} ·{" "}
          {dict.progress
            .replace("{done}", String(done))
            .replace("{total}", String(total))}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {inspection.status === "PLANNED" && (
          <form action={startAction}>
            <button
              type="submit"
              className="rounded-[var(--radius-md)] bg-accent px-4 py-2 text-sm font-medium text-background"
            >
              {dict.start}
            </button>
          </form>
        )}
        {inspection.status === "IN_PROGRESS" && (
          <form action={completeAction}>
            <button
              type="submit"
              disabled={done < total}
              className="rounded-[var(--radius-md)] bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
            >
              {dict.complete}
            </button>
          </form>
        )}
        {inspection.status === "COMPLETED" && (
          <>
            <form action={closeAction}>
              <button
                type="submit"
                className="rounded-[var(--radius-md)] bg-accent px-4 py-2 text-sm font-medium text-background"
              >
                {dict.close}
              </button>
            </form>
            <form action={reopenAction}>
              <button
                type="submit"
                className="rounded border border-border px-4 py-2 text-sm hover:border-accent"
              >
                {dict.reopen}
              </button>
            </form>
          </>
        )}
      </div>
      {inspection.status === "IN_PROGRESS" && done < total && (
        <p className="text-xs text-foreground-subtle">{dict.completeBlocked}</p>
      )}

      <section className="flex flex-col gap-4">
        {inspection.answers.map((a) => (
          <div
            key={a.id}
            className="rounded-lg border border-border bg-surface p-3"
          >
            <p className="text-xs uppercase tracking-wide text-foreground-subtle">
              {a.sectionTitle}
            </p>
            <p className="text-sm text-foreground">
              {a.prompt}
              {a.required ? " *" : ""}
              {a.unit ? ` (${a.unit})` : ""}
            </p>
            {editable ? (
              <form
                action={recordAnswerAction}
                className="mt-2 flex items-center gap-2 text-sm"
              >
                <input type="hidden" name="answerId" value={a.id} />
                <input type="hidden" name="answerType" value={a.answerType} />
                {a.answerType === "YES_NO_NA" && (
                  <select
                    name="value"
                    defaultValue={a.valueYesNoNa ?? ""}
                    className="rounded border border-border bg-background px-2 py-1"
                  >
                    <option value="">{dict.choosePlaceholder}</option>
                    <option value="YES">{dict.answerYes}</option>
                    <option value="NO">{dict.answerNo}</option>
                    <option value="NA">{dict.answerNa}</option>
                  </select>
                )}
                {(a.answerType === "NUMBER" || a.answerType === "SCALE") && (
                  <input
                    type="number"
                    step="any"
                    name="value"
                    defaultValue={a.valueNumber ?? ""}
                    className="w-32 rounded border border-border bg-background px-2 py-1"
                  />
                )}
                {a.answerType === "TEXT" && (
                  <input
                    name="value"
                    defaultValue={a.valueText ?? ""}
                    className="flex-1 rounded border border-border bg-background px-2 py-1"
                  />
                )}
                {a.answerType === "CHOICE" && (
                  <select
                    name="value"
                    defaultValue={a.valueChoice ?? ""}
                    className="rounded border border-border bg-background px-2 py-1"
                  >
                    <option value="">{dict.choosePlaceholder}</option>
                    {a.choiceOptions.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                )}
                {a.answerType === "FILE" && (
                  <input
                    name="value"
                    defaultValue={a.documentId ?? ""}
                    placeholder="document id"
                    className="flex-1 rounded border border-border bg-background px-2 py-1"
                  />
                )}
                <button
                  type="submit"
                  className="rounded border border-border px-2 py-1 text-xs hover:border-accent"
                >
                  {dict.saveAnswer}
                </button>
              </form>
            ) : (
              <p className="mt-1 text-sm font-medium text-foreground">
                {describeAnswer(a, dict)}
              </p>
            )}
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-sm font-bold">
          {dict.observationsHeading}
        </h2>
        <p className="text-xs text-foreground-subtle">{dict.photoNotice}</p>
        {inspection.observations.length === 0 ? (
          <p className="text-sm text-foreground-muted">
            {dict.observationsEmpty}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {inspection.observations.map((o) => (
              <li
                key={o.id}
                className="rounded-lg border border-border bg-surface p-3 text-sm"
              >
                <p className="text-foreground">
                  {o.description}
                  {o.severity ? (
                    <span className="ml-2 rounded bg-status-high/15 px-1.5 py-0.5 text-xs text-status-high">
                      {o.severity}
                    </span>
                  ) : null}
                </p>
                {o.actions.length > 0 ? (
                  <p className="mt-1 text-xs text-foreground-subtle">
                    {dict.promotedActionLabel}:{" "}
                    {o.actions.map((x) => x.title).join(", ")}
                  </p>
                ) : (
                  <form
                    action={promoteAction}
                    className="mt-2 flex flex-wrap items-end gap-2"
                  >
                    <input type="hidden" name="observationId" value={o.id} />
                    <input
                      name="title"
                      required
                      placeholder={dict.actionTitleLabel}
                      className="flex-1 rounded border border-border bg-background px-2 py-1"
                    />
                    <button
                      type="submit"
                      className="rounded border border-border px-2 py-1 text-xs hover:border-accent"
                    >
                      {dict.promoteButton}
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}

        {inspection.status !== "CLOSED" && (
          <form
            action={addObservationAction}
            className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface p-3 text-sm"
          >
            <label className="flex flex-1 flex-col gap-1">
              {dict.descriptionLabel}
              <input
                name="description"
                required
                className="rounded border border-border bg-background px-2 py-1"
              />
            </label>
            <label className="flex flex-col gap-1">
              {dict.severityLabel}
              <select
                name="severity"
                className="rounded border border-border bg-background px-2 py-1"
              >
                <option value="">{dict.choosePlaceholder}</option>
                {RISK_BANDS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="rounded-[var(--radius-md)] bg-accent px-3 py-2 font-medium text-background"
            >
              {dict.addObservation}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}

function describeAnswer(
  a: {
    answerType: string;
    valueYesNoNa: YesNoNa | null;
    valueNumber: number | null;
    valueText: string | null;
    valueChoice: string | null;
    documentId: string | null;
  },
  dict: { answerYes: string; answerNo: string; answerNa: string; none: string },
): string {
  switch (a.answerType) {
    case "YES_NO_NA":
      return a.valueYesNoNa === "YES"
        ? dict.answerYes
        : a.valueYesNoNa === "NO"
          ? dict.answerNo
          : a.valueYesNoNa === "NA"
            ? dict.answerNa
            : dict.none;
    case "NUMBER":
    case "SCALE":
      return a.valueNumber !== null ? String(a.valueNumber) : dict.none;
    case "TEXT":
      return a.valueText ?? dict.none;
    case "CHOICE":
      return a.valueChoice ?? dict.none;
    case "FILE":
      return a.documentId ?? dict.none;
    default:
      return dict.none;
  }
}
