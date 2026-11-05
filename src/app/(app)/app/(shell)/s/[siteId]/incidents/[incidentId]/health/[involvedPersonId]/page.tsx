import { revalidatePath } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BodyRegionCoarse, InjuryType } from "@/generated/prisma/enums";
import { hasPermission } from "@/lib/auth/permissions";
import { requireSiteAccess } from "@/lib/auth/require-access";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import {
  readIncidentHealthDetail,
  writeIncidentHealthDetail,
} from "@/lib/incidents/health";
import { prisma } from "@/lib/prisma";

const INJURY_TYPES = Object.values(InjuryType);
const BODY_REGIONS = Object.values(BodyRegionCoarse);

// P10c health sub-compartment surface — physician-only. Fail-closed:
// requireSiteAccess scopes the site, then health_data.read gates the page
// (anything else 404s, never confirming the medical record exists). The read
// itself is audited inside readIncidentHealthDetail (§3.18(c)).
export default async function IncidentHealthPage({
  params,
}: {
  params: Promise<{
    siteId: string;
    incidentId: string;
    involvedPersonId: string;
  }>;
}) {
  const { siteId, incidentId, involvedPersonId } = await params;
  const { user } = await requireSiteAccess(siteId);
  if (!hasPermission(user, "health_data.read")) notFound();
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).incidents;

  const link = await prisma.incidentInvolvedPerson.findUnique({
    where: { id: involvedPersonId },
    include: {
      incident: { select: { id: true, siteId: true, title: true } },
      person: { select: { firstName: true, lastName: true } },
    },
  });
  if (
    !link ||
    link.incident.id !== incidentId ||
    link.incident.siteId !== siteId
  ) {
    notFound();
  }

  // Audited read (writes a health_data.read AuditEvent before returning).
  const detail = await readIncidentHealthDetail(involvedPersonId, user);
  const canWrite = hasPermission(user, "health_data.write");

  async function saveAction(formData: FormData) {
    "use server";
    const { user: actor } = await requireSiteAccess(siteId);
    if (!hasPermission(actor, "health_data.write")) notFound();
    const str = (k: string) => {
      const v = formData.get(k);
      return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
    };
    const num = (k: string) => {
      const v = str(k);
      return v === null ? null : Number.parseInt(v, 10);
    };
    const enumVal = <T extends string>(k: string, allowed: readonly T[]) => {
      const v = str(k);
      return v !== null && (allowed as readonly string[]).includes(v)
        ? (v as T)
        : null;
    };
    await writeIncidentHealthDetail(involvedPersonId, actor, {
      injuryType: enumVal("injuryType", INJURY_TYPES),
      bodyRegion: enumVal("bodyRegion", BODY_REGIONS),
      incapacityDays: num("incapacityDays"),
      fatal: formData.get("fatal") === "on",
      medicalTreatmentGiven: formData.get("medicalTreatmentGiven") === "on",
      diagnosis: str("diagnosis"),
      treatmentNotes: str("treatmentNotes"),
      medicalHistoryNote: str("medicalHistoryNote"),
    });
    revalidatePath(
      `/app/s/${siteId}/incidents/${incidentId}/health/${involvedPersonId}`,
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <div>
        <Link
          href={`/app/s/${siteId}/incidents/${incidentId}`}
          className="text-sm text-accent hover:underline"
        >
          {dict.healthBack}
        </Link>
        <h1 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-bold text-foreground">
          {dict.healthHeading}
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">
          {link.person.firstName} {link.person.lastName} · {link.incident.title}
        </p>
        <p className="mt-2 rounded border border-dashed border-border bg-surface p-2 text-xs text-foreground-subtle">
          {dict.healthManagedNote}
        </p>
      </div>

      <form action={saveAction} className="flex flex-col gap-4 text-sm">
        <div className="flex flex-wrap gap-4">
          <label className="flex flex-col gap-1">
            {dict.injuryTypeLabel}
            <select
              name="injuryType"
              defaultValue={detail?.injuryType ?? ""}
              disabled={!canWrite}
              className="rounded border border-border bg-background px-2 py-1"
            >
              <option value="">{dict.choosePlaceholder}</option>
              {INJURY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {dict.injuryTypeLabels[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            {dict.bodyRegionLabel}
            <select
              name="bodyRegion"
              defaultValue={detail?.bodyRegion ?? ""}
              disabled={!canWrite}
              className="rounded border border-border bg-background px-2 py-1"
            >
              <option value="">{dict.choosePlaceholder}</option>
              {BODY_REGIONS.map((r) => (
                <option key={r} value={r}>
                  {dict.bodyRegionLabels[r]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            {dict.incapacityDaysLabel}
            <input
              type="number"
              min="0"
              name="incapacityDays"
              defaultValue={detail?.incapacityDays ?? ""}
              disabled={!canWrite}
              className="w-28 rounded border border-border bg-background px-2 py-1"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="fatal"
              defaultChecked={detail?.fatal ?? false}
              disabled={!canWrite}
            />
            {dict.fatalLabel}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="medicalTreatmentGiven"
              defaultChecked={detail?.medicalTreatmentGiven ?? false}
              disabled={!canWrite}
            />
            {dict.treatmentGivenLabel}
          </label>
        </div>
        <label className="flex flex-col gap-1">
          {dict.diagnosisLabel}
          <textarea
            name="diagnosis"
            rows={2}
            defaultValue={detail?.diagnosis ?? ""}
            disabled={!canWrite}
            className="rounded border border-border bg-background px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1">
          {dict.treatmentNotesLabel}
          <textarea
            name="treatmentNotes"
            rows={2}
            defaultValue={detail?.treatmentNotes ?? ""}
            disabled={!canWrite}
            className="rounded border border-border bg-background px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1">
          {dict.medicalHistoryLabel}
          <textarea
            name="medicalHistoryNote"
            rows={2}
            defaultValue={detail?.medicalHistoryNote ?? ""}
            disabled={!canWrite}
            className="rounded border border-border bg-background px-2 py-1"
          />
        </label>
        {canWrite && (
          <div>
            <button
              type="submit"
              className="rounded-[var(--radius-md)] bg-accent px-4 py-2 font-medium text-background"
            >
              {dict.saveHealth}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
