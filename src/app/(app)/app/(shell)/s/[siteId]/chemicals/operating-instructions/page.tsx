import { renderToBuffer } from "@react-pdf/renderer";
import { revalidatePath } from "next/cache";
import { createElement } from "react";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import {
  createOperatingInstructionDraft,
  isOperatingInstructionReviewRequired,
} from "@/lib/chemicals/operating-instruction";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";
import { archiveGeneratedDocument } from "@/lib/report/archive-generated-document";
import { BetriebsanweisungDocument } from "@/lib/report/BetriebsanweisungDocument";
import { getBetriebsanweisungData } from "@/lib/report/get-betriebsanweisung-data";

// P8 §5(4) operating-instructions: draft → approve (generate + archive) →
// download. Country-gated AT/DE.
export default async function OperatingInstructionsPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const { site } = await requireSiteAdministrationAccess(siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).operatingInstructions;
  const companyId = site.companyId;
  const available = site.country === "AT" || site.country === "DE";

  async function createDraftAction(formData: FormData) {
    "use server";
    const { site: s } = await requireSiteAdministrationAccess(siteId);
    const substanceId = formData.get("substanceId");
    if (typeof substanceId === "string" && substanceId.length > 0) {
      await createOperatingInstructionDraft(substanceId, siteId, s.companyId);
    }
    revalidatePath(`/app/s/${siteId}/chemicals/operating-instructions`);
  }

  async function approveAction(formData: FormData) {
    "use server";
    const { user, site: s } = await requireSiteAdministrationAccess(siteId);
    const id = formData.get("id");
    if (typeof id !== "string" || id.length === 0) return;
    const oi = await prisma.operatingInstruction.findUnique({
      where: { id },
      select: { siteId: true, substanceId: true },
    });
    if (!oi || oi.siteId !== siteId) return;
    // Snapshot the current SDS revision, approve, generate + archive the PDF.
    const currentSds = await prisma.safetyDataSheet.findFirst({
      where: { substanceId: oi.substanceId, supersededAt: null },
      orderBy: { revisionDate: "desc" },
      select: { revisionDate: true },
    });
    await prisma.operatingInstruction.update({
      where: { id },
      data: {
        status: "APPROVED",
        approvedByUserId: user.id,
        approvedAt: new Date(),
        basedOnSdsRevisionDate: currentSds?.revisionDate ?? null,
      },
    });
    const data = await getBetriebsanweisungData(id);
    if (data) {
      const buffer = await renderToBuffer(
        createElement(BetriebsanweisungDocument, { data }) as Parameters<
          typeof renderToBuffer
        >[0],
      );
      const doc = await archiveGeneratedDocument({
        type: "BETRIEBSANWEISUNG",
        companyId: s.companyId,
        siteId,
        title: data.substance.tradeName,
        country: s.country,
        generatedByUserId: user.id,
        buffer,
      });
      await prisma.operatingInstruction.update({
        where: { id },
        data: { generatedDocumentId: doc.id },
      });
    }
    revalidatePath(`/app/s/${siteId}/chemicals/operating-instructions`);
  }

  const [instructions, substances] = await Promise.all([
    prisma.operatingInstruction.findMany({
      where: { siteId },
      include: {
        substance: {
          select: {
            tradeName: true,
            safetyDataSheets: {
              where: { supersededAt: null },
              orderBy: { revisionDate: "desc" },
              take: 1,
              select: { revisionDate: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.substance.findMany({
      where: { companyId },
      select: { id: true, tradeName: true },
      orderBy: { tradeName: "asc" },
    }),
  ]);

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

      {!available ? (
        <p className="rounded-lg border border-border bg-surface p-3 text-sm text-foreground-muted">
          {dict.notAvailableCountry}
        </p>
      ) : (
        <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <h2 className="font-heading text-sm font-bold">
            {dict.createHeading}
          </h2>
          <form
            action={createDraftAction}
            className="flex flex-wrap items-end gap-2 text-sm"
          >
            <label className="flex flex-col gap-1">
              {dict.substanceLabel}
              <select
                name="substanceId"
                className="rounded border border-border bg-background px-2 py-1"
              >
                {substances.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.tradeName}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="rounded-[var(--radius-md)] bg-accent px-3 py-1.5 font-medium text-background"
            >
              {dict.createDraft}
            </button>
          </form>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-sm font-bold">{dict.listHeading}</h2>
        {instructions.length === 0 ? (
          <p className="text-sm text-foreground-muted">{dict.listEmpty}</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-foreground-muted">
                <th className="py-1 pr-4">{dict.colSubstance}</th>
                <th className="py-1 pr-4">{dict.colStatus}</th>
                <th className="py-1" />
              </tr>
            </thead>
            <tbody>
              {instructions.map((oi) => {
                const currentSds =
                  oi.substance.safetyDataSheets[0]?.revisionDate ?? null;
                const needsReview = isOperatingInstructionReviewRequired(
                  oi,
                  currentSds,
                );
                return (
                  <tr
                    key={oi.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="py-1.5 pr-4 font-medium text-foreground">
                      {oi.substance.tradeName}
                    </td>
                    <td className="py-1.5 pr-4 text-foreground-muted">
                      {oi.status === "APPROVED"
                        ? dict.statusApproved
                        : dict.statusDraft}
                      {needsReview ? (
                        <span className="ml-2 text-status-high">
                          · {dict.reviewRequired}
                        </span>
                      ) : null}
                    </td>
                    <td className="flex flex-wrap items-center gap-3 py-1.5">
                      <a
                        href={`/api/operating-instructions/${oi.id}/pdf`}
                        className="text-accent hover:underline"
                      >
                        {dict.download}
                      </a>
                      {oi.status !== "APPROVED" && (
                        <form action={approveAction}>
                          <input type="hidden" name="id" value={oi.id} />
                          <button
                            type="submit"
                            className="text-accent hover:underline"
                          >
                            {dict.approve}
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
