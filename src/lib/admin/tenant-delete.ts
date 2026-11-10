import "server-only";

import { recordAuditEvent } from "@/lib/audit/audit-event";
import { prisma } from "@/lib/prisma";

// P13 §5 documented deletion at contract end. Deliberate, logged, super-admin-
// only HARD delete of a company, separate from archiving. Safety design:
//
//   - the company must already be ARCHIVED (you archive, then delete);
//   - it runs as the OWNER with EXPLICIT per-table company scoping, NOT via the
//     RLS role. RLS `USING` is a read-visibility rule: a company-scoped table's
//     policy is `companyId IS NULL OR companyId = ANY(...)`, so a bulk DELETE as
//     statura_app would also match the shared SYSTEM rows (companyId IS NULL —
//     the global Hazard / EnvironmentalAspect / LegalRequirement catalogues) and
//     wipe them for every tenant. Owner-side strict `"companyId" = $1` can never
//     touch a NULL system row;
//   - every table's scope predicate is derived at runtime from its own columns
//     and FKs (companyId → company; siteId → the company's sites; otherwise a FK
//     into an already-scoped parent, resolved by fixpoint), so it adapts as the
//     schema grows — no hand-maintained list to drift;
//   - deletion runs child-first in a runtime topological order of the FK graph
//     (honouring the Restrict discipline); the self-referencing OrgUnit tree is
//     drained leaf-first;
//   - shared reference/catalogue tables, the append-only AuditEvent trail, and
//     any table that cannot be resolved to a company scope are never touched;
//   - the tenant.delete AuditEvent is written with companyId = null so it
//     survives the deletion.
// The caller enforces a double confirm in the UI.

// Never deleted: shared reference/catalogue tables (tenant data lives elsewhere)
// and the audit trail (must outlive the tenant).
const NEVER_DELETE = new Set([
  "ExposureLimit",
  "ExposureLimitCatalogVersion",
  "HoldTimeRule",
  "IncidentNotificationCatalogVersion",
  "IncidentNotificationRule",
  "KpiCatalogVersion",
  "KpiDefinition",
  "LegalReference",
  "LegalReferenceCatalogVersion",
  "LegalRequirementCatalogVersion",
  "ManualHandlingRule",
  "MethodologyVersion",
  "PostureZoneRule",
  "RepetitionRule",
  "RetentionRule",
  "RetentionRuleCatalogVersion",
  "RiskMatrixCell",
  "RiskMatrixVersion",
  "ScoringRule",
  "TypicalMeasure",
  "TypicalMeasureCatalogVersion",
  "DefaultEntitlementModule",
  "FeatureFlag",
  // The audit trail outlives the tenant (it records that the deletion happened).
  "AuditEvent",
]);

type ColumnInfo = Map<string, Set<string>>; // table -> column names

async function loadColumns(): Promise<ColumnInfo> {
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public'`,
  )) as { table_name: string; column_name: string }[];
  const map: ColumnInfo = new Map();
  for (const r of rows) {
    if (!map.has(r.table_name)) map.set(r.table_name, new Set());
    map.get(r.table_name)?.add(r.column_name);
  }
  return map;
}

async function loadForeignKeys(): Promise<
  { child: string; parent: string; col: string }[]
> {
  return (await prisma.$queryRawUnsafe(
    `SELECT tc.table_name AS child, ccu.table_name AS parent, kcu.column_name AS col
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name=kcu.constraint_name AND tc.table_schema=kcu.table_schema
     JOIN information_schema.constraint_column_usage ccu
       ON tc.constraint_name=ccu.constraint_name AND tc.table_schema=ccu.table_schema
     WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public' AND ccu.column_name='id'`,
  )) as { child: string; parent: string; col: string }[];
}

