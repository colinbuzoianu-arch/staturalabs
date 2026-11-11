import { revalidatePath } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  type IncidentInvestigationMethod,
  type IncidentInvolvedRole,
  RiskBand,
} from "@/generated/prisma/enums";
import { hasPermission } from "@/lib/auth/permissions";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import { setIncidentVehicle } from "@/lib/fleet/vehicle";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import { hasHealthDetail } from "@/lib/incidents/health";
import {
  raiseActionFromIncident,
  setIncidentInvestigation,
  transitionIncident,
  triageIncident,
} from "@/lib/incidents/incident";
import {
  addInvolvedPerson,
  removeInvolvedPerson,
} from "@/lib/incidents/involved-person";
import { resolveNotificationCountryPack } from "@/lib/incidents/notification-availability";
import {
  recordNotificationSubmission,
  resolveIncidentNotification,
  waiveNotification,
} from "@/lib/incidents/statutory-notification";
import { prisma } from "@/lib/prisma";

const RISK_BANDS = Object.values(RiskBand);
const METHODS: IncidentInvestigationMethod[] = [
  "FIVE_WHY",
  "ISHIKAWA",
  "NARRATIVE",
];
const INVOLVED_ROLES: IncidentInvolvedRole[] = [
  "INJURED",
  "WITNESS",
  "FIRST_AIDER",
  "OTHER",
];

