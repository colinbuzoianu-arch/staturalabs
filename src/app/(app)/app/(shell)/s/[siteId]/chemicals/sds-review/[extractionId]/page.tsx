import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isGefahrstoffeAiAvailable } from "@/lib/ai/anthropic";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import {
  confirmSdsExtraction,
  getPreviousConfirmedSds,
} from "@/lib/chemicals/sds-confirm";
import { checkSdsConsistency } from "@/lib/chemicals/sds-consistency";
import { explainSdsHints } from "@/lib/chemicals/sds-consistency-ai";
import { rejectSdsExtraction } from "@/lib/chemicals/sds-extraction";
import {
  buildConfirmedPayload,
  type ConfirmedSdsData,
  type Field,
  normalizeSdsExtraction,
  type SdsExtractionResult,
} from "@/lib/chemicals/sds-extraction-schema";
import { diffSdsRevisions } from "@/lib/chemicals/sds-revision-diff";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";

type Dict = ReturnType<
  typeof getAdministrationDictionary
>["chemicals"]["sdsReview"];

// Parse a revision-date string (ISO or DD.MM.YYYY) into a yyyy-mm-dd value for
// the <input type="date"> default. Returns "" when it can't be parsed — never guesses.
function toDateInput(raw: string | null): string {
  if (!raw) return "";
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw.trim());
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = /^(\d{1,2})[./](\d{1,2})[./](\d{4})/.exec(raw.trim());
  if (dmy)
    return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  return "";
}

function evidenceText(
  f: Field<string> | Field<string[]>,
  dict: Dict,
): string | null {
  if (f.page == null && !f.snippet) return null;
  const page = f.page != null ? `${dict.evidence}${f.page}` : "";
  const snippet = f.snippet ? ` · ${f.snippet}` : "";
  return (page + snippet).trim() || null;
}

function TextField({
  label,
  name,
  f,
  dict,
}: {
  label: string;
  name: string;
  f: Field<string>;
  dict: Dict;
}) {
  const ev = evidenceText(f, dict);
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-xs text-foreground-subtle">{label}</span>
      <input
        name={name}
        defaultValue={f.value ?? ""}
        className="rounded border border-border bg-background px-2 py-1 text-sm"
      />
      {ev && <span className="text-[10px] text-foreground-subtle">{ev}</span>}
    </label>
  );
}