// Build, per table, a WHERE predicate (using $1 = companyId) that selects exactly
// that table's rows belonging to the company — and nothing shared/system.
function buildScopePredicates(
  tables: string[],
  columns: ColumnInfo,
  fks: { child: string; parent: string; col: string }[],
): Map<string, string> {
  const pred = new Map<string, string>();
  // Roots.
  for (const t of tables) {
    const cols = columns.get(t) ?? new Set();
    if (t === "Company") pred.set(t, `"id" = $1`);
    else if (cols.has("companyId")) pred.set(t, `"companyId" = $1`);
    else if (cols.has("siteId"))
      pred.set(
        t,
        `"siteId" IN (SELECT "id" FROM "Site" WHERE "companyId" = $1)`,
      );
  }
  // Fixpoint for children: a FK into an already-resolved, company-owned parent.
  let changed = true;
  while (changed) {
    changed = false;
    for (const t of tables) {
      if (pred.has(t) || NEVER_DELETE.has(t)) continue;
      const fk = fks.find(
        (f) => f.child === t && f.parent !== t && pred.has(f.parent),
      );
      if (fk) {
        pred.set(
          t,
          `"${fk.col}" IN (SELECT "id" FROM "${fk.parent}" WHERE ${pred.get(fk.parent)})`,
        );
        changed = true;
      }
    }
  }
  return pred;
}

// Child-first delete order: FK edge child->parent ("delete child before parent").
// Kahn's algorithm; self-edges (OrgUnit.parentId) ignored and that table drained
// with a leaf loop.
function topoOrder(
  tables: string[],
  fks: { child: string; parent: string }[],
): string[] {
  const set = new Set(tables);
  const incoming = new Map<string, number>(tables.map((t) => [t, 0]));
  const children = new Map<string, string[]>(tables.map((t) => [t, []]));
  for (const { child, parent } of fks) {
    if (!set.has(child) || !set.has(parent) || child === parent) continue;
    incoming.set(parent, (incoming.get(parent) ?? 0) + 1);
    children.get(child)?.push(parent);
  }
  const queue = tables.filter((t) => (incoming.get(t) ?? 0) === 0);
  const order: string[] = [];
  while (queue.length > 0) {
    const t = queue.shift() as string;
    order.push(t);
    for (const parent of children.get(t) ?? []) {
      const n = (incoming.get(parent) ?? 0) - 1;
      incoming.set(parent, n);
      if (n === 0) queue.push(parent);
    }
  }
  for (const t of tables) if (!order.includes(t)) order.push(t);
  return order;
}

export async function deleteTenant(input: {
  companyId: string;
  actorUserId: string;
}): Promise<{ deletedTables: number; skippedTables: string[] }> {
  const company = await prisma.company.findUnique({
    where: { id: input.companyId },
    select: { status: true, name: true },
  });
  if (!company) throw new Error("Company not found");
  if (company.status !== "ARCHIVED") {
    throw new Error("Archive the tenant before deleting it");
  }

  // Audit first, with companyId = null so the record survives the deletion.
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "tenant.delete",
    entityType: "Company",
    entityId: input.companyId,
    companyId: null,
    diff: { name: company.name },
  });

  const allTables = (
    (await prisma.$queryRawUnsafe(
      `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT LIKE E'\\_prisma%'`,
    )) as { tablename: string }[]
  ).map((r) => r.tablename);
  const tables = allTables.filter((t) => !NEVER_DELETE.has(t));
  const columns = await loadColumns();
  const fks = await loadForeignKeys();

  const predicates = buildScopePredicates(tables, columns, fks);
  const order = topoOrder(tables, fks).filter((t) => predicates.has(t));
  const skippedTables = tables.filter((t) => !predicates.has(t));

  await prisma.$transaction(
    async (tx) => {
      for (const table of order) {
        const where = predicates.get(table) as string;
        if (table === "OrgUnit") {
          // Self-referencing tree: drain leaves until empty (Restrict self-FK),
          // each pass scoped to the company.
          let deleted = 1;
          while (deleted > 0) {
            deleted = await tx.$executeRawUnsafe(
              `DELETE FROM "OrgUnit" WHERE ${where} AND "id" NOT IN (SELECT "parentId" FROM "OrgUnit" WHERE "parentId" IS NOT NULL AND ${where})`,
              input.companyId,
            );
          }
        } else {
          await tx.$executeRawUnsafe(
            `DELETE FROM "${table}" WHERE ${where}`,
            input.companyId,
          );
        }
      }
    },
    { timeout: 120_000, maxWait: 15_000 },
  );
  return { deletedTables: order.length, skippedTables };
}
