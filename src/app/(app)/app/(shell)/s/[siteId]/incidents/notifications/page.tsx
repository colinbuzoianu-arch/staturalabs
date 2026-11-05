import Link from "next/link";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import { resolveNotificationCountryPack } from "@/lib/incidents/notification-availability";
import { lookupIncidentNotificationRules } from "@/lib/incidents/notification-catalog";
import { resolveNotificationDeadline } from "@/lib/incidents/notification-deadline";
import { prisma } from "@/lib/prisma";

// P10d §D.4: incidents at this site that carry a statutory notification duty,
// with their deadline/status. Country-gated — a site whose country has no
// verified pack (CH/RO) shows an honest gap, never a fabricated duty.
export default async function IncidentNotificationsPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const { site } = await requireSiteAdministrationAccess(siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).incidents;

  const available = resolveNotificationCountryPack(site.country);

  const rows = available
    ? await (async () => {
        const [incidents, rules] = await Promise.all([
          prisma.incident.findMany({
            where: { siteId },
            orderBy: { occurredAt: "desc" },
            include: {
              statutoryNotification: true,
              involvedPersons: {
                select: { healthDetail: { select: { fatal: true } } },
              },
            },
          }),
          lookupIncidentNotificationRules(site.country),
        ]);
        return incidents
          .map((i) => {
            const fatal = i.involvedPersons.some((p) => p.healthDetail?.fatal);
            const duty = resolveNotificationDeadline(
              rules,
              i.type,
              i.occurredAt,
              {
                fatalOrMass: fatal,
              },
            );
            return { incident: i, duty };
          })
          .filter((r) => r.duty.kind !== "none");
      })()
    : [];

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

      {!available ? (
        <p className="rounded-lg border border-dashed border-border bg-surface p-4 text-sm text-foreground-muted">
          {dict.noDutyForCountry}
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-foreground-muted">
          {dict.notificationsPlaceholder}
        </p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-foreground-muted">
              <th className="py-1 pr-4">{dict.colTitle}</th>
              <th className="py-1 pr-4">{dict.colType}</th>
              <th className="py-1 pr-4">{dict.notificationStatusLabel}</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ incident: i, duty }) => (
              <tr key={i.id} className="border-b border-border last:border-0">
                <td className="py-1.5 pr-4 font-medium text-foreground">
                  {i.title}
                </td>
                <td className="py-1.5 pr-4 text-foreground-muted">
                  {dict.typeLabels[i.type]}
                </td>
                <td className="py-1.5 pr-4 text-foreground-muted">
                  {i.statutoryNotification?.status === "SUBMITTED"
                    ? dict.notifSubmitted
                        .replace(
                          "{date}",
                          i.statutoryNotification.submittedAt
                            ? i.statutoryNotification.submittedAt
                                .toISOString()
                                .slice(0, 10)
                            : "—",
                        )
                        .replace(
                          "{ref}",
                          i.statutoryNotification.referenceNumber ?? "—",
                        )
                    : i.statutoryNotification?.status === "WAIVED"
                      ? dict.notifWaived
                      : duty.kind === "deadline"
                        ? dict.dutyDeadline
                            .replace(
                              "{date}",
                              duty.dueAt.toISOString().slice(0, 10),
                            )
                            .replace("{days}", String(duty.durationDays))
                        : duty.kind === "immediate"
                          ? dict.dutyImmediate
                          : dict.dutyAsap}
                </td>
                <td className="py-1.5">
                  <Link
                    href={`/app/s/${siteId}/incidents/${i.id}`}
                    className="text-accent hover:underline"
                  >
                    {dict.openLink}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