export default async function SdsReviewDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string; extractionId: string }>;
  searchParams: Promise<{ substanceId?: string }>;
}) {
  const { siteId, extractionId } = await params;
  const { site } = await requireSiteAdministrationAccess(siteId);
  const { substanceId: preselected } = await searchParams;
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).chemicals.sdsReview;
  const companyId = site.companyId;

  const extraction = await prisma.sdsExtraction.findFirst({
    where: { id: extractionId, companyId },
    select: {
      id: true,
      status: true,
      fileName: true,
      extractedData: true,
      errorMessage: true,
    },
  });
  if (!extraction) notFound();

  const result: SdsExtractionResult = normalizeSdsExtraction(
    extraction.extractedData,
  );
  const substances = await prisma.substance.findMany({
    where: { companyId },
    orderBy: { tradeName: "asc" },
    select: { id: true, tradeName: true },
  });

  // Preview diff against the selected substance's previous SDS.
  const prev = preselected
    ? await getPreviousConfirmedSds(preselected, companyId)
    : null;
  const confirmedPreview = buildConfirmedPayload(result);
  const changes = prev ? diffSdsRevisions(prev, confirmedPreview) : [];

  // S3 deterministic consistency checks — always shown; the AI (when enabled)
  // only explains them, never changes them.
  const siteRequiresDe = site.country === "AT" || site.country === "DE";
  const hints = checkSdsConsistency(confirmedPreview, {
    siteRequiresDe,
    now: new Date(),
    staleYears: 3,
  });
  const hintExplanations =
    hints.length > 0 && (await isGefahrstoffeAiAvailable(companyId))
      ? await explainSdsHints(hints, confirmedPreview, companyId)
      : {};

  async function confirmAction(formData: FormData) {
    "use server";
    const { site: s, user } = await requireSiteAdministrationAccess(siteId);
    const d = getAdministrationDictionary(await getLocale()).chemicals
      .sdsReview;
    const substanceId = formData.get("substanceId");
    if (typeof substanceId !== "string" || !substanceId)
      throw new Error(d.substanceRequired);
    const revisionRaw = formData.get("revisionDate");
    if (typeof revisionRaw !== "string" || !revisionRaw)
      throw new Error(d.revisionRequired);
    const revisionDate = new Date(revisionRaw);
    if (Number.isNaN(revisionDate.getTime()))
      throw new Error(d.revisionRequired);

    const g = (k: string) => {
      const v = formData.get(k);
      return typeof v === "string" && v.trim() ? v.trim() : null;
    };
    const list = (k: string) =>
      (g(k) ?? "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
    const count = Number(formData.get("componentCount") ?? 0);
    const components: ConfirmedSdsData["components"] = [];
    for (let i = 0; i < count; i++) {
      const name = g(`comp_${i}_name`);
      if (!name) continue;
      components.push({
        name,
        casNumber: g(`comp_${i}_casNumber`),
        ecNumber: g(`comp_${i}_ecNumber`),
        concentration: g(`comp_${i}_concentration`),
        classification: g(`comp_${i}_classification`),
        specificConcentrationLimits: null,
        mFactor: null,
        acuteToxicityEstimate: null,
      });
    }

    const confirmed: ConfirmedSdsData = {
      ...buildConfirmedPayload(result),
      productIdentifier: g("productIdentifier"),
      ufi: g("ufi"),
      supplier: g("supplier"),
      emergencyPhone: g("emergencyPhone"),
      version: g("version"),
      language: g("language"),
      revisionDate: revisionRaw,
      classification: g("classification"),
      signalWord: g("signalWord"),
      pictograms: list("pictograms"),
      statementCodes: list("statementCodes"),
      components,
      flashPoint: g("flashPoint"),
      boilingPoint: g("boilingPoint"),
      density: g("density"),
      vapourPressure: g("vapourPressure"),
      ph: g("ph"),
      physicalState: g("physicalState"),
      unNumber: g("unNumber"),
      properShippingName: g("properShippingName"),
      transportClass: g("transportClass"),
      packingGroup: g("packingGroup"),
      adrRid: g("adrRid"),
      imdg: g("imdg"),
      iata: g("iata"),
      marinePollutant: g("marinePollutant"),
      wgk: g("wgk"),
      lagerklasse: g("lagerklasse"),
      section4FirstAid: g("section4FirstAid"),
      section5FireFighting: g("section5FireFighting"),
      section6AccidentalRelease: g("section6AccidentalRelease"),
      section7HandlingStorage: g("section7HandlingStorage"),
      section13Disposal: g("section13Disposal"),
    };

    await confirmSdsExtraction({
      extractionId,
      companyId: s.companyId,
      substanceId,
      actorUserId: user.id,
      revisionDate,
      confirmed,
    });
    redirect(`/app/s/${siteId}/chemicals/register/${substanceId}`);
  }

  async function rejectAction() {
    "use server";
    const { site: s, user } = await requireSiteAdministrationAccess(siteId);
    await rejectSdsExtraction({
      extractionId,
      companyId: s.companyId,
      actorUserId: user.id,
    });
    redirect(`/app/s/${siteId}/chemicals/sds-review`);
  }

  const back = (
    <Link
      href={`/app/s/${siteId}/chemicals/sds-review`}
      className="text-sm text-accent hover:underline"
    >
      {dict.back}
    </Link>
  );

  if (extraction.status !== "PENDING_REVIEW") {
    const notice =
      extraction.status === "CONFIRMED"
        ? dict.confirmedNotice
        : extraction.status === "REJECTED"
          ? dict.rejectedNotice
          : dict.failedNotice;
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-4 px-6 py-10">
        {back}
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-foreground">
          {extraction.fileName ?? dict.heading}
        </h1>
        <p className="rounded border border-border bg-surface p-3 text-sm text-foreground-muted">
          {notice}
          {extraction.errorMessage ? ` — ${extraction.errorMessage}` : ""}
        </p>
      </div>
    );
  }

  const inputCls =
    "rounded border border-border bg-background px-2 py-1 text-sm";
  const sectionCls =
    "flex flex-col gap-3 rounded-lg border border-border bg-surface p-4";
  const gridCls = "grid grid-cols-1 gap-3 sm:grid-cols-2";

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
      {back}
      <div>
        <p className="font-technical text-xs uppercase tracking-[0.2em] text-foreground-subtle">
          {dict.eyebrow}
        </p>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-foreground">
          {dict.reviewHeading}
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">{dict.reviewIntro}</p>
      </div>

      {hints.length > 0 && (
        <section className={sectionCls}>
          <h2 className="font-heading text-sm font-bold">
            {dict.hints.heading}
          </h2>
          <p className="text-xs text-foreground-muted">{dict.hints.intro}</p>
          <ul className="flex flex-col gap-2 text-sm">
            {hints.map((h) => (
              <li
                key={h.code}
                className="flex flex-col gap-0.5 border-t border-border pt-2 first:border-0 first:pt-0"
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      h.severity === "warning"
                        ? "bg-coral/15 text-coral"
                        : "bg-info/15 text-info"
                    }`}
                  >
                    {h.severity === "warning"
                      ? dict.hints.severityWarning
                      : dict.hints.severityInfo}
                  </span>
                  <span>{dict.hints.reasons[h.code]}</span>
                </span>
                {hintExplanations[h.code] && (
                  <span className="pl-1 text-xs text-foreground-muted">
                    <span className="text-foreground-subtle">
                      {dict.hints.aiNote}:{" "}
                    </span>
                    {hintExplanations[h.code]}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {preselected && (
        <section className={sectionCls}>
          <h2 className="font-heading text-sm font-bold">{dict.diffHeading}</h2>
          {changes.length === 0 ? (
            <p className="text-sm text-foreground-muted">{dict.diffEmpty}</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {changes.map((c, i) => (
                <li key={`${c.field}-${i}`} className="flex gap-2">
                  <span className="font-medium">{c.field}</span>
                  <span className="text-foreground-subtle">
                    {c.kind === "changed"
                      ? `${dict.diffChanged}: ${c.before ?? "—"} → ${c.after ?? "—"}`
                      : c.kind === "added"
                        ? `${dict.diffAdded}: ${c.after}`
                        : `${dict.diffRemoved}: ${c.before}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <form action={confirmAction} className="flex flex-col gap-6">
        <input
          type="hidden"
          name="componentCount"
          value={result.components.length}
        />

        <section className={sectionCls}>
          <h2 className="font-heading text-sm font-bold">
            {dict.sectionProduct}
          </h2>
          <div className={gridCls}>
            <TextField
              label={dict.fields.productIdentifier}
              name="productIdentifier"
              f={result.productIdentifier}
              dict={dict}
            />
            <TextField
              label={dict.fields.supplier}
              name="supplier"
              f={result.supplier}
              dict={dict}
            />
            <TextField
              label={dict.fields.emergencyPhone}
              name="emergencyPhone"
              f={result.emergencyPhone}
              dict={dict}
            />
            <TextField
              label={dict.fields.ufi}
              name="ufi"
              f={result.ufi}
              dict={dict}
            />
            <TextField
              label={dict.fields.version}
              name="version"
              f={result.version}
              dict={dict}
            />
            <TextField
              label={dict.fields.language}
              name="language"
              f={result.language}
              dict={dict}
            />
          </div>
        </section>

        <section className={sectionCls}>
          <h2 className="font-heading text-sm font-bold">
            {dict.sectionClassification}
          </h2>
          <div className={gridCls}>
            <TextField
              label={dict.fields.classification}
              name="classification"
              f={result.classification}
              dict={dict}
            />
            <TextField
              label={dict.fields.signalWord}
              name="signalWord"
              f={result.signalWord}
              dict={dict}
            />
            <label className="flex flex-col gap-0.5">
              <span className="text-xs text-foreground-subtle">
                {dict.fields.pictograms}
              </span>
              <input
                name="pictograms"
                defaultValue={(result.pictograms.value ?? []).join(", ")}
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-xs text-foreground-subtle">
                {dict.fields.statementCodes}
              </span>
              <input
                name="statementCodes"
                defaultValue={(result.statementCodes.value ?? []).join(", ")}
                className={inputCls}
              />
            </label>
          </div>
        </section>

        <section className={sectionCls}>
          <h2 className="font-heading text-sm font-bold">
            {dict.sectionComponents}
          </h2>
          {result.components.length === 0 ? (
            <p className="text-sm text-foreground-muted">—</p>
          ) : (
            result.components.map((c, i) => {
              const rowKey = `${c.casNumber.value ?? c.name.value ?? "comp"}-${i}`;
              return (
                <div
                  key={rowKey}
                  className="grid grid-cols-2 gap-2 border-t border-border pt-2 first:border-0 first:pt-0 sm:grid-cols-5"
                >
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-foreground-subtle">
                      {dict.fields.compName}
                    </span>
                    <input
                      name={`comp_${i}_name`}
                      defaultValue={c.name.value ?? ""}
                      className={inputCls}
                    />
                  </label>
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-foreground-subtle">
                      {dict.fields.compCas}
                    </span>
                    <input
                      name={`comp_${i}_casNumber`}
                      defaultValue={c.casNumber.value ?? ""}
                      className={inputCls}
                    />
                  </label>
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-foreground-subtle">
                      {dict.fields.compEc}
                    </span>
                    <input
                      name={`comp_${i}_ecNumber`}
                      defaultValue={c.ecNumber.value ?? ""}
                      className={inputCls}
                    />
                  </label>
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-foreground-subtle">
                      {dict.fields.compConcentration}
                    </span>
                    <input
                      name={`comp_${i}_concentration`}
                      defaultValue={c.concentration.value ?? ""}
                      className={inputCls}
                    />
                  </label>
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-foreground-subtle">
                      {dict.fields.compClassification}
                    </span>
                    <input
                      name={`comp_${i}_classification`}
                      defaultValue={c.classification.value ?? ""}
                      className={inputCls}
                    />
                  </label>
                </div>
              );
            })
          )}
        </section>

        <section className={sectionCls}>
          <h2 className="font-heading text-sm font-bold">
            {dict.sectionPhysical}
          </h2>
          <div className={gridCls}>
            <TextField
              label={dict.fields.flashPoint}
              name="flashPoint"
              f={result.flashPoint}
              dict={dict}
            />
            <TextField
              label={dict.fields.boilingPoint}
              name="boilingPoint"
              f={result.boilingPoint}
              dict={dict}
            />
            <TextField
              label={dict.fields.density}
              name="density"
              f={result.density}
              dict={dict}
            />
            <TextField
              label={dict.fields.vapourPressure}
              name="vapourPressure"
              f={result.vapourPressure}
              dict={dict}
            />
            <TextField
              label={dict.fields.ph}
              name="ph"
              f={result.ph}
              dict={dict}
            />
            <TextField
              label={dict.fields.physicalState}
              name="physicalState"
              f={result.physicalState}
              dict={dict}
            />
          </div>
        </section>

        <section className={sectionCls}>
          <h2 className="font-heading text-sm font-bold">
            {dict.sectionTransport}
          </h2>
          <div className={gridCls}>
            <TextField
              label={dict.fields.unNumber}
              name="unNumber"
              f={result.unNumber}
              dict={dict}
            />
            <TextField
              label={dict.fields.properShippingName}
              name="properShippingName"
              f={result.properShippingName}
              dict={dict}
            />
            <TextField
              label={dict.fields.transportClass}
              name="transportClass"
              f={result.transportClass}
              dict={dict}
            />
            <TextField
              label={dict.fields.packingGroup}
              name="packingGroup"
              f={result.packingGroup}
              dict={dict}
            />
            <TextField
              label={dict.fields.adrRid}
              name="adrRid"
              f={result.adrRid}
              dict={dict}
            />
            <TextField
              label={dict.fields.imdg}
              name="imdg"
              f={result.imdg}
              dict={dict}
            />
            <TextField
              label={dict.fields.iata}
              name="iata"
              f={result.iata}
              dict={dict}
            />
            <TextField
              label={dict.fields.marinePollutant}
              name="marinePollutant"
              f={result.marinePollutant}
              dict={dict}
            />
          </div>
        </section>

        <section className={sectionCls}>
          <h2 className="font-heading text-sm font-bold">
            {dict.sectionLegal}
          </h2>
          <div className={gridCls}>
            <TextField
              label={dict.fields.wgk}
              name="wgk"
              f={result.wgk}
              dict={dict}
            />
            <TextField
              label={dict.fields.lagerklasse}
              name="lagerklasse"
              f={result.lagerklasse}
              dict={dict}
            />
          </div>
        </section>

        <section className={sectionCls}>
          <h2 className="font-heading text-sm font-bold">
            {dict.sectionSafety}
          </h2>
          <p className="text-xs text-foreground-muted">
            {dict.sectionSafetyHint}
          </p>
          {(
            [
              ["section4FirstAid", result.section4FirstAid],
              ["section5FireFighting", result.section5FireFighting],
              ["section6AccidentalRelease", result.section6AccidentalRelease],
              ["section7HandlingStorage", result.section7HandlingStorage],
              ["section13Disposal", result.section13Disposal],
            ] as const
          ).map(([name, f]) => (
            <label key={name} className="flex flex-col gap-0.5">
              <span className="text-xs text-foreground-subtle">
                {dict.fields[name]}
              </span>
              <textarea
                name={name}
                defaultValue={f.value ?? ""}
                rows={2}
                className="rounded border border-border bg-background px-2 py-1 text-sm"
              />
            </label>
          ))}
        </section>

        <section className={sectionCls}>
          <div className={gridCls}>
            <label className="flex flex-col gap-0.5">
              <span className="text-xs text-foreground-subtle">
                {dict.targetSubstanceLabel}
              </span>
              <select
                name="substanceId"
                defaultValue={preselected ?? ""}
                required
                className={inputCls}
              >
                <option value="">{dict.chooseSubstance}</option>
                {substances.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.tradeName}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-foreground-subtle">
                {dict.targetSubstanceHint}
              </span>
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-xs text-foreground-subtle">
                {dict.revisionDateLabel}
              </span>
              <input
                type="date"
                name="revisionDate"
                defaultValue={toDateInput(result.revisionDate.value)}
                required
                className={inputCls}
              />
            </label>
          </div>
          <button
            type="submit"
            className="self-start rounded-[var(--radius-md)] bg-accent px-4 py-2 font-medium text-background"
          >
            {dict.confirmButton}
          </button>
        </section>
      </form>

      <form action={rejectAction}>
        <button type="submit" className="text-sm text-coral hover:underline">
          {dict.rejectButton}
        </button>
      </form>
    </div>
  );
}
