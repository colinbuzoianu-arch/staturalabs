import Link from "next/link";
import { MeNav } from "@/components/me-nav";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { requireAuthenticatedUser } from "@/lib/auth/require-access";
import { listMyBroadcasts } from "@/lib/broadcasts/my-broadcasts";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import { getSelfPerson } from "@/lib/people/self-service";

// The recipient's own inbox, outside any site shell: a SELF-scoped employee
// has no accessible site, so their safety information has to live under
// /app/me like the rest of their self-service surface (P17 §5).
export default async function MyBroadcastsPage() {
  const user = await requireAuthenticatedUser();
  const locale = await getLocale();
  const administration = getAdministrationDictionary(locale);
  const dict = administration.broadcasts;
  const selfDict = administration.selfService;
  const person = await getSelfPerson(user);
  const broadcasts = await listMyBroadcasts(user);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <MeNav labels={selfDict} hasPerson={person !== null} />
      <div>
        <p className="font-technical text-xs uppercase tracking-[0.2em] text-foreground-subtle">
          {dict.eyebrow}
        </p>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-foreground">
          {dict.inboxHeading}
        </h1>
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
                {b.status === "ARCHIVED" && (
                  <Badge tone="neutral">{dict.statusLabels.ARCHIVED}</Badge>
                )}
              </div>
              <Link
                href={`/app/me/broadcasts/${b.broadcastId}`}
                className="mt-2 block font-heading font-bold text-foreground hover:text-accent hover:underline"
              >
                {b.title}
              </Link>
              <p className="mt-1 text-xs text-foreground-muted">
                {b.publishedAt?.toLocaleDateString(locale) ?? dict.none}
                {b.requiresConfirmation && b.confirmationDueAt
                  ? ` · ${dict.colDue}: ${b.confirmationDueAt.toLocaleDateString(locale)}`
                  : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
