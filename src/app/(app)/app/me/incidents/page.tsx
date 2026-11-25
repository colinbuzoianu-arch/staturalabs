import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MeNav } from "@/components/me-nav";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import type { IncidentType } from "@/generated/prisma/enums";
import { requireAuthenticatedUser } from "@/lib/auth/require-access";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import {
  getSelfPerson,
  getSelfReportedIncidents,
  getSelfReportWorkstations,
  reportSelfIncident,
} from "@/lib/people/self-service";

// The event types an employee may self-report (near miss, accident, first aid,
// property damage, environmental, other) — a sensible subset of IncidentType;
// the full set is for the EHS triage surface.
const REPORTABLE_TYPES = [
  "BEINAHEUNFALL",
  "ARBEITSUNFALL",
  "ERSTE_HILFE",
  "SACHSCHADEN",
  "UMWELTEREIGNIS",
  "SONSTIGES",
] as const;

// P17 §5: the employee's "report an event" + own-reports surface. Reporting
// goes through reportSelfIncident, which resolves company/site from the chosen
// assigned workstation server-side and files the incident with reportedByUserId
// = this employee, so it shows back in "my reports".
export default async function MyIncidentsPage({
  searchParams,
}: {
  searchParams: Promise<{ reported?: string; error?: string }>;
}) {
  const user = await requireAuthenticatedUser();
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).selfService;
  const incidentsDict = getAdministrationDictionary(locale).incidents;
  const { reported, error } = await searchParams;
  const person = await getSelfPerson(user);

  const nav = (
    <MeNav
      labels={{
        navOverview: dict.navOverview,
        navInstructions: dict.navInstructions,
        navDocuments: dict.navDocuments,
        navIncidents: dict.navIncidents,
        navBroadcasts: dict.navBroadcasts,
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

  const [workstations, myReports] = await Promise.all([
    getSelfReportWorkstations(person),
    getSelfReportedIncidents(user),
  ]);

  async function reportAction(formData: FormData) {
    "use server";
    const u = await requireAuthenticatedUser();
    const workstationId = String(formData.get("workstationId") ?? "");
    const type = String(formData.get("type") ?? "") as IncidentType;
    const title = String(formData.get("title") ?? "");
    const description = String(formData.get("description") ?? "");
    const occurredAtRaw = String(formData.get("occurredAt") ?? "");
    const occurredAt = occurredAtRaw ? new Date(occurredAtRaw) : new Date();
    if (!(REPORTABLE_TYPES as readonly IncidentType[]).includes(type)) {
      redirect("/app/me/incidents?error=incomplete");
    }
    const result = await reportSelfIncident({
      user: u,
      workstationId,
      type,
      title,
      description,
      occurredAt,
    });
    revalidatePath("/app/me/incidents");
    redirect(
      result.ok
        ? "/app/me/incidents?reported=1"
        : "/app/me/incidents?error=incomplete",
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {nav}
      <div>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-foreground">
          {dict.incidentsHeading}
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">
          {dict.incidentsIntro}
        </p>
      </div>

      {reported === "1" && (
        <div className="rounded-[var(--radius-md)] border border-status-low bg-status-low/10 px-4 py-3 text-sm text-foreground">
          {dict.reportSuccess}
        </div>
      )}
      {error === "incomplete" && (
        <div className="rounded-[var(--radius-md)] border border-status-high bg-status-high/10 px-4 py-3 text-sm text-foreground">
          {dict.reportIncomplete}
        </div>
      )}

      <Card>
        <CardHeader title={dict.reportHeading} />
        <CardBody>
          {workstations.length === 0 ? (
            <EmptyState title={dict.reportNoWorkstations} />
          ) : (
            <form action={reportAction} className="space-y-4">
              <div>
                <label
                  htmlFor="type"
                  className="mb-1 block text-sm font-medium text-foreground"
                >
                  {dict.reportTypeLabel}
                </label>
                <select
                  id="type"
                  name="type"
                  required
                  className="w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm"
                >
                  {REPORTABLE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {dict.incidentTypeLabels[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="workstationId"
                  className="mb-1 block text-sm font-medium text-foreground"
                >
                  {dict.reportWorkstationLabel}
                </label>
                <select
                  id="workstationId"
                  name="workstationId"
                  required
                  className="w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm"
                >
                  {workstations.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="occurredAt"
                  className="mb-1 block text-sm font-medium text-foreground"
                >
                  {dict.reportOccurredAtLabel}
                </label>
                <input
                  id="occurredAt"
                  name="occurredAt"
                  type="date"
                  defaultValue={today}
                  max={today}
                  className="w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label
                  htmlFor="title"
                  className="mb-1 block text-sm font-medium text-foreground"
                >
                  {dict.reportTitleLabel}
                </label>
                <input
                  id="title"
                  name="title"
                  required
                  className="w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label
                  htmlFor="description"
                  className="mb-1 block text-sm font-medium text-foreground"
                >
                  {dict.reportDescriptionLabel}
                </label>
                <textarea
                  id="description"
                  name="description"
                  required
                  rows={4}
                  className="w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                className="rounded-[var(--radius-md)] bg-accent px-4 py-2 text-sm font-medium text-white"
              >
                {dict.reportSubmit}
              </button>
            </form>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={dict.myReportsHeading} />
        <CardBody>
          {myReports.length === 0 ? (
            <EmptyState title={dict.myReportsEmpty} />
          ) : (
            <ul className="divide-y divide-border">
              {myReports.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-foreground">{r.title}</div>
                    <div className="text-xs text-foreground-subtle">
                      {incidentsDict.typeLabels[r.type]} ·{" "}
                      {r.occurredAt.toISOString().slice(0, 10)}
                    </div>
                  </div>
                  <Badge tone="neutral">
                    {incidentsDict.statusLabels[
                      r.status as keyof typeof incidentsDict.statusLabels
                    ] ?? r.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
