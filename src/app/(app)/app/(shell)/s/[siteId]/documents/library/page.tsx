import { revalidatePath } from "next/cache";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { DocumentCategory } from "@/generated/prisma/enums";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import {
  DocumentScanError,
  uploadNewDocument,
} from "@/lib/documents/upload-document";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";

const CATEGORIES = Object.values(DocumentCategory);

// Dokumente › Bibliothek (SLD_RESTRUCTURE_PLAN_platform-modules.md §7.2):
// upload + list the site's document library. Every upload passes the malware-
// scan gate before a byte is stored. Write surface → requireSiteAdministration
// Access. Per-record links + read-confirmation are later passes.
export default async function DocumentLibraryPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  await requireSiteAdministrationAccess(siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).documentsPage;

  async function uploadAction(formData: FormData) {
    "use server";
    const { user: u, site: s } = await requireSiteAdministrationAccess(siteId);
    const d = getAdministrationDictionary(await getLocale()).documentsPage;

    const title = formData.get("title");
    if (typeof title !== "string" || title.trim().length === 0) {
      throw new Error(d.titleRequired);
    }
    const categoryRaw = formData.get("category");
    const category = (CATEGORIES as string[]).includes(categoryRaw as string)
      ? (categoryRaw as DocumentCategory)
      : DocumentCategory.OTHER;
    const reviewRaw = formData.get("reviewDueDate");
    const reviewDueDate =
      typeof reviewRaw === "string" && reviewRaw.trim().length > 0
        ? new Date(reviewRaw)
        : null;

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      throw new Error(d.fileRequired);
    }
    const buffer = Buffer.from(await file.arrayBuffer());

    try {
      await uploadNewDocument({
        companyId: s.companyId,
        siteId,
        category,
        title: title.trim(),
        reviewDueDate,
        fileName: file.name,
        declaredMime: file.type || "application/octet-stream",
        buffer,
        userId: u.id,
      });
    } catch (error) {
      if (error instanceof DocumentScanError) {
        throw new Error(
          d.scanReasons[error.reason as keyof typeof d.scanReasons] ??
            d.scanReasons.other,
        );
      }
      throw error;
    }

    revalidatePath(`/app/s/${siteId}/documents/library`);
  }

  const documents = await prisma.document.findMany({
    where: { siteId },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-foreground-subtle">
          {dict.eyebrow}
        </p>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-foreground">
          {dict.libraryHeading}
        </h1>
      </div>

      <nav className="flex gap-2 border-b border-border pb-3 text-sm">
        <span className="rounded-[var(--radius-md)] bg-surface-raised px-3 py-1 font-medium text-foreground">
          {dict.libraryTab}
        </span>
        <Link
          href={`/app/s/${siteId}/documents/generated`}
          className="rounded-[var(--radius-md)] px-3 py-1 text-foreground-muted hover:bg-surface-raised"
        >
          {dict.generatedTab}
        </Link>
      </nav>

      <Card>
        <CardHeader
          title={dict.uploadHeading}
          description={dict.libraryIntro}
        />
        <CardBody>
          <form action={uploadAction} className="flex flex-col gap-3 text-sm">
            <label className="flex flex-col gap-1">
              {dict.titleLabel}
              <input
                name="title"
                required
                className="rounded border border-border bg-background px-2 py-1"
              />
            </label>
            <div className="flex flex-wrap gap-3">
              <label className="flex flex-col gap-1">
                {dict.categoryLabel}
                <select
                  name="category"
                  className="rounded border border-border bg-background px-2 py-1"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {dict.categoryLabels[cat]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                {dict.reviewDueLabel}
                <input
                  type="date"
                  name="reviewDueDate"
                  className="rounded border border-border bg-background px-2 py-1"
                />
              </label>
            </div>
            <label className="flex flex-col gap-1">
              {dict.fileLabel}
              <input
                type="file"
                name="file"
                required
                accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx,.pptx"
                className="text-foreground-muted"
              />
            </label>
            <button
              type="submit"
              className="self-start rounded-[var(--radius-md)] bg-accent px-4 py-2 font-medium text-white"
            >
              {dict.uploadButton}
            </button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={dict.libraryHeading} />
        <CardBody>
          {documents.length === 0 ? (
            <EmptyState title={dict.libraryEmpty} />
          ) : (
            <ul className="divide-y divide-border">
              {documents.map((doc) => {
                const latest = doc.versions[0];
                return (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Badge tone="info">
                        {dict.categoryLabels[doc.category]}
                      </Badge>
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-foreground">
                          {doc.title}
                        </span>
                        <span className="text-xs text-foreground-subtle">
                          {latest
                            ? `v${latest.version} · ${(latest.fileSize / 1024).toFixed(0)} KB`
                            : dict.noVersion}
                        </span>
                      </span>
                    </span>
                    {latest ? (
                      <a
                        href={`/api/documents/versions/${latest.id}`}
                        className="shrink-0 text-accent hover:underline"
                      >
                        {dict.download}
                      </a>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
