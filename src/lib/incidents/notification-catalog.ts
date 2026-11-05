import "server-only";

import type { CountryCode } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import type { NotificationRuleShape } from "./notification-deadline";

// P10d: the active IncidentNotificationCatalogVersion is data, fail-closed —
// same contract as getActiveLegalReferenceCatalog / getActiveExposureLimitCatalog.
export async function getActiveIncidentNotificationCatalog(): Promise<string> {
  const active = await prisma.incidentNotificationCatalogVersion.findFirst({
    where: { isActive: true },
  });
  if (!active) {
    throw new Error(
      "No active IncidentNotificationCatalogVersion found — cannot resolve notification duties without one",
    );
  }
  return active.version;
}

// Fetch the active-catalogue notification rules for a country. Returns [] (an
// honest gap) when the country has no rows — the resolver then returns
// { kind: "none" }; never a cross-country borrow (§3.15). The LegalReference is
// included so the UI can show the reference line without a second query.
export async function lookupIncidentNotificationRules(
  country: CountryCode,
): Promise<
  (NotificationRuleShape & {
    id: string;
    legalReference: { code: string; obligation: string; sourceUrl: string };
  })[]
> {
  const catalogVersion = await getActiveIncidentNotificationCatalog();
  const rows = await prisma.incidentNotificationRule.findMany({
    where: { catalogVersion, country },
    include: {
      legalReference: {
        select: { code: true, obligation: true, sourceUrl: true },
      },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    incidentType: r.incidentType,
    appliesToFatalOrMass: r.appliesToFatalOrMass,
    deadline: r.deadline,
    immediate: r.immediate,
    asSoonAsPossible: r.asSoonAsPossible,
    thresholdText: r.thresholdText,
    clockStartsText: r.clockStartsText,
    legalReferenceId: r.legalReferenceId,
    legalReference: r.legalReference,
  }));
}
