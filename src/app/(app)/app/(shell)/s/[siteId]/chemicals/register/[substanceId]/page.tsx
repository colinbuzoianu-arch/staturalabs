import { revalidatePath } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  type ExposureRoute,
  GhsPictogram,
  type SubstanceQuantityClass,
  type SubstanceStatementKind,
} from "@/generated/prisma/enums";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import { substanceSdsAlerts } from "@/lib/chemicals/alerts";
import {
  addSdsVersion,
  addSubstanceStatement,
  addSubstanceUse,
  endSubstanceUse,
  setSubstancePictograms,
  setSubstitutionCheck,
} from "@/lib/chemicals/substance";
import {
  DocumentScanError,
  uploadNewDocument,
} from "@/lib/documents/upload-document";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";

const ALL_PICTOGRAMS = Object.values(GhsPictogram);
const QUANTITY_CLASSES: SubstanceQuantityClass[] = ["XS", "S", "M", "L", "XL"];
const EXPOSURE_ROUTES: ExposureRoute[] = [
  "INHALATION",
  "DERMAL",
  "ORAL",
  "EYE",
];

export default async function SubstanceDetailPage({
  params,
}: {
  params: Promise<{ siteId: string; substanceId: string }>;
}) {
  const { siteId, substanceId } = await params;
  const { site } = await requireSiteAdministrationAccess(siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).chemicals;
  const companyId = site.companyId;

  const substance = await prisma.substance.findUnique({
    where: { id: substanceId },
    include: {
      pictograms: true,
      statements: { orderBy: { code: "asc" } },
      safetyDataSheets: { orderBy: { revisionDate: "desc" } },
      uses: {
        include: {
          workstation: { select: { name: true } },
          process: { select: { name: true } },
          orgUnit: { select: { name: true } },
        },
        orderBy: { activeFrom: "desc" },
      },
      findingLinks: {
        include: { riskFinding: { include: { hazard: true } } },
      },
    },
  });
  if (!substance || substance.companyId !== companyId) notFound();

  async function savePictogramsAction(formData: FormData) {
    "use server";
    const { site: s } = await requireSiteAdministrationAccess(siteId);
    const picks = formData
      .getAll("pictograms")
      .filter((v): v is string => typeof v === "string") as GhsPictogram[];
    await setSubstancePictograms(substanceId, s.companyId, picks);
    revalidatePath(`/app/s/${siteId}/chemicals/register/${substanceId}`);
  }

  async function addStatementAction(formData: FormData) {
    "use server";
    const { site: s } = await requireSiteAdministrationAccess(siteId);
    const d = getAdministrationDictionary(await getLocale()).chemicals;
    const kind = formData.get("kind");
    const code = formData.get("code");
    const text = formData.get("text");
    if (typeof kind !== "string" || typeof code !== "string") return;
    try {
      await addSubstanceStatement({
        substanceId,
        companyId: s.companyId,
        kind: kind as SubstanceStatementKind,
        code,
        text: typeof text === "string" ? text : null,
      });
    } catch {
      throw new Error(d.statementCodeInvalid);
    }
    revalidatePath(`/app/s/${siteId}/chemicals/register/${substanceId}`);
  }

  async function saveSubstitutionAction(formData: FormData) {
    "use server";
    const { site: s } = await requireSiteAdministrationAccess(siteId);
    await setSubstitutionCheck({
      substanceId,
      companyId: s.companyId,
      done: formData.get("done") === "on",
      note:
        typeof formData.get("note") === "string"
          ? (formData.get("note") as string)
          : null,
    });
    revalidatePath(`/app/s/${siteId}/chemicals/register/${substanceId}`);
  }

  async function addSdsAction(formData: FormData) {
    "use server";
    const { user, site: s } = await requireSiteAdministrationAccess(siteId);
    const revisionRaw = formData.get("revisionDate");
    const language = formData.get("language");
    if (
      typeof revisionRaw !== "string" ||
      revisionRaw.trim().length === 0 ||
      typeof language !== "string" ||
      language.trim().length === 0
    ) {
      return;
    }
    let documentId: string | null = null;
    const file = formData.get("file");
    if (file instanceof File && file.size > 0) {
      const buffer = Buffer.from(await file.arrayBuffer());
      try {
        const doc = await uploadNewDocument({
          companyId: s.companyId,
          siteId,
          category: "SDS",
          title: `SDS: ${substance?.tradeName ?? substanceId}`,
          reviewDueDate: null,
          fileName: file.name,
          declaredMime: file.type || "application/octet-stream",
          buffer,
          userId: user.id,
        });
        documentId = doc.id;
      } catch (error) {
        if (error instanceof DocumentScanError) {
          const docDict = getAdministrationDictionary(
            await getLocale(),
          ).documentsPage;
          throw new Error(
            docDict.scanReasons[
              error.reason as keyof typeof docDict.scanReasons
            ] ?? docDict.scanReasons.other,
          );
        }
        throw error;
      }
    }
    const versionRaw = formData.get("version");
    const supplierRaw = formData.get("supplier");
    await addSdsVersion({
      substanceId,
      companyId: s.companyId,
      version: typeof versionRaw === "string" ? versionRaw : null,
      revisionDate: new Date(revisionRaw),
      language,
      supplier: typeof supplierRaw === "string" ? supplierRaw : null,
      documentId,
    });
    revalidatePath(`/app/s/${siteId}/chemicals/register/${substanceId}`);
  }

  async function addUseAction(formData: FormData) {
    "use server";
    const { site: s } = await requireSiteAdministrationAccess(siteId);
    const subjectValue = formData.get("subject");
    const purpose = formData.get("purpose");
    const quantity = formData.get("quantityClass");
    if (
      typeof subjectValue !== "string" ||
      !subjectValue.includes(":") ||
      typeof purpose !== "string" ||
      purpose.trim().length === 0
    ) {
      return;
    }
    const [kind, id] = subjectValue.split(":");
    const routes = formData
      .getAll("exposureRoutes")
      .filter((v): v is string => typeof v === "string") as ExposureRoute[];
    await addSubstanceUse({
      substanceId,
      companyId: s.companyId,
      siteId,
      workstationId: kind === "workstation" ? id : null,
      processId: kind === "process" ? id : null,
      orgUnitId: kind === "orgunit" ? id : null,
      purpose,
      quantityClass: (QUANTITY_CLASSES as string[]).includes(quantity as string)
        ? (quantity as SubstanceQuantityClass)
        : "S",
      exposureRoutes: routes,
      activeFrom: new Date(),
    });
    revalidatePath(`/app/s/${siteId}/chemicals/register/${substanceId}`);
  }

  async function endUseAction(formData: FormData) {
    "use server";
    const { site: s } = await requireSiteAdministrationAccess(siteId);
    const id = formData.get("useId");
    if (typeof id === "string" && id.length > 0) {
      await endSubstanceUse(id, s.companyId);
    }
    revalidatePath(`/app/s/${siteId}/chemicals/register/${substanceId}`);
  }

  const [workstations, orgUnits, processes] = await Promise.all([
    prisma.workstation.findMany({
      where: { site: { companyId } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.orgUnit.findMany({
      where: { site: { companyId } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.process.findMany({
      where: { site: { companyId } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const pickedPictograms = new Set(
    substance.pictograms.map((p) => p.pictogram),
  );
  const alerts = substanceSdsAlerts({
    hasActiveUse: substance.uses.some((u) => u.activeTo === null),
    sdsList: substance.safetyDataSheets,
    siteRequiresDe: site.country === "AT" || site.country === "DE",
    now: new Date(),
    staleYears: 2,
  });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
      <div>
        <Link
          href={`/app/s/${siteId}/chemicals/register`}
          className="text-sm text-accent hover:underline"
        >
          {dict.back}
        </Link>
        <h1 className="mt-1 font-[family-name:var(--font-heading)] text-2xl font-bold text-foreground">
          {substance.tradeName}
        </h1>
        {alerts.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {alerts.map((a) => (
              <span
                key={a}
                className="rounded bg-status-high/15 px-1.5 py-0.5 text-xs text-status-high"
              >
                {dict.alertLabels[a]}
              </span>
            ))}
          </div>
        )}
      </div>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 text-sm">
        <h2 className="font-heading text-sm font-bold">
          {dict.classificationHeading}
        </h2>
        <form action={savePictogramsAction} className="flex flex-col gap-2">
          <span className="font-medium">{dict.pictogramsLabel}</span>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {ALL_PICTOGRAMS.map((p) => (
              <label key={p} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  name="pictograms"
                  value={p}
                  defaultChecked={pickedPictograms.has(p)}
                />
                {p} {dict.ghsPictogramLabels[p]}
              </label>
            ))}
          </div>
          <button
            type="submit"
            className="self-start rounded border border-border px-2 py-1 text-xs hover:border-accent"
          >
            {dict.savePictograms}
          </button>
        </form>

        <div className="flex flex-col gap-1">
          <span className="font-medium">{dict.statementsHeading}</span>
          {substance.statements.length === 0 ? (
            <p className="text-foreground-muted">{dict.statementsEmpty}</p>
          ) : (
            <ul className="flex flex-wrap gap-x-3">
              {substance.statements.map((st) => (
                <li key={st.id} className="text-foreground-muted">
                  {st.code}
                  {st.text ? ` — ${st.text}` : ""}
                </li>
              ))}
            </ul>
          )}
          <form
            action={addStatementAction}
            className="mt-1 flex flex-wrap items-end gap-2"
          >
            <select
              name="kind"
              className="rounded border border-border bg-background px-2 py-1"
            >
              <option value="H">{dict.statementKindLabels.H}</option>
              <option value="P">{dict.statementKindLabels.P}</option>
              <option value="EUH">{dict.statementKindLabels.EUH}</option>
            </select>
            <input
              name="code"
              placeholder={dict.statementCodeLabel}
              className="w-28 rounded border border-border bg-background px-2 py-1"
            />
            <input
              name="text"
              placeholder={dict.statementTextLabel}
              className="rounded border border-border bg-background px-2 py-1"
            />
            <button
              type="submit"
              className="rounded border border-border px-2 py-1 text-xs hover:border-accent"
            >
              {dict.addStatementButton}
            </button>
          </form>
        </div>

        <form action={saveSubstitutionAction} className="flex flex-col gap-1">
          <span className="font-medium">{dict.substitutionHeading}</span>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="done"
              defaultChecked={substance.substitutionCheckDone}
            />
            {dict.substitutionDone}
          </label>
          <input
            name="note"
            placeholder={dict.substitutionNote}
            defaultValue={substance.substitutionCheckNote ?? ""}
            className="rounded border border-border bg-background px-2 py-1"
          />
          <button
            type="submit"
            className="self-start rounded border border-border px-2 py-1 text-xs hover:border-accent"
          >
            {dict.saveSubstitution}
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 text-sm">
        <h2 className="font-heading text-sm font-bold">{dict.sdsHeading}</h2>
        <form action={addSdsAction} className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            {dict.sdsRevisionDateLabel}
            <input
              type="date"
              name="revisionDate"
              required
              className="rounded border border-border bg-background px-2 py-1"
            />
          </label>
          <label className="flex flex-col gap-1">
            {dict.sdsLanguageLabel}
            <input
              name="language"
              required
              defaultValue="de"
              className="w-20 rounded border border-border bg-background px-2 py-1"
            />
          </label>
          <label className="flex flex-col gap-1">
            {dict.sdsVersionLabel}
            <input
              name="version"
              className="w-24 rounded border border-border bg-background px-2 py-1"
            />
          </label>
          <label className="flex flex-col gap-1">
            {dict.sdsSupplierLabel}
            <input
              name="supplier"
              className="rounded border border-border bg-background px-2 py-1"
            />
          </label>
          <label className="flex flex-col gap-1">
            {dict.sdsFileLabel}
            <input type="file" name="file" accept=".pdf" />
          </label>
          <button
            type="submit"
            className="rounded border border-border px-2 py-1 text-xs hover:border-accent"
          >
            {dict.addSds}
          </button>
        </form>
        {substance.safetyDataSheets.length === 0 ? (
          <p className="text-foreground-muted">{dict.sdsEmpty}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {substance.safetyDataSheets.map((s) => (
              <li key={s.id} className="text-foreground-muted">
                {s.revisionDate.toISOString().slice(0, 10)} · {s.language}
                {s.version ? ` · v${s.version}` : ""} ·{" "}
                {s.supersededAt ? dict.sdsSupersededTag : dict.sdsCurrentTag}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 text-sm">
        <h2 className="font-heading text-sm font-bold">{dict.usesHeading}</h2>
        <form action={addUseAction} className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            {dict.useSubjectLabel}
            <select
              name="subject"
              className="rounded border border-border bg-background px-2 py-1"
            >
              <optgroup label="Arbeitsplatz">
                {workstations.map((w) => (
                  <option key={`w-${w.id}`} value={`workstation:${w.id}`}>
                    {w.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Prozess">
                {processes.map((p) => (
                  <option key={`p-${p.id}`} value={`process:${p.id}`}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Organisationseinheit">
                {orgUnits.map((o) => (
                  <option key={`o-${o.id}`} value={`orgunit:${o.id}`}>
                    {o.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            {dict.usePurposeLabel}
            <input
              name="purpose"
              className="rounded border border-border bg-background px-2 py-1"
            />
          </label>
          <label className="flex flex-col gap-1">
            {dict.useQuantityLabel}
            <select
              name="quantityClass"
              className="rounded border border-border bg-background px-2 py-1"
            >
              {QUANTITY_CLASSES.map((q) => (
                <option key={q} value={q}>
                  {dict.quantityClassLabels[q]}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="flex items-end gap-2">
            {EXPOSURE_ROUTES.map((r) => (
              <label key={r} className="flex items-center gap-1">
                <input type="checkbox" name="exposureRoutes" value={r} />
                {dict.exposureRouteLabels[r]}
              </label>
            ))}
          </fieldset>
          <button
            type="submit"
            className="rounded border border-border px-2 py-1 text-xs hover:border-accent"
          >
            {dict.addUseButton}
          </button>
        </form>
        {substance.uses.length === 0 ? (
          <p className="text-foreground-muted">{dict.usesEmpty}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {substance.uses.map((u) => (
              <li
                key={u.id}
                className="flex items-center justify-between gap-3"
              >
                <span className="text-foreground-muted">
                  {u.workstation?.name ??
                    u.process?.name ??
                    u.orgUnit?.name ??
                    dict.none}{" "}
                  · {u.purpose} · {dict.quantityClassLabels[u.quantityClass]}
                  {u.activeTo
                    ? ` · (${u.activeTo.toISOString().slice(0, 10)})`
                    : ""}
                </span>
                {u.activeTo === null && (
                  <form action={endUseAction}>
                    <input type="hidden" name="useId" value={u.id} />
                    <button
                      type="submit"
                      className="text-xs text-foreground-subtle hover:text-accent hover:underline"
                    >
                      {dict.endUse}
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-heading text-sm font-bold">
          {dict.findingsHeading}
        </h2>
        {substance.findingLinks.length === 0 ? (
          <p className="text-sm text-foreground-muted">{dict.findingsEmpty}</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm text-foreground-muted">
            {substance.findingLinks.map((l) => (
              <li key={l.id}>{l.riskFinding.hazard.name}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
