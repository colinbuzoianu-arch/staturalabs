import Link from "next/link";
import { redirect } from "next/navigation";
import { isGefahrstoffeAiAvailable } from "@/lib/ai/anthropic";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import {
  createPendingSdsExtraction,
  extractSdsFromPdf,
  recordFailedSdsExtraction,
} from "@/lib/chemicals/sds-extraction";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";

const MAX_PDF_BYTES = 20 * 1024 * 1024;

// P15 S2b: SDS import — upload a supplier SDS (PDF), the AI extracts it into a
// pending review draft (createPendingSdsExtraction), then the user confirms it
// field by field on the [extractionId] page. AI runs only behind the
// KI-Funktionen entitlement + a configured key; manual entry always works.
export default async function SdsReviewPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const { site } = await requireSiteAdministrationAccess(siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).chemicals.sdsReview;
  const companyId = site.companyId;
  const aiAvailable = await isGefahrstoffeAiAvailable(companyId);

  async function uploadAction(formData: FormData) {
    "use server";
    const { site: s, user } = await requireSiteAdministrationAccess(siteId);
    const d = getAdministrationDictionary(await getLocale()).chemicals
      .sdsReview;
    if (!(await isGefahrstoffeAiAvailable(s.companyId))) {
      throw new Error(d.aiUnavailable);
    }
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0)
      throw new Error(d.fileRequired);
    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) throw new Error(d.notPdf);
    if (file.size > MAX_PDF_BYTES) throw new Error(d.notPdf);
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

    let extractionId: string;
    try {
      const run = await extractSdsFromPdf(base64);
      extractionId = await createPendingSdsExtraction({
        companyId: s.companyId,
        createdByUserId: user.id,
        run,
        fileName: file.name,
      });
    } catch (err) {
      extractionId = await recordFailedSdsExtraction({
        companyId: s.companyId,
        createdByUserId: user.id,
        errorMessage: err instanceof Error ? err.message : String(err),
        fileName: file.name,
      });
    }
    redirect(`/app/s/${siteId}/chemicals/sds-review/${extractionId}`);
  }

  const extractions = await prisma.sdsExtraction.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    take: 25,
    select: { id: true, fileName: true, status: true, createdAt: true },
  });

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

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="font-heading text-sm font-bold">{dict.uploadHeading}</h2>
        {aiAvailable ? (
          <form action={uploadAction} className="flex flex-col gap-3 text-sm">
            <p className="text-foreground-muted">{dict.uploadIntro}</p>
            <label className="flex flex-col gap-1">
              {dict.fileLabel}
              <input
                type="file"
                name="file"
                accept="application/pdf,.pdf"
                required
                className="rounded border border-border bg-background px-2 py-1"
              />
            </label>
            <button
              type="submit"
              className="self-start rounded bg-accent px-4 py-1.5 font-medium text-background hover:opacity-90"
            >
              {dict.uploadButton}
            </button>
          </form>
        ) : (
          <p className="rounded border border-border bg-background p-3 text-sm text-foreground-muted">
            {dict.aiUnavailable}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="font-heading text-sm font-bold">{dict.listHeading}</h2>
        {extractions.length === 0 ? (
          <p className="text-sm text-foreground-muted">{dict.listEmpty}</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-foreground-subtle">
                <th className="py-1 font-medium">{dict.colFile}</th>
                <th className="py-1 font-medium">{dict.colStatus}</th>
                <th className="py-1 font-medium">{dict.colCreated}</th>
                <th className="py-1" />
              </tr>
            </thead>
            <tbody>
              {extractions.map((e) => (
                <tr key={e.id} className="border-t border-border">
                  <td className="py-1.5">{e.fileName ?? "—"}</td>
                  <td className="py-1.5">{dict.status[e.status]}</td>
                  <td className="py-1.5 text-foreground-muted">
                    {e.createdAt.toISOString().slice(0, 10)}
                  </td>
                  <td className="py-1.5 text-right">
                    <Link
                      href={`/app/s/${siteId}/chemicals/sds-review/${e.id}`}
                      className="text-accent hover:underline"
                    >
                      {dict.open}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
