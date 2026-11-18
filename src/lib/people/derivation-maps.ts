import "server-only";

import type {
  DerivationMaps,
  RequirementSource,
} from "@/lib/people/requirement-derivation";
import { prisma } from "@/lib/prisma";

// P7d §A.2 / P17 §4–§5: build the company-wide requirement-derivation maps
// (and the requirement-source list) from the DB, once. Extracted verbatim from
// the admin instruction-matrix page so the manager matrix and the employee
// self-service view share one implementation and can never disagree about
// which trainings a person is required to do.
export async function buildCompanyDerivationMaps(companyId: string): Promise<{
  maps: DerivationMaps;
  sources: RequirementSource[];
}> {
  const [orgUnits, sourceRows, workstations, companyProcessTasks, activeUses] =
    await Promise.all([
      prisma.orgUnit.findMany({
        where: { site: { companyId } },
        select: { id: true, parentId: true },
      }),
      prisma.trainingRequirementSource.findMany({
        where: {
          requirementType: { OR: [{ companyId }, { companyId: null }] },
        },
        select: { requirementTypeId: true, subjectType: true, subjectId: true },
      }),
      prisma.workstation.findMany({
        where: { site: { companyId } },
        select: { id: true, orgUnitId: true },
      }),
      prisma.processTask.findMany({
        where: { process: { site: { companyId } } },
        select: { processId: true, task: { select: { workstationId: true } } },
      }),
      prisma.substanceUse.findMany({
        where: { substance: { companyId }, activeTo: null },
        select: {
          substanceId: true,
          workstationId: true,
          processId: true,
          orgUnitId: true,
        },
      }),
    ]);

  const workstationOrgUnit = new Map(
    workstations.map((w) => [w.id, w.orgUnitId]),
  );

  const parentOf = new Map(orgUnits.map((o) => [o.id, o.parentId]));
  const orgUnitAncestors = new Map<string, string[]>();
  for (const o of orgUnits) {
    const chain: string[] = [];
    let cur: string | null = o.id;
    const seen = new Set<string>();
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      chain.push(cur);
      cur = parentOf.get(cur) ?? null;
    }
    orgUnitAncestors.set(o.id, chain);
  }

  const processWorkstations = new Map<string, Set<string>>();
  for (const pt of companyProcessTasks) {
    const set = processWorkstations.get(pt.processId) ?? new Set<string>();
    if (pt.task.workstationId) set.add(pt.task.workstationId);
    processWorkstations.set(pt.processId, set);
  }

  const substanceSubjects = new Map<
    string,
    {
      workstationIds: Set<string>;
      orgUnitIds: Set<string>;
      processIds: Set<string>;
    }
  >();
  for (const use of activeUses) {
    const entry = substanceSubjects.get(use.substanceId) ?? {
      workstationIds: new Set<string>(),
      orgUnitIds: new Set<string>(),
      processIds: new Set<string>(),
    };
    if (use.workstationId) entry.workstationIds.add(use.workstationId);
    if (use.orgUnitId) entry.orgUnitIds.add(use.orgUnitId);
    if (use.processId) entry.processIds.add(use.processId);
    substanceSubjects.set(use.substanceId, entry);
  }

  const maps: DerivationMaps = {
    workstationOrgUnit,
    orgUnitAncestors,
    processWorkstations,
    substanceSubjects,
  };
  const sources: RequirementSource[] = sourceRows.map((s) => ({
    requirementTypeId: s.requirementTypeId,
    subjectType: s.subjectType,
    subjectId: s.subjectId,
  }));
  return { maps, sources };
}

// The person's active (valid-now) assignments, as the derivation input shape.
export async function activeAssignmentsForPerson(
  personId: string,
  now: Date,
): Promise<{ workstationId: string | null; orgUnitId: string | null }[]> {
  const rows = await prisma.personAssignment.findMany({
    where: { personId },
    select: {
      workstationId: true,
      orgUnitId: true,
      validFrom: true,
      validUntil: true,
    },
  });
  return rows
    .filter((a) => !(a.validFrom && a.validFrom > now))
    .filter((a) => !(a.validUntil && a.validUntil < now))
    .map((a) => ({ workstationId: a.workstationId, orgUnitId: a.orgUnitId }));
}
