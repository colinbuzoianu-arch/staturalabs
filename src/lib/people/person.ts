import type { PersonModel } from "@/generated/prisma/models";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { prisma } from "@/lib/prisma";

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
  const person = await prisma.person.update({
    where: { id: personId },
    data: {
      firstName: "",
      lastName: "",
      personnelNumber: null,
      platformUserId: null,
      active: false,
      anonymisedAt: new Date(),
    },
  });
  await recordAuditEvent({
    actorUserId,
    action: "person.anonymise",
    entityType: "Person",
    entityId: personId,
    companyId: person.companyId,
  });
}
