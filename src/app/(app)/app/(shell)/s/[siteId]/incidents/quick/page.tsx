import { notFound } from "next/navigation";
import { IncidentType } from "@/generated/prisma/enums";
import { hasPermission } from "@/lib/auth/permissions";
import { requireSiteAccess } from "@/lib/auth/require-access";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import { QuickCaptureClient } from "./quick-capture-client";

// P14 G6: Ereignis-Schnellmeldung — an offline-capable quick incident capture for
// floor staff. Captures are held in a local (per-device) queue and synced when
// the device is back online. Person-free; the "no people in photos" rule stands.
export default async function QuickCapturePage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const { user } = await requireSiteAccess(siteId);
  if (!hasPermission(user, "incidents.write")) notFound();

  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).quickCapture;
  const typeLabels = getAdministrationDictionary(locale).incidents.typeLabels;
  const types = Object.values(IncidentType);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-foreground-subtle">
          {dict.eyebrow}
        </p>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-foreground">
          {dict.heading}
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">{dict.intro}</p>
      </div>

      <QuickCaptureClient
        siteId={siteId}
        types={types}
        typeLabels={typeLabels}
        dict={{
          onlineLabel: dict.onlineLabel,
          offlineLabel: dict.offlineLabel,
          typeLabel: dict.typeLabel,
          titleLabel: dict.titleLabel,
          descriptionLabel: dict.descriptionLabel,
          dateLabel: dict.dateLabel,
          captureButton: dict.captureButton,
          queuedHeading: dict.queuedHeading,
          syncNow: dict.syncNow,
          clearSynced: dict.clearSynced,
          noPeopleNotice: dict.noPeopleNotice,
          pendingBadge: dict.pendingBadge,
          errorBadge: dict.errorBadge,
          syncedBadge: dict.syncedBadge,
          emptyQueue: dict.emptyQueue,
          savedOfflineMsg: dict.savedOfflineMsg,
        }}
      />
    </div>
  );
}
