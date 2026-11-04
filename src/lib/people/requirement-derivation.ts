import type { RequirementSourceType } from "@/generated/prisma/enums";

// P7d §A.2 (SLD_P7B_DEFERRALS_RESOLVED.md): derive which training requirement
// types apply to a person, and WHY. Pure — no DB; the caller resolves the maps
// from Prisma. Requirements attach at job level and a person inherits them
// through their active PersonAssignments:
//   WORKSTATION → persons assigned to that workstation
//   ORG_UNIT    → persons assigned to that unit, a descendant unit, or a
//                 workstation in them (a requirement on an ANCESTOR applies down)
//   PROCESS     → persons assigned to a workstation that hosts a task of it
//   SUBSTANCE   → reserved (P8); never matched here
// SELF/manager scoping is a separate concern (the matrix view); this answers
// only "what is required for this person".

export type DerivationAssignment = {
  workstationId: string | null;
  orgUnitId: string | null;
};

export type RequirementSource = {
  requirementTypeId: string;
  subjectType: RequirementSourceType;
  subjectId: string;
};

export type DerivationMaps = {
  // workstation id → its org unit id (null if unplaced).
  workstationOrgUnit: Map<string, string | null>;
  // org unit id → [self, parent, grandparent, …] (self first).
  orgUnitAncestors: Map<string, string[]>;
  // process id → set of workstation ids hosting its tasks.
  processWorkstations: Map<string, Set<string>>;
};

export type DerivedRequirement = {
  requirementTypeId: string;
  sources: RequirementSource[]; // every source that makes it apply (the "why")
};

export function deriveRequiredTrainings(
  assignments: readonly DerivationAssignment[],
  sources: readonly RequirementSource[],
  maps: DerivationMaps,
): DerivedRequirement[] {
  // The person's directly-assigned workstations and org units.
  const workstationIds = new Set<string>();
  const directOrgUnits = new Set<string>();
  for (const a of assignments) {
    if (a.workstationId) {
      workstationIds.add(a.workstationId);
      const ou = maps.workstationOrgUnit.get(a.workstationId);
      if (ou) directOrgUnits.add(ou);
    }
    if (a.orgUnitId) directOrgUnits.add(a.orgUnitId);
  }

  // Expand to ancestors: a requirement on an ANCESTOR of a unit the person is
  // in applies to them (inherits down the tree).
  const coveredOrgUnits = new Set<string>();
  for (const ou of directOrgUnits) {
    for (const anc of maps.orgUnitAncestors.get(ou) ?? [ou]) {
      coveredOrgUnits.add(anc);
    }
  }

  const byType = new Map<string, RequirementSource[]>();
  const add = (s: RequirementSource) => {
    const list = byType.get(s.requirementTypeId) ?? [];
    list.push(s);
    byType.set(s.requirementTypeId, list);
  };

  for (const source of sources) {
    switch (source.subjectType) {
      case "WORKSTATION":
        if (workstationIds.has(source.subjectId)) add(source);
        break;
      case "ORG_UNIT":
        if (coveredOrgUnits.has(source.subjectId)) add(source);
        break;
      case "PROCESS": {
        const wsOfProcess = maps.processWorkstations.get(source.subjectId);
        if (
          wsOfProcess &&
          [...workstationIds].some((w) => wsOfProcess.has(w))
        ) {
          add(source);
        }
        break;
      }
      // SUBSTANCE: reserved until P8 — never matched.
      default:
        break;
    }
  }

  return [...byType.entries()].map(([requirementTypeId, srcs]) => ({
    requirementTypeId,
    sources: srcs,
  }));
}
