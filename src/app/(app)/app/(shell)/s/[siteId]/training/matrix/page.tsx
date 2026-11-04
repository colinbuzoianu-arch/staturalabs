import Link from "next/link";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import {
  buildInstructionMatrix,
  type InstructionCellStatus,
} from "@/lib/people/instruction-status";
import { prisma } from "@/lib/prisma";

const STATUS_DOT: Record<InstructionCellStatus, string> = {
  valid: "bg-status-low",
  expired: "bg-status-high",
  missing: "bg-status-neutral",
};

// P7c-2 instruction matrix (plan §7.6): persons × requirement types with
// status, plus a due/missing list. Operational per-person view (not a
// statistic, so no §3.4 minimum-group-size gate). Company-scoped.
export default async function InstructionMatrixPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const { site } = await requireSiteAdministrationAccess(siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).trainingPage;
  const companyId = site.companyId;

  const [persons, types, records] = await Promise.all([
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
  ]);

  const { cells } = buildInstructionMatrix(persons, types, records, new Date());
  const cellByKey = new Map(
    cells.map((c) => [`${c.personId}:${c.requirementTypeId}`, c]),
  );
  const personName = new Map(
    persons.map((p) => [p.id, `${p.lastName}, ${p.firstName}`]),
  );
  const typeTitle = new Map(types.map((t) => [t.id, t.title]));
  const due = cells.filter((c) => c.status !== "valid");

  const statusLabel = (s: InstructionCellStatus) =>
    s === "valid"
      ? dict.statusValid
      : s === "expired"
        ? dict.statusExpired
        : dict.statusMissing;

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

      {persons.length === 0 || types.length === 0 ? (
        <p className="text-sm text-foreground-muted">{dict.matrixEmpty}</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-4 text-xs text-foreground-muted">
            {(["valid", "expired", "missing"] as InstructionCellStatus[]).map(
              (s) => (
                <span key={s} className="flex items-center gap-1.5">
                  <span
                    className={`inline-block h-2.5 w-2.5 rounded-full ${STATUS_DOT[s]}`}
                  />
                  {statusLabel(s)}
                </span>
              ),
            )}
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
                {persons.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="py-1.5 pr-4 font-medium text-foreground">
                      {personName.get(p.id)}
                    </td>
                    {types.map((t) => {
                      const cell = cellByKey.get(`${p.id}:${t.id}`);
                      const status = cell?.status ?? "missing";
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
                        c.status === "expired"
                          ? "text-status-high"
                          : "text-foreground-muted"
                      }
                    >
                      {statusLabel(c.status)}
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
