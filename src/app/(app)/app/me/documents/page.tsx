import { MeNav } from "@/components/me-nav";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { requireAuthenticatedUser } from "@/lib/auth/require-access";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import {
  getSelfBetriebsanweisungen,
  getSelfBriefingSites,
  getSelfPerson,
} from "@/lib/people/self-service";

// P17 §5: the Betriebsanweisungen for substances at the employee's workstations
// + the worker briefing for their site. Both download through the narrow
// assignment-scoped /api/me/* routes (a SELF employee has no site access).
export default async function MyDocumentsPage() {
  const user = await requireAuthenticatedUser();
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).selfService;
  const person = await getSelfPerson(user);

  const nav = (
    <MeNav
      labels={{
        navOverview: dict.navOverview,
        navInstructions: dict.navInstructions,
        navDocuments: dict.navDocuments,
        navIncidents: dict.navIncidents,
        navBroadcasts: dict.navBroadcasts,
        navHelp: dict.navHelp,
      }}
      hasPerson={person !== null}
    />
  );

  if (!person) {
    return (
      <div className="mx-auto max-w-3xl">
        {nav}
        <EmptyState title={dict.noPersonLinked} />
      </div>
    );
  }

  const [bas, sites] = await Promise.all([
    getSelfBetriebsanweisungen(person),
    getSelfBriefingSites(person),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {nav}
      <div>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-foreground">
          {dict.documentsHeading}
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">
          {dict.documentsIntro}
        </p>
      </div>

      <Card>
        <CardHeader title={dict.baHeading} />
        <CardBody>
          {bas.length === 0 ? (
            <EmptyState title={dict.baEmpty} />
          ) : (
            <ul className="divide-y divide-border">
              {bas.map((b) => (
                <li
                  key={b.operatingInstructionId}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-foreground">
                      {b.substanceName}
                    </div>
                    {b.workstationNames.length > 0 && (
                      <div className="text-xs text-foreground-subtle">
                        {dict.baUsedAtLabel}: {b.workstationNames.join(", ")}
                      </div>
                    )}
                  </div>
                  <a
                    href={`/api/me/operating-instructions/${b.operatingInstructionId}/pdf`}
                    className="shrink-0 rounded-[var(--radius-md)] border border-border px-3 py-1.5 text-foreground-muted hover:bg-surface-raised"
                  >
                    {dict.baDownload}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={dict.briefingHeading} />
        <CardBody>
          {sites.length === 0 ? (
            <EmptyState title={dict.briefingEmpty} />
          ) : (
            <ul className="divide-y divide-border">
              {sites.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 py-3 text-sm"
                >
                  <span className="font-medium text-foreground">{s.name}</span>
                  <a
                    href={`/api/me/worker-briefing/${s.id}`}
                    className="shrink-0 rounded-[var(--radius-md)] border border-border px-3 py-1.5 text-foreground-muted hover:bg-surface-raised"
                  >
                    {dict.briefingDownload}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
