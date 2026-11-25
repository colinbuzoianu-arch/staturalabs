import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { requireAuthenticatedUser } from "@/lib/auth/require-access";
import {
  getMyBroadcast,
  markBroadcastRead,
} from "@/lib/broadcasts/my-broadcasts";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";

// The recipient's view of one safety message — the link in the notification,
// the e-mail and the banner all land here. Opening it stamps readAt (the fact
// that it was opened), which is NOT the same as confirming; confirmation is an
// explicit click and lands in slice 3.
//
// A recipient sees exactly the text the sender wrote: no incident fields, no
// person data, no health data, even when the broadcast links to an event.
export default async function MyBroadcastDetailPage({
  params,
}: {
  params: Promise<{ broadcastId: string }>;
}) {
  const { broadcastId } = await params;
  const user = await requireAuthenticatedUser();
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).broadcasts;

  const broadcast = await getMyBroadcast(user, broadcastId);
  // Not addressed to them → 404, never a redirect: a message they were not
  // sent is none of their business, and we do not confirm it exists.
  if (!broadcast) notFound();

  await markBroadcastRead({ user, broadcastId });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <div>
        <Link
          href="/app/me/broadcasts"
          className="text-sm text-accent hover:underline"
        >
          ← {dict.inboxHeading}
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge tone={broadcast.priority === "SAFETY_ALERT" ? "high" : "info"}>
            {dict.priorityLabels[broadcast.priority]}
          </Badge>
          <Badge tone="outline">{dict.domainLabels[broadcast.domain]}</Badge>
          <span className="text-xs text-foreground-muted">
            {broadcast.publishedAt?.toLocaleDateString(locale) ?? dict.none}
          </span>
        </div>
        <h1 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-bold text-foreground">
          {broadcast.title}
        </h1>
      </div>

      <section className="rounded-lg border border-border bg-surface p-4">
        <div
          className="flex flex-col gap-2 text-sm text-foreground [&_a]:text-accent [&_a]:underline [&_li]:ml-4 [&_li]:list-disc"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitised at the single write gate
          dangerouslySetInnerHTML={{ __html: broadcast.body }}
        />
      </section>

      <section className="flex flex-col gap-2 text-sm">
        {broadcast.confirmedAt ? (
          <p className="text-foreground">
            {dict.confirmedAt.replace(
              "{date}",
              broadcast.confirmedAt.toLocaleDateString(locale),
            )}
          </p>
        ) : broadcast.requiresConfirmation ? (
          <p className="text-foreground-muted">
            {dict.confirmButton}
            {broadcast.confirmationDueAt
              ? ` · ${dict.colDue}: ${broadcast.confirmationDueAt.toLocaleDateString(locale)}`
              : ""}
          </p>
        ) : (
          <p className="text-foreground-muted">{dict.confirmNotRequired}</p>
        )}
      </section>
    </div>
  );
}