// P10a §7.4 incident case detail. Resource-first gate: fetch, then confirm the
// incident belongs to this site (fail-closed 404, same as requireTaskAccess).
export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ siteId: string; incidentId: string }>;
}) {
  const { siteId, incidentId } = await params;
  const { user, site } = await requireSiteAdministrationAccess(siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).incidents;
  const canReadHealth = hasPermission(user, "health_data.read");

  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    include: {
      investigation: true,
      statutoryNotification: true,
      involvedPersons: {
        orderBy: { createdAt: "asc" },
        include: {
          person: { select: { firstName: true, lastName: true } },
          healthDetail: { select: { fatal: true } },
        },
      },
    },
  });
  if (!incident || incident.siteId !== siteId) notFound();

  // Statutory notification duty — resolved live from the catalogue, only for a
  // verified country pack (AT/DE); CH/RO show nothing (honest gap, §3.15).
  const notificationAvailable = resolveNotificationCountryPack(site.country);
  const anyFatal = incident.involvedPersons.some(
    (ip) => ip.healthDetail?.fatal,
  );
  const notificationDuty = notificationAvailable
    ? await resolveIncidentNotification({
        country: site.country,
        type: incident.type,
        occurredAt: incident.occurredAt,
        fatal: anyFatal,
      })
    : null;

  const actions = await prisma.action.findMany({
    where: { incidentId },
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true, status: true },
  });

  // Company's persons to pick from (people compartment, company-scoped). Only
  // ids/names — no health data. Excludes those already linked.
  const linkedPersonIds = new Set(
    incident.involvedPersons.map((ip) => ip.personId),
  );
  const persons = (
    await prisma.person.findMany({
      where: { companyId: incident.companyId, active: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    })
  ).filter((p) => !linkedPersonIds.has(p.id));

  // Whether each involved person has a medical record on file — a NON-health
  // check (just existence, no decryption, no audit), so an admin can see "on
  // file (restricted)" without reading it.
  const healthOnFile = new Map<string, boolean>();
  for (const ip of incident.involvedPersons) {
    healthOnFile.set(ip.id, await hasHealthDetail(ip.id));
  }

  // P14 G4: fleet-vehicle link for a Fahrzeugereignis. Active vehicles + the
  // currently-linked one (even if retired) to pick from.
  const isVehicleEvent = incident.type === "FAHRZEUGEREIGNIS";
  const vehicles = isVehicleEvent
    ? await prisma.vehicle.findMany({
        where: {
          companyId: incident.companyId,
          OR: [
            { activeTo: null },
            ...(incident.vehicleId ? [{ id: incident.vehicleId }] : []),
          ],
        },
        orderBy: { identifier: "asc" },
        select: { id: true, identifier: true, type: true },
      })
    : [];

  const open = incident.status !== "CLOSED";

  async function triageAction(formData: FormData) {
    "use server";
    const { user } = await requireSiteAdministrationAccess(siteId);
    const severity = formData.get("severity");
    const workRelated = formData.get("workRelated");
    await triageIncident({
      incidentId,
      siteId,
      actorUserId: user.id,
      severity:
        typeof severity === "string" &&
        (RISK_BANDS as string[]).includes(severity)
          ? (severity as RiskBand)
          : null,
      isWorkRelated:
        workRelated === "yes" ? true : workRelated === "no" ? false : null,
      environmentalEventFlagged: formData.get("envFlag") === "on",
      assessmentReviewFlagged: formData.get("reviewFlag") === "on",
    });
    revalidatePath(`/app/s/${siteId}/incidents/${incidentId}`);
  }

  async function statusAction(formData: FormData) {
    "use server";
    const { user } = await requireSiteAdministrationAccess(siteId);
    const to = formData.get("to");
    if (
      to !== "UNDER_INVESTIGATION" &&
      to !== "ACTIONS_PENDING" &&
      to !== "CLOSED"
    ) {
      return;
    }
    await transitionIncident({ incidentId, siteId, to, actorUserId: user.id });
    revalidatePath(`/app/s/${siteId}/incidents/${incidentId}`);
  }

  async function investigationAction(formData: FormData) {
    "use server";
    const { user } = await requireSiteAdministrationAccess(siteId);
    const method = formData.get("method");
    const get = (k: string) => {
      const v = formData.get(k);
      return typeof v === "string" && v.length > 0 ? v : null;
    };
    await setIncidentInvestigation({
      incidentId,
      siteId,
      actorUserId: user.id,
      method:
        typeof method === "string" && (METHODS as string[]).includes(method)
          ? (method as IncidentInvestigationMethod)
          : "NARRATIVE",
      sequenceOfEvents: get("sequenceOfEvents"),
      directCauses: get("directCauses"),
      rootCauses: get("rootCauses"),
      contributingFactors: get("contributingFactors"),
      investigatedByUserId: user.id,
    });
    revalidatePath(`/app/s/${siteId}/incidents/${incidentId}`);
  }

  async function raiseAction(formData: FormData) {
    "use server";
    const { user } = await requireSiteAdministrationAccess(siteId);
    const title = formData.get("title");
    const roleLabel = formData.get("roleLabel");
    if (typeof title !== "string" || title.trim().length === 0) return;
    await raiseActionFromIncident({
      incidentId,
      siteId,
      actorUserId: user.id,
      title,
      responsibleRoleLabel: typeof roleLabel === "string" ? roleLabel : null,
    });
    revalidatePath(`/app/s/${siteId}/incidents/${incidentId}`);
  }

  async function setVehicleAction(formData: FormData) {
    "use server";
    const { user, site: s } = await requireSiteAdministrationAccess(siteId);
    const vid = formData.get("vehicleId");
    await setIncidentVehicle({
      incidentId,
      vehicleId: typeof vid === "string" && vid.length > 0 ? vid : null,
      companyId: s.companyId,
      actorUserId: user.id,
    });
    revalidatePath(`/app/s/${siteId}/incidents/${incidentId}`);
  }

  async function addPersonAction(formData: FormData) {
    "use server";
    const { user } = await requireSiteAdministrationAccess(siteId);
    const personId = formData.get("personId");
    const role = formData.get("role");
    if (
      typeof personId !== "string" ||
      personId.length === 0 ||
      typeof role !== "string" ||
      !(INVOLVED_ROLES as string[]).includes(role)
    ) {
      return;
    }
    await addInvolvedPerson({
      incidentId,
      siteId,
      personId,
      role: role as IncidentInvolvedRole,
      actorUserId: user.id,
    });
    revalidatePath(`/app/s/${siteId}/incidents/${incidentId}`);
  }

  async function removePersonAction(formData: FormData) {
    "use server";
    const { user } = await requireSiteAdministrationAccess(siteId);
    const involvedPersonId = formData.get("involvedPersonId");
    if (typeof involvedPersonId !== "string" || involvedPersonId.length === 0) {
      return;
    }
    await removeInvolvedPerson({
      involvedPersonId,
      siteId,
      actorUserId: user.id,
    });
    revalidatePath(`/app/s/${siteId}/incidents/${incidentId}`);
  }

  async function submitNotificationAction(formData: FormData) {
    "use server";
    const { user: actor } = await requireSiteAdministrationAccess(siteId);
    const dateRaw = formData.get("submittedAt");
    const ref = formData.get("referenceNumber");
    await recordNotificationSubmission({
      incidentId,
      siteId,
      actorUserId: actor.id,
      submittedAt:
        typeof dateRaw === "string" && dateRaw.length > 0
          ? new Date(dateRaw)
          : new Date(),
      referenceNumber: typeof ref === "string" ? ref : null,
    });
    revalidatePath(`/app/s/${siteId}/incidents/${incidentId}`);
  }

  async function waiveNotificationAction(formData: FormData) {
    "use server";
    const { user: actor } = await requireSiteAdministrationAccess(siteId);
    const note = formData.get("note");
    await waiveNotification({
      incidentId,
      siteId,
      actorUserId: actor.id,
      note: typeof note === "string" ? note : null,
    });
    revalidatePath(`/app/s/${siteId}/incidents/${incidentId}`);
  }

  const inv = incident.investigation;
  const notif = incident.statutoryNotification;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
      <div>
        <Link
          href={`/app/s/${siteId}/incidents/reports`}
          className="text-sm text-accent hover:underline"
        >
          {dict.back}
        </Link>
        <h1 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-bold text-foreground">
          {incident.title}
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">
          {dict.typeLabels[incident.type]} ·{" "}
          {dict.statusLabels[incident.status]} ·{" "}
          {incident.occurredAt.toISOString().slice(0, 16).replace("T", " ")}
        </p>
        <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
          {incident.description}
        </p>
        {incident.locationText ? (
          <p className="mt-1 text-xs text-foreground-subtle">
            {dict.locationLabel}: {incident.locationText}
          </p>
        ) : null}
      </div>

      {/* Status transitions */}
      <div className="flex flex-wrap gap-2">
        {incident.status === "TRIAGED" && (
          <form action={statusAction}>
            <input type="hidden" name="to" value="UNDER_INVESTIGATION" />
            <button
              type="submit"
              className="rounded-[var(--radius-md)] bg-accent px-4 py-2 text-sm font-medium text-background"
            >
              {dict.startInvestigation}
            </button>
          </form>
        )}
        {(incident.status === "TRIAGED" ||
          incident.status === "UNDER_INVESTIGATION") && (
          <form action={statusAction}>
            <input type="hidden" name="to" value="ACTIONS_PENDING" />
            <button
              type="submit"
              className="rounded border border-border px-4 py-2 text-sm hover:border-accent"
            >
              {dict.toActions}
            </button>
          </form>
        )}
        {open && incident.status !== "REPORTED" && (
          <form action={statusAction}>
            <input type="hidden" name="to" value="CLOSED" />
            <button
              type="submit"
              className="rounded border border-border px-4 py-2 text-sm hover:border-accent"
            >
              {dict.close}
            </button>
          </form>
        )}
        {incident.status === "CLOSED" && (
          <form action={statusAction}>
            <input type="hidden" name="to" value="ACTIONS_PENDING" />
            <button
              type="submit"
              className="rounded border border-border px-4 py-2 text-sm hover:border-accent"
            >
              {dict.reopen}
            </button>
          </form>
        )}
      </div>

      {/* Triage */}
      {open && (
        <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <h2 className="font-heading text-sm font-bold">
            {dict.triageHeading}
          </h2>
          <form
            action={triageAction}
            className="flex flex-wrap items-end gap-3 text-sm"
          >
            <label className="flex flex-col gap-1">
              {dict.severityLabel}
              <select
                name="severity"
                defaultValue={incident.severity ?? ""}
                className="rounded border border-border bg-background px-2 py-1"
              >
                <option value="">{dict.choosePlaceholder}</option>
                {RISK_BANDS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              {dict.workRelatedLabel}
              <select
                name="workRelated"
                defaultValue={
                  incident.isWorkRelated === true
                    ? "yes"
                    : incident.isWorkRelated === false
                      ? "no"
                      : ""
                }
                className="rounded border border-border bg-background px-2 py-1"
              >
                <option value="">{dict.choosePlaceholder}</option>
                <option value="yes">{dict.workRelatedYes}</option>
                <option value="no">{dict.workRelatedNo}</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="envFlag"
                defaultChecked={incident.environmentalEventFlagged}
              />
              {dict.envFlagLabel}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="reviewFlag"
                defaultChecked={incident.assessmentReviewFlagged}
              />
              {dict.reviewFlagLabel}
            </label>
            <button
              type="submit"
              className="rounded-[var(--radius-md)] bg-accent px-4 py-2 font-medium text-background"
            >
              {dict.triageButton}
            </button>
          </form>
        </section>
      )}

      {/* Investigation */}
      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="font-heading text-sm font-bold">
          {dict.investigationHeading}
        </h2>
        {open ? (
          <form
            action={investigationAction}
            className="flex flex-col gap-3 text-sm"
          >
            <label className="flex flex-col gap-1">
              {dict.methodLabel}
              <select
                name="method"
                defaultValue={inv?.method ?? "NARRATIVE"}
                className="w-48 rounded border border-border bg-background px-2 py-1"
              >
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {dict.methodLabels[m]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              {dict.sequenceLabel}
              <textarea
                name="sequenceOfEvents"
                rows={2}
                defaultValue={inv?.sequenceOfEvents ?? ""}
                className="rounded border border-border bg-background px-2 py-1"
              />
            </label>
            <label className="flex flex-col gap-1">
              {dict.directCausesLabel}
              <textarea
                name="directCauses"
                rows={2}
                defaultValue={inv?.directCauses ?? ""}
                className="rounded border border-border bg-background px-2 py-1"
              />
            </label>
            <label className="flex flex-col gap-1">
              {dict.rootCausesLabel}
              <textarea
                name="rootCauses"
                rows={2}
                defaultValue={inv?.rootCauses ?? ""}
                className="rounded border border-border bg-background px-2 py-1"
              />
            </label>
            <label className="flex flex-col gap-1">
              {dict.contributingLabel}
              <textarea
                name="contributingFactors"
                rows={2}
                defaultValue={inv?.contributingFactors ?? ""}
                className="rounded border border-border bg-background px-2 py-1"
              />
            </label>
            <div>
              <button
                type="submit"
                className="rounded-[var(--radius-md)] bg-accent px-4 py-2 font-medium text-background"
              >
                {dict.saveInvestigation}
              </button>
            </div>
          </form>
        ) : inv ? (
          <dl className="flex flex-col gap-2 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-foreground-subtle">
                {dict.methodLabel}
              </dt>
              <dd className="text-foreground">
                {dict.methodLabels[inv.method]}
              </dd>
            </div>
            {inv.sequenceOfEvents ? (
              <div>
                <dt className="text-xs uppercase tracking-wide text-foreground-subtle">
                  {dict.sequenceLabel}
                </dt>
                <dd className="whitespace-pre-wrap text-foreground">
                  {inv.sequenceOfEvents}
                </dd>
              </div>
            ) : null}
            {inv.rootCauses ? (
              <div>
                <dt className="text-xs uppercase tracking-wide text-foreground-subtle">
                  {dict.rootCausesLabel}
                </dt>
                <dd className="whitespace-pre-wrap text-foreground">
                  {inv.rootCauses}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className="text-sm text-foreground-muted">{dict.none}</p>
        )}
      </section>

      {/* Involved persons (people compartment, no health data here) */}
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-sm font-bold">
          {dict.involvedHeading}
        </h2>
        <p className="text-xs text-foreground-subtle">{dict.involvedNotice}</p>
        {incident.involvedPersons.length === 0 ? (
          <p className="text-sm text-foreground-muted">{dict.involvedEmpty}</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {incident.involvedPersons.map((ip) => (
              <li
                key={ip.id}
                className="flex items-center justify-between rounded border border-border bg-surface px-3 py-2"
              >
                <span className="text-foreground">
                  {ip.person.firstName} {ip.person.lastName}
                  <span className="ml-2 text-xs text-foreground-subtle">
                    {dict.roleLabels[ip.role]}
                  </span>
                  <span className="ml-2 text-xs text-foreground-subtle">
                    {healthOnFile.get(ip.id)
                      ? dict.healthOnFile
                      : dict.healthNone}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  {canReadHealth && (
                    <Link
                      href={`/app/s/${siteId}/incidents/${incidentId}/health/${ip.id}`}
                      className="text-xs text-accent hover:underline"
                    >
                      {dict.healthViewLink}
                    </Link>
                  )}
                  {open && (
                    <form action={removePersonAction}>
                      <input
                        type="hidden"
                        name="involvedPersonId"
                        value={ip.id}
                      />
                      <button
                        type="submit"
                        className="text-xs text-foreground-subtle hover:text-status-high"
                      >
                        {dict.removePersonButton}
                      </button>
                    </form>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        {open &&
          (persons.length === 0 ? (
            <p className="text-xs text-foreground-subtle">{dict.noPersons}</p>
          ) : (
            <form
              action={addPersonAction}
              className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface p-3 text-sm"
            >
              <label className="flex flex-1 flex-col gap-1">
                {dict.addPersonLabel}
                <select
                  name="personId"
                  required
                  className="rounded border border-border bg-background px-2 py-1"
                >
                  {persons.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.lastName}, {p.firstName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                {dict.roleLabel}
                <select
                  name="role"
                  defaultValue="INJURED"
                  className="rounded border border-border bg-background px-2 py-1"
                >
                  {INVOLVED_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {dict.roleLabels[r]}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                className="rounded-[var(--radius-md)] bg-accent px-3 py-2 font-medium text-background"
              >
                {dict.addPersonButton}
              </button>
            </form>
          ))}
      </section>

      {/* P14 G4: fleet-vehicle link (Fahrzeugereignis only) */}
      {isVehicleEvent && (
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-sm font-bold">
            {dict.vehicleHeading}
          </h2>
          <form action={setVehicleAction} className="flex items-end gap-3">
            <label className="flex flex-col gap-1 text-sm">
              {dict.vehicleLabel}
              <select
                name="vehicleId"
                defaultValue={incident.vehicleId ?? ""}
                className="rounded border border-border bg-background px-2 py-1"
              >
                <option value="">{dict.vehicleNone}</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.identifier} · {v.type}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="rounded-[var(--radius-md)] border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-raised"
            >
              {dict.vehicleSave}
            </button>
          </form>
        </section>
      )}

      {/* Corrective actions */}
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-sm font-bold">
          {dict.actionsHeading}
        </h2>
        {actions.length === 0 ? (
          <p className="text-sm text-foreground-muted">{dict.actionsEmpty}</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {actions.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between rounded border border-border bg-surface px-3 py-2"
              >
                <span className="text-foreground">{a.title}</span>
                <Link
                  href={`/app/s/${siteId}/actions/${a.id}`}
                  className="text-xs text-accent hover:underline"
                >
                  {a.status}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {open && (
          <form
            action={raiseAction}
            className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface p-3 text-sm"
          >
            <label className="flex flex-1 flex-col gap-1">
              {dict.actionTitleLabel}
              <input
                name="title"
                required
                className="rounded border border-border bg-background px-2 py-1"
              />
            </label>
            <label className="flex flex-col gap-1">
              {dict.actionRoleLabel}
              <input
                name="roleLabel"
                className="rounded border border-border bg-background px-2 py-1"
              />
            </label>
            <button
              type="submit"
              className="rounded-[var(--radius-md)] bg-accent px-3 py-2 font-medium text-background"
            >
              {dict.raiseButton}
            </button>
          </form>
        )}
      </section>

      {/* Statutory notification duty (country-gated) */}
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-sm font-bold">
          {dict.notificationsHeading}
        </h2>
        {notificationDuty && notificationDuty.duty.kind !== "none" ? (
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 text-sm">
            <p className="font-medium text-foreground">
              {notificationDuty.duty.kind === "deadline"
                ? dict.dutyDeadline
                    .replace(
                      "{date}",
                      notificationDuty.duty.dueAt.toISOString().slice(0, 10),
                    )
                    .replace(
                      "{days}",
                      String(notificationDuty.duty.durationDays),
                    )
                : notificationDuty.duty.kind === "immediate"
                  ? dict.dutyImmediate
                  : dict.dutyAsap}
            </p>
            {notificationDuty.clockStartsText ? (
              <p className="text-xs text-foreground-subtle">
                {dict.clockStartsLabel}: {notificationDuty.clockStartsText}
              </p>
            ) : null}
            {notificationDuty.legalReference ? (
              <p className="text-xs text-foreground-subtle">
                {notificationDuty.legalReference.code} —{" "}
                {notificationDuty.legalReference.obligation}
              </p>
            ) : null}
            {notificationDuty.worksCouncilCoSign ? (
              <p className="text-xs text-info">{dict.worksCouncilReminder}</p>
            ) : null}
            <p className="text-sm">
              {dict.notificationStatusLabel}:{" "}
              <span className="font-medium">
                {notif?.status === "SUBMITTED"
                  ? dict.notifSubmitted
                      .replace(
                        "{date}",
                        notif.submittedAt
                          ? notif.submittedAt.toISOString().slice(0, 10)
                          : "—",
                      )
                      .replace("{ref}", notif.referenceNumber ?? "—")
                  : notif?.status === "WAIVED"
                    ? dict.notifWaived
                    : dict.notifOpen}
              </span>
            </p>
            <a
              href={`/api/incidents/${incidentId}/notification`}
              className="text-sm text-accent hover:underline"
            >
              {dict.downloadDataSheet}
            </a>
            {open && (
              <div className="mt-2 flex flex-wrap gap-4">
                <form
                  action={submitNotificationAction}
                  className="flex flex-wrap items-end gap-2"
                >
                  <label className="flex flex-col gap-1">
                    {dict.submittedAtLabel}
                    <input
                      type="date"
                      name="submittedAt"
                      className="rounded border border-border bg-background px-2 py-1"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    {dict.referenceNumberLabel}
                    <input
                      name="referenceNumber"
                      className="rounded border border-border bg-background px-2 py-1"
                    />
                  </label>
                  <button
                    type="submit"
                    className="rounded-[var(--radius-md)] bg-accent px-3 py-2 font-medium text-background"
                  >
                    {dict.markSubmitted}
                  </button>
                </form>
                <form
                  action={waiveNotificationAction}
                  className="flex items-end gap-2"
                >
                  <label className="flex flex-col gap-1">
                    {dict.waiveReasonLabel}
                    <input
                      name="note"
                      className="rounded border border-border bg-background px-2 py-1"
                    />
                  </label>
                  <button
                    type="submit"
                    className="rounded border border-border px-3 py-2 hover:border-accent"
                  >
                    {dict.markWaived}
                  </button>
                </form>
              </div>
            )}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-border bg-surface p-4 text-sm text-foreground-muted">
            {notificationAvailable ? dict.noDutyForType : dict.noDutyForCountry}
          </p>
        )}
      </section>
    </div>
  );
}
