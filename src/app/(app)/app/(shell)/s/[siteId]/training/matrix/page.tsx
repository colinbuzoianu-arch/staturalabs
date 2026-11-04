import Link from "next/link";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import { accessibleOrgUnitIds } from "@/lib/auth/scope";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import {
  buildInstructionMatrix,
  DEFAULT_DUE_SOON_DAYS,
  type InstructionCellStatus,
} from "@/lib/people/instruction-status";
import {
  type DerivationMaps,
  deriveRequiredTrainings,
  type RequirementSource,
} from "@/lib/people/requirement-derivation";
import { prisma } from "@/lib/prisma";

const STATUS_DOT: Record<InstructionCellStatus, string> = {
  valid: "bg-status-low",
  "due-soon": "bg-status-moderate",
  overdue: "bg-status-high",
  missing: "bg-status-neutral",
};

// P7d §A.3 instruction matrix: REQUIRED cells only (via requirement
// derivation), four-state status, manager org-unit scope. Operational
// per-person duty view (not a statistic → no §3.4 group-size gate).
export default async function InstructionMatrixPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const { user, site } = await requireSiteAdministrationAccess(siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).trainingPage;
  const companyId = site.companyId;

  // Manager scope: null = all org units (company-wide); else the set the user
  // may see (descendant-expanded).
  const scopeOrgUnits = await accessibleOrgUnitIds(user);

  const [persons, types, records, sources, assignments, orgUnits] =
    await Promise.all([
      prisma.person.findMany({
        where: { companyId, active: true, anonymisedAt: null },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
      prisma.trainingRequirementType.findMany({
        where: { OR: [{ companyId }, { companyId: null }] },
        orderBy: { title: "asc" },
      }),
      prisma.trainingRecord.findMany({
        where: { person: { companyId } },
        select: { personId: true, requirementTypeId: true, validUntil: true },
      }),
      prisma.trainingRequirementSource.findMany({
        where: {
          requirementType: { OR: [{ companyId }, { companyId: null }] },
        },
        select: { requirementTypeId: true, subjectType: true, subjectId: true },
      }),
      prisma.personAssignment.findMany({
        where: { person: { companyId } },
        select: {
          personId: true,
          workstationId: true,
          orgUnitId: true,
          validFrom: true,
          validUntil: true,
        },
      }),
      prisma.orgUnit.findMany({
        where: { site: { companyId } },
        select: { id: true, name: true, parentId: true },
      }),
    ]);

  // Derivation maps.
  const workstations = await prisma.workstation.findMany({
    where: { site: { companyId } },
    select: { id: true, orgUnitId: true },
  });
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
  // process → workstations (company processes only).
  const companyProcessTasks = await prisma.processTask.findMany({
    where: { process: { site: { companyId } } },
    select: { processId: true, task: { select: { workstationId: true } } },
  });
  const processWorkstations = new Map<string, Set<string>>();
  for (const pt of companyProcessTasks) {
    const set = processWorkstations.get(pt.processId) ?? new Set<string>();
    if (pt.task.workstationId) set.add(pt.task.workstationId);
    processWorkstations.set(pt.processId, set);
  }
  const maps: DerivationMaps = {
    workstationOrgUnit,
    orgUnitAncestors,
    processWorkstations,
  };
  const sourceList: RequirementSource[] = sources.map((s) => ({
    requirementTypeId: s.requirementTypeId,
    subjectType: s.subjectType,
    subjectId: s.subjectId,
  }));

  const now = new Date();
  const assignmentsByPerson = new Map<
    string,
    { workstationId: string | null; orgUnitId: string | null }[]
  >();
  for (const a of assignments) {
    if (a.validFrom && a.validFrom > now) continue;
    if (a.validUntil && a.validUntil < now) continue;
    const list = assignmentsByPerson.get(a.personId) ?? [];
    list.push({ workstationId: a.workstationId, orgUnitId: a.orgUnitId });
    assignmentsByPerson.set(a.personId, list);
  }

  // Manager scope filter: a person is visible if any of their assignment org
  // units (or assignment workstation's org unit) is in scope.
  function personInScope(personId: string): boolean {
    if (scopeOrgUnits === null) return true;
    for (const a of assignmentsByPerson.get(personId) ?? []) {
      const ou =
        a.orgUnitId ??
        (a.workstationId ? workstationOrgUnit.get(a.workstationId) : null);
      if (ou && scopeOrgUnits.has(ou)) return true;
    }
    return false;
  }
  const visiblePersons = persons.filter((p) => personInScope(p.id));

  // Required (person, type) keys + the "why" per key.
  const requiredKeys = new Set<string>();
  const whyByKey = new Map<string, RequirementSource[]>();
  for (const person of visiblePersons) {
    const derived = deriveRequiredTrainings(
      assignmentsByPerson.get(person.id) ?? [],
      sourceList,
      maps,
    );
    for (const d of derived) {
      const key = `${person.id}:${d.requirementTypeId}`;
      requiredKeys.add(key);
      whyByKey.set(key, d.sources);
    }
  }

  const { cells } = buildInstructionMatrix(
    visiblePersons,
    types,
    records,
    requiredKeys,
    now,
    DEFAULT_DUE_SOON_DAYS,
  );
  const cellByKey = new Map(
    cells.map((c) => [`${c.personId}:${c.requirementTypeId}`, c]),
  );
  const personName = new Map(
    visiblePersons.map((p) => [p.id, `${p.lastName}, ${p.firstName}`]),
  );
  const typeTitle = new Map(types.map((t) => [t.id, t.title]));
  const due = cells.filter((c) => c.required && c.status !== "valid");

  const statusLabel = (s: InstructionCellStatus) =>
    s === "valid"
      ? dict.statusValid
      : s === "due-soon"
        ? dict.statusDueSoon
        : s === "overdue"
          ? dict.statusOverdue
          : dict.statusMissing;

  const hasData = visiblePersons.length > 0 && types.length > 0;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
      <div>
        <p className="font-technical text-xs uppercase tracking-[0.2em] text-foreground-subtle">
          {dict.eyebrow}
        </p>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-foreground">
          {dict.matrixHeading}
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">{dict.matrixIntro}</p>
      </div>

      <nav className="flex gap-2 border-b border-border pb-3 text-sm">
        <Link
          href={`/app/s/${siteId}/training`}
          className="rounded-[var(--radius-md)] px-3 py-1 text-foreground-muted hover:bg-surface-raised"
        >
          {dict.recordTab}
        </Link>
        <span className="rounded-[var(--radius-md)] bg-surface-raised px-3 py-1 font-medium text-foreground">
          {dict.matrixTab}
        </span>
      </nav>

      {!hasData ? (
        <p className="text-sm text-foreground-muted">{dict.matrixEmpty}</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-4 text-xs text-foreground-muted">
            {(
              [
                "valid",
                "due-soon",
                "overdue",
                "missing",
              ] as InstructionCellStatus[]
            ).map((s) => (
              <span key={s} className="flex items-center gap-1.5">
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${STATUS_DOT[s]}`}
                />
                {statusLabel(s)}
              </span>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="text-left text-sm">
              <thead>
                <tr className="border-b border-border text-foreground-muted">
                  <th className="py-1 pr-4">{dict.colPerson}</th>
                  {types.map((t) => (
                    <th
                      key={t.id}
                      className="px-2 py-1 text-center font-normal"
                    >
                      {t.title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visiblePersons.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="py-1.5 pr-4 font-medium text-foreground">
                      {personName.get(p.id)}
                    </td>
                    {types.map((t) => {
                      const cell = cellByKey.get(`${p.id}:${t.id}`);
                      if (!cell?.required) {
                        return (
                          <td
                            key={t.id}
                            className="px-2 py-1.5 text-center text-foreground-subtle"
                          >
                            {dict.notRequired}
                          </td>
                        );
                      }
                      const status = cell.status ?? "missing";
                      return (
                        <td key={t.id} className="px-2 py-1.5 text-center">
                          <span
                            title={statusLabel(status)}
                            className={`inline-block h-3 w-3 rounded-full ${STATUS_DOT[status]}`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <section className="flex flex-col gap-2">
            <h2 className="font-heading text-sm font-bold">
              {dict.dueHeading}
            </h2>
            {due.length === 0 ? (
              <p className="text-sm text-foreground-muted">{dict.dueEmpty}</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {due.map((c) => (
                  <li key={`${c.personId}:${c.requirementTypeId}`}>
                    <span className="font-medium text-foreground">
                      {personName.get(c.personId)}
                    </span>{" "}
                    <span className="text-foreground-muted">
                      · {typeTitle.get(c.requirementTypeId)} ·{" "}
                    </span>
                    <span
                      className={
                        c.status === "overdue"
                          ? "text-status-high"
                          : "text-foreground-muted"
                      }
                    >
                      {statusLabel(c.status ?? "missing")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
