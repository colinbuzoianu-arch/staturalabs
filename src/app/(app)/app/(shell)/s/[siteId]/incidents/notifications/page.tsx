import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";

// P10a §7.4: statutory-notification support (deadline clock + pre-filled data
// sheet per country) is P10d — founder-gated, because the deadlines are legal
// content that must be verified against the official sources before seeding
// (SLD_P10_STATUTORY_NOTIFICATIONS_DRAFT.md). Until then this surface is an
// honest placeholder, not a fabricated deadline.
export default async function IncidentNotificationsPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  await requireSiteAdministrationAccess(siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).incidents;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
      <div>
        <p className="font-technical text-xs uppercase tracking-[0.2em] text-foreground-subtle">
          {dict.eyebrow}
        </p>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-foreground">
          {dict.notificationsHeading}
        </h1>
      </div>
      <p className="rounded-lg border border-dashed border-border bg-surface p-4 text-sm text-foreground-muted">
        {dict.notificationsPlaceholder}
      </p>
    </div>
  );
}
