import type { BodyRegionCoarse, InjuryType } from "@/generated/prisma/enums";
import type { PlatformUserModel } from "@/generated/prisma/models";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { decryptHealthField, encryptHealthField } from "./health-crypto";

// P10c (SLD_P10_COMPARTMENT_DESIGN_NOTE.md §5/§7) — the ONLY path that reads or
// writes the health sub-compartment. Two hard rules enforced here, not in the
// UI (fail-closed at the gate):
//   - a READ requires health_data.read AND records an AuditEvent BEFORE
//     returning any plaintext (ERGO §3.18(c) — the one place a read is audited);
//   - a WRITE requires health_data.write.
// Both permissions are granted to no role but OCCUPATIONAL_PHYSICIAN
// (§3.18(b)). Free-text medical fields are encrypted/decrypted here; the diff
// on a write records WHICH fields were set, never their values.

export type HealthActor = Pick<PlatformUserModel, "id" | "role">;

export type IncidentHealthInput = {
  injuryType?: InjuryType | null;
  bodyRegion?: BodyRegionCoarse | null;
  incapacityDays?: number | null;
  fatal?: boolean;
  medicalTreatmentGiven?: boolean;
  diagnosis?: string | null;
  treatmentNotes?: string | null;
  medicalHistoryNote?: string | null;
};

export type IncidentHealthView = {
  id: string;
  injuryType: InjuryType | null;
  bodyRegion: BodyRegionCoarse | null;
  incapacityDays: number | null;
  fatal: boolean;
  medicalTreatmentGiven: boolean;
  diagnosis: string | null;
  treatmentNotes: string | null;
  medicalHistoryNote: string | null;
};

async function resolveScope(involvedPersonId: string) {
  const link = await prisma.incidentInvolvedPerson.findUnique({
    where: { id: involvedPersonId },
    select: {
      id: true,
      incident: { select: { siteId: true, companyId: true } },
    },
  });
  return link;
}

// Create or update the health detail for an involved person. Requires
// health_data.write. Free-text fields are encrypted before persistence.
export async function writeIncidentHealthDetail(
  involvedPersonId: string,
  actor: HealthActor,
  input: IncidentHealthInput,
): Promise<{ id: string }> {
  if (!hasPermission(actor, "health_data.write")) {
    throw new Error("Forbidden: health_data.write required");
  }
  const link = await resolveScope(involvedPersonId);
  if (!link) throw new Error("Involved person not found");

  const data = {
    injuryType: input.injuryType ?? null,
    bodyRegion: input.bodyRegion ?? null,
    incapacityDays: input.incapacityDays ?? null,
    fatal: input.fatal ?? false,
    medicalTreatmentGiven: input.medicalTreatmentGiven ?? false,
    diagnosisEnc: encryptHealthField(input.diagnosis ?? null),
    treatmentNotesEnc: encryptHealthField(input.treatmentNotes ?? null),
    medicalHistoryNoteEnc: encryptHealthField(input.medicalHistoryNote ?? null),
    createdByUserId: actor.id,
  };
  const row = await prisma.incidentHealthDetail.upsert({
    where: { incidentInvolvedPersonId: involvedPersonId },
    create: { incidentInvolvedPersonId: involvedPersonId, ...data },
    update: data,
  });

  // Diff records WHICH fields carry a value — never the plaintext.
  await recordAuditEvent({
    actorUserId: actor.id,
    action: "health_data.write",
    entityType: "IncidentHealthDetail",
    entityId: row.id,
    companyId: link.incident.companyId,
    siteId: link.incident.siteId,
    diff: {
      injuryType: data.injuryType,
      bodyRegion: data.bodyRegion,
      incapacityDays: data.incapacityDays,
      fatal: data.fatal,
      medicalTreatmentGiven: data.medicalTreatmentGiven,
      hasDiagnosis: data.diagnosisEnc !== null,
      hasTreatmentNotes: data.treatmentNotesEnc !== null,
      hasMedicalHistory: data.medicalHistoryNoteEnc !== null,
    },
  });
  return { id: row.id };
}

// Read + decrypt the health detail. Requires health_data.read AND writes a
// health_data.read AuditEvent BEFORE returning plaintext. Returns null when no
// detail exists yet (still audits the attempt — a read was made).
export async function readIncidentHealthDetail(
  involvedPersonId: string,
  actor: HealthActor,
): Promise<IncidentHealthView | null> {
  if (!hasPermission(actor, "health_data.read")) {
    throw new Error("Forbidden: health_data.read required");
  }
  const link = await resolveScope(involvedPersonId);
  if (!link) throw new Error("Involved person not found");

  const row = await prisma.incidentHealthDetail.findUnique({
    where: { incidentInvolvedPersonId: involvedPersonId },
  });

  // Audit the READ before returning anything (§3.18(c)).
  await recordAuditEvent({
    actorUserId: actor.id,
    action: "health_data.read",
    entityType: "IncidentHealthDetail",
    entityId: row?.id ?? involvedPersonId,
    companyId: link.incident.companyId,
    siteId: link.incident.siteId,
  });

  if (!row) return null;
  return {
    id: row.id,
    injuryType: row.injuryType,
    bodyRegion: row.bodyRegion,
    incapacityDays: row.incapacityDays,
    fatal: row.fatal,
    medicalTreatmentGiven: row.medicalTreatmentGiven,
    diagnosis: decryptHealthField(row.diagnosisEnc),
    treatmentNotes: decryptHealthField(row.treatmentNotesEnc),
    medicalHistoryNote: decryptHealthField(row.medicalHistoryNoteEnc),
  };
}

// Does a health detail row exist for this involved person? A NON-health check
// (no permission, no decryption, no audit) — lets a non-physician UI show
// "medical record on file (restricted)" without reading it.
export async function hasHealthDetail(
  involvedPersonId: string,
): Promise<boolean> {
  const c = await prisma.incidentHealthDetail.count({
    where: { incidentInvolvedPersonId: involvedPersonId },
  });
  return c > 0;
}
