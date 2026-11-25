// P18 A.4: what a locked trial shows instead of the app.
//
// The data is still there (the grace period is running), so this is a closed
// door, not a deletion notice — and it says how to get back in rather than
// leaving a dead end. Deliberately a plain server component: nothing to
// interact with, nothing to dismiss.
export function TrialExpiredCard({
  companyName,
  contactHref,
  labels,
}: {
  companyName: string;
  contactHref: string | null;
  labels: { heading: string; body: string; contact: string };
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="flex w-full max-w-md flex-col gap-4 rounded-lg border border-border bg-surface p-6">
        <h1 className="font-[family-name:var(--font-heading)] text-xl font-bold text-foreground">
          {labels.heading}
        </h1>
        <p className="text-sm text-foreground-muted">{companyName}</p>
        <p className="text-sm text-foreground-muted">{labels.body}</p>
        {contactHref && (
          <a
            href={contactHref}
            className="self-start rounded-[var(--radius-md)] bg-accent px-4 py-2 text-sm font-medium text-background"
          >
            {labels.contact}
          </a>
        )}
      </div>
    </div>
  );
}
