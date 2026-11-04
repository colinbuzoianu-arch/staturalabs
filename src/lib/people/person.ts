import type { PersonModel } from "@/generated/prisma/models";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { prisma } from "@/lib/prisma";
import type { ImportRowResult } from "./csv-import";

// P7a people compartment write gates (SLD_P7_COMPARTMENT_DESIGN_NOTE.md).
// Every mutation records an AuditEvent (ERGO §3.18(d)) with the acting
// PlatformUser. No `import "server-only"` — directly unit-testable with a
// mocked prisma, same as the other lib gates. The compartment holds no FK
// into the assessment chain (orgUnitId is a plain column), so nothing here
// can leak a person onto a score.

export type CreatePersonInput = {
  companyId: string;
  firstName: string;
  lastName: string;
  personnelNumber?: string | null;
  orgUnitId?: string | null;
  employmentStart?: Date | null;
  employmentEnd?: Date | null;
  actorUserId: string;
};

export async function createPerson(
  input: CreatePersonInput,
): Promise<PersonModel> {
  const person = await prisma.person.create({
    data: {
      companyId: input.companyId,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      personnelNumber: input.personnelNumber?.trim() || null,
      orgUnitId: input.orgUnitId ?? null,
      employmentStart: input.employmentStart ?? null,
      employmentEnd: input.employmentEnd ?? null,
    },
  });
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "person.create",
    entityType: "Person",
    entityId: person.id,
    companyId: input.companyId,
  });
  return person;
}

// Soft deactivation (active=false). Reversible; does NOT scrub identity.
export async function deactivatePerson(
  personId: string,
  actorUserId: string,
): Promise<void> {
  const person = await prisma.person.update({
    where: { id: personId },
    data: { active: false },
  });
  await recordAuditEvent({
    actorUserId,
    action: "person.deactivate",
    entityType: "Person",
    entityId: personId,
    companyId: person.companyId,
  });
}

// Irreversible anonymisation (§3.2): scrub the identifying fields and the
// self-service link, keep the row (and any proof rows that reference it) so
// the record that something happened survives while the WHO is de-identified.
// Stamps anonymisedAt. Deactivates in the same step.
export async function anonymisePerson(
  personId: string,
  actorUserId: string,
): Promise<void> {
  // §C.4: name → "Anonymisiert-<short>", personnel number + self-service link
  // cleared, assignments deleted (they carry no value once anonymous), while
  // training records/session attendance survive as anonymous rows so aggregate
  // statistics still work. The audit stores the id, never the removed name.
  const short = personId.slice(0, 8);
  const person = await prisma.$transaction(async (tx) => {
    await tx.personAssignment.deleteMany({ where: { personId } });
    return tx.person.update({
      where: { id: personId },
      data: {
        firstName: "",
        lastName: `Anonymisiert-${short}`,
        personnelNumber: null,
        platformUserId: null,
        active: false,
        anonymisedAt: new Date(),
      },
    });
  });
  await recordAuditEvent({
    actorUserId,
    action: "person.anonymise",
    entityType: "Person",
    entityId: personId,
    companyId: person.companyId,
  });
}

// P7b CSV import commit (SLD_P7_COMPARTMENT_DESIGN_NOTE.md / plan §7.7).
// Applies an already-validated import plan: "create" and "update" rows only
// ("error" rows are left for the importer to fix, never silently coerced).
// One person.import audit event records the counts. The caller re-builds the
// plan server-side from the raw CSV (never trusting the client's preview).
export async function importPersons(
  companyId: string,
  actorUserId: string,
  rows: readonly ImportRowResult[],
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;
  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      const v = row.values;
      if (row.action === "create") {
        await tx.person.create({
          data: {
            companyId,
            firstName: v.firstName,
            lastName: v.lastName,
            personnelNumber: v.personnelNumber,
            orgUnitId: v.orgUnitId,
            employmentStart: v.employmentStart
              ? new Date(v.employmentStart)
              : null,
          },
        });
        created++;
      } else if (row.action === "update" && row.existingPersonId) {
        // Scope the update to the company (defence in depth — the id came from
        // this company's existing-by-personnel-number map).
        const res = await tx.person.updateMany({
          where: { id: row.existingPersonId, companyId },
          data: {
            firstName: v.firstName,
            lastName: v.lastName,
            orgUnitId: v.orgUnitId,
            employmentStart: v.employmentStart
              ? new Date(v.employmentStart)
              : null,
          },
        });
        if (res.count > 0) updated++;
      }
    }
  });

  await recordAuditEvent({
    actorUserId,
    action: "person.import",
    entityType: "Person",
    companyId,
    diff: { created, updated },
  });
  return { created, updated };
}
