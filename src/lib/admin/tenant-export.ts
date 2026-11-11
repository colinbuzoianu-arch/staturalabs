import "server-only";

import { recordAuditEvent } from "@/lib/audit/audit-event";
import { prisma } from "@/lib/prisma";

// P13 §5 data portability. A complete structured (JSON) export of one company.
// Person data is included (names, training proof, incident involvement) because
// the requester — a super_admin or the company's own admin — is entitled to the
// tenant's own records. The ENCRYPTED health free-text is NEVER included here
// (no health_data.read in scope); the coarse injury classification is, as it is
// the non-health data sheet side (D2). Stored document binaries are referenced
// by path + sha (not bundled) — binary bundling is a documented follow-up.

export async function exportCompany(input: {
  companyId: string;
  actorUserId: string;
}): Promise<Record<string, unknown>> {
  const companyId = input.companyId;
  const siteIds = (
    await prisma.site.findMany({ where: { companyId }, select: { id: true } })
  ).map((s) => s.id);

  const [
    company,
    sites,
    orgUnits,
    workstations,
    processes,
    riskAssessments,
    riskFindings,
    actions,
    environmentalAssessments,
    environmentalFindings,
    incidents,
    involvedPersons,
    incidentHealthCoarse,
    inspections,
    substances,
    substanceUses,
    wasteStreams,
    persons,
    trainingRecords,
    siteLegalRequirements,
    complianceEvaluations,
    generatedDocuments,
    workforcePeriods,
  ] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId } }),
    prisma.site.findMany({ where: { companyId } }),
    prisma.orgUnit.findMany({ where: { siteId: { in: siteIds } } }),
    prisma.workstation.findMany({ where: { siteId: { in: siteIds } } }),
    prisma.process.findMany({ where: { siteId: { in: siteIds } } }),
    prisma.riskAssessment.findMany({ where: { siteId: { in: siteIds } } }),
    prisma.riskFinding.findMany({
      where: { riskAssessment: { siteId: { in: siteIds } } },
    }),
    prisma.action.findMany({ where: { siteId: { in: siteIds } } }),
    prisma.environmentalAssessment.findMany({
      where: { siteId: { in: siteIds } },
    }),
    prisma.environmentalFinding.findMany({
      where: { environmentalAssessment: { siteId: { in: siteIds } } },
    }),
    prisma.incident.findMany({ where: { companyId } }),
    prisma.incidentInvolvedPerson.findMany({
      where: { incident: { companyId } },
    }),
    prisma.incidentHealthDetail.findMany({
      where: { involvedPerson: { incident: { companyId } } },
      // Coarse only — never the encrypted *Enc free-text.
      select: {
        id: true,
        incidentInvolvedPersonId: true,
        injuryType: true,
        bodyRegion: true,
        incapacityDays: true,
        fatal: true,
        medicalTreatmentGiven: true,
      },
    }),
    prisma.inspection.findMany({ where: { siteId: { in: siteIds } } }),
    prisma.substance.findMany({ where: { companyId } }),
    prisma.substanceUse.findMany({ where: { siteId: { in: siteIds } } }),
    prisma.wasteStream.findMany({ where: { siteId: { in: siteIds } } }),
    prisma.person.findMany({ where: { companyId } }),
    prisma.trainingRecord.findMany({ where: { person: { companyId } } }),
    prisma.siteLegalRequirement.findMany({
      where: { siteId: { in: siteIds } },
    }),
    prisma.complianceEvaluation.findMany({
      where: { siteLegalRequirement: { siteId: { in: siteIds } } },
    }),
    prisma.generatedDocument.findMany({
      where: { siteId: { in: siteIds } },
      select: {
        id: true,
        type: true,
        title: true,
        sha256: true,
        storagePath: true,
        country: true,
        generatedAt: true,
      },
    }),
    prisma.siteWorkforcePeriod.findMany({ where: { siteId: { in: siteIds } } }),
  ]);

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "tenant.export",
    entityType: "Company",
    entityId: companyId,
    companyId,
    diff: { sites: sites.length, persons: persons.length },
  });

  return {
    exportedAt: new Date().toISOString(),
    note: "Structured export. Encrypted health free-text is excluded; stored documents are referenced by sha256 + storagePath, not bundled.",
    company,
    sites,
    orgUnits,
    workstations,
    processes,
    riskAssessments,
    riskFindings,
    actions,
    environmentalAssessments,
    environmentalFindings,
    incidents,
    involvedPersons,
    incidentHealthCoarse,
    inspections,
    substances,
    substanceUses,
    wasteStreams,
    persons,
    trainingRecords,
    siteLegalRequirements,
    complianceEvaluations,
    generatedDocuments,
    workforcePeriods,
  };
}

// P13 §5 / P7: one person's records across the people compartment (DSAR).
export async function exportPerson(input: {
  personId: string;
  actorUserId: string;
}): Promise<Record<string, unknown>> {
  const person = await prisma.person.findUnique({
    where: { id: input.personId },
    include: {
      assignments: true,
      trainingRecords: true,
      involvedInIncidents: {
        include: {
          // Coarse health only, never the encrypted free-text.
          healthDetail: {
            select: {
              injuryType: true,
              bodyRegion: true,
              incapacityDays: true,
              fatal: true,
            },
          },
        },
      },
    },
  });
  if (!person) throw new Error("Person not found");
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "person.export",
    entityType: "Person",
    entityId: input.personId,
    companyId: person.companyId,
  });
  return {
    exportedAt: new Date().toISOString(),
    note: "Data-subject export across the people compartment. Encrypted health free-text excluded.",
    person,
  };
}
