import Link from "next/link";
import { notFound } from "next/navigation";
import { HANDBOOK_CHAPTERS } from "@/generated/handbook";
import { requireModuleAccess } from "@/lib/auth/require-access";
import { visibleChapters } from "@/lib/handbook/chapters";
import { renderHandbookMarkdown } from "@/lib/handbook/markdown";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";

// One handbook chapter, with its own on-page contents.
//
// A chapter the reader's role may not see 404s rather than redirecting — the
// same fail-closed posture as every other resource here, and it keeps the
// internal super-admin chapter genuinely out of a tenant's reach rather than
// merely out of their menu.
export default async function HelpChapterPage({
  params,
}: {
  params: Promise<{ siteId: string; slug: string }>;
}) {
  const { siteId, slug } = await params;
  const { user } = await requireModuleAccess("HELP", siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).help;

  const mine = visibleChapters(HANDBOOK_CHAPTERS, user.role);
  const index = mine.findIndex((c) => c.slug === slug);
  if (index === -1) notFound();
  const chapter = mine[index];
  const previous = index > 0 ? mine[index - 1] : null;
  const next = index < mine.length - 1 ? mine[index + 1] : null;

  const { html, headings } = renderHandbookMarkdown(chapter.markdown);
  // The on-page contents lists the h2s: h1 is the chapter title itself, and
  // anything deeper is detail rather than navigation.
  const sections = headings.filter((h) => h.level === 2);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <div>
        <Link
          href={`/app/s/${siteId}/help`}
          className="text-sm text-accent hover:underline"
        >
          {dict.back}
        </Link>
      </div>

      {sections.length > 1 && (
        <nav className="rounded-lg border border-border bg-surface p-4 text-sm">
          <p className="font-heading text-xs font-bold uppercase tracking-wide text-foreground-subtle">
            {dict.onThisPage}
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="text-foreground-muted hover:text-accent hover:underline"
                >
                  {section.text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* The handbook's Markdown is OUR source (docs/handbuch/**) and the
          renderer escapes everything before emitting its own small tag set, so
          a chapter cannot inject markup — see src/lib/handbook/markdown.ts. */}
      <article
        className="handbook flex flex-col gap-3 text-sm text-foreground [&_a]:text-accent [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-foreground-muted [&_code]:rounded [&_code]:bg-surface-raised [&_code]:px-1 [&_code]:font-technical [&_h1]:mt-2 [&_h1]:font-[family-name:var(--font-heading)] [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mt-4 [&_h2]:font-heading [&_h2]:text-lg [&_h2]:font-bold [&_h3]:mt-3 [&_h3]:font-heading [&_h3]:font-bold [&_img]:rounded [&_img]:border [&_img]:border-border [&_li]:ml-5 [&_ol>li]:list-decimal [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-surface-raised [&_pre]:p-3 [&_ul>li]:list-disc"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: our own source, escaped by the renderer
        dangerouslySetInnerHTML={{ __html: html }}
      />

      <nav className="flex flex-wrap justify-between gap-3 border-t border-border pt-4 text-sm">
        {previous ? (
          <Link
            href={`/app/s/${siteId}/help/${previous.slug}`}
            className="text-accent hover:underline"
          >
            ← {previous.title}
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link
            href={`/app/s/${siteId}/help/${next.slug}`}
            className="text-accent hover:underline"
          >
            {next.title} →
          </Link>
        )}
      </nav>
    </div>
  );
}
