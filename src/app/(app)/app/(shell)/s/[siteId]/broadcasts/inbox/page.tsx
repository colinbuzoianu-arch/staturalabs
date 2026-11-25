import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { requireSiteAccess } from "@/lib/auth/require-access";
import { listMyBroadcasts } from "@/lib/broadcasts/my-broadcasts";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";

// The module's own inbox, for users who work inside a site shell (EHS, a
// leader, an admin). It shows the same rows as /app/me/broadcasts — one
// resolver, listMyBroadcasts — and links to the same recipient view, so a
// confirmation can never be recorded in two different places.
export default async function BroadcastsInboxPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const { user } = await requireSiteAccess(siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).broadcasts;

  const all = await listMyBroadcasts(user);
  // Company-wide messages plus the ones for the site being viewed.
  const broadcasts = all.filter(
    (b) => b.siteId === null || b.siteId === siteId,
  );

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <div>
        <p className="font-technical text-xs uppercase tracking-[0.2em] text-foreground-subtle">
          {dict.eyebrow}
        </p>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-foreground">
          {dict.inboxHeading}
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">{dict.intro}</p>
      </div>

      {broadcasts.length === 0 ? (
        <EmptyState title={dict.inboxEmpty} />
      ) : (
        <ul className="flex flex-col gap-3">
          {broadcasts.map((b) => (
            <li
              key={b.recipientId}
              className="rounded-lg border border-border bg-surface p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={b.priority === "SAFETY_ALERT" ? "high" : "info"}>
                  {dict.priorityLabels[b.priority]}
                </Badge>
                {b.confirmedAt ? (
                  <Badge tone="low">
                    {dict.confirmedAt.replace(
                      "{date}",
                      b.confirmedAt.toLocaleDateString(locale),
                    )}
                  </Badge>
                ) : b.requiresConfirmation ? (
                  <Badge tone="elevated">{dict.confirmButton}</Badge>
                ) : null}
              </div>
              <Link
                href={`/app/me/broadcasts/${b.broadcastId}`}
                className="mt-2 block font-heading font-bold text-foreground hover:text-accent hover:underline"
              >
                {b.title}
              </Link>
              <p className="mt-1 text-xs text-foreground-muted">
                {b.publishedAt?.toLocaleDateString(locale) ?? dict.none}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
