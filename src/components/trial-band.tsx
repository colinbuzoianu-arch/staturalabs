// P18 A.3: the band every page of a trial tenant carries.
//
// It says three things and nothing more: what this tenant is, when it ends, and
// how to reach a human. The data note is the honest part — a prospect typing
// real employee names into a trial is processing personal data, and the band
// says so rather than leaving it implied.
//
// A plain server component (no interactivity, nothing to dismiss — a trial's
// end date is not something to hide), mounted in the authenticated layout next
// to the impersonation and safety-alert banners.
export function TrialBand({
  expiresLabel,
  contactHref,
  labels,
}: {
  // Pre-formatted in the caller's locale: a server component must not guess a
  // date format.
  expiresLabel: string;
  // mailto: built from the configured contact address, never a hard-coded one.
  contactHref: string | null;
  labels: { trialUntil: string; contact: string; dataNote: string };
}) {
  return (
    <div className="border-b border-info bg-info/15 px-4 py-2 text-sm text-foreground">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-technical text-xs uppercase tracking-[0.2em] text-info">
          {labels.trialUntil.replace("{date}", expiresLabel)}
        </span>
        {contactHref && (
          <a href={contactHref} className="text-accent underline">
            {labels.contact}
          </a>
        )}
        <span className="w-full text-xs text-foreground-muted">
          {labels.dataNote}
        </span>
      </div>
    </div>
  );
}
