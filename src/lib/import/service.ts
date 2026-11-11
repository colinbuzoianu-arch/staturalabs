import "server-only";

import { setSiteWorkforcePeriod } from "@/lib/analytics/workforce-period";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { createIncident } from "@/lib/incidents/incident";
import { prisma } from "@/lib/prisma";
import {
  autoDetectMapping,
  buildPlan,
  type ImportPlan,
  parseCsv,
} from "./framework";
import { incidentImporter } from "./importers/incident";
import { workforcePeriodImporter } from "./importers/workforce-period";
import { getImportEntityMeta, type ImportEntityKey } from "./registry";

// P14 G3: the server side of the import pipeline — build the per-entity context,
// run a dry-run plan (same pure code the client preview uses), and commit the
// create/update rows (re-parsing + re-validating on the server, never trusting a
// client-sent plan). Every commit is audited. The one historical-migration path
// AND the ongoing-upload path both run through here (plan §G3).

async function orgUnitIdByName(siteId: string): Promise<Map<string, string>> {
  const units = await prisma.orgUnit.findMany({
    where: { siteId },
    select: { id: true, name: true },
  });
  return new Map(units.map((u) => [u.name.trim().toLowerCase(), u.id]));
}

async function workstationIdByName(
  siteId: string,
): Promise<Map<string, string>> {
  const ws = await prisma.workstation.findMany({
    where: { siteId },
    select: { id: true, name: true },
  });
  return new Map(ws.map((w) => [w.name.trim().toLowerCase(), w.id]));
}

type AnyPlan = ImportPlan<unknown>;

async function planFor(
  entity: ImportEntityKey,
  siteId: string,
  csvText: string,
): Promise<AnyPlan> {
  const rows = parseCsv(csvText);
  if (rows.length === 0) {
    return { rows: [], summary: { create: 0, update: 0, skip: 0, error: 0 } };
  }
  const [header, ...dataRows] = rows;

  if (entity === "workforce-period") {
    const mapping = autoDetectMapping(header, workforcePeriodImporter.fields);
    const ctx = { orgUnitIdByName: await orgUnitIdByName(siteId) };
    return buildPlan(dataRows, mapping, workforcePeriodImporter, ctx);
  }
  // incident
  const mapping = autoDetectMapping(header, incidentImporter.fields);
  const ctx = {
    workstationIdByName: await workstationIdByName(siteId),
    orgUnitIdByName: await orgUnitIdByName(siteId),
  };
  return buildPlan(dataRows, mapping, incidentImporter, ctx);
}

export async function runImportDryRun(input: {
  entity: ImportEntityKey;
  siteId: string;
  csvText: string;
}): Promise<AnyPlan> {
  return planFor(input.entity, input.siteId, input.csvText);
}

export type CommitResult = {
  committed: number;
  errors: number;
  skipped: number;
};

export async function commitImport(input: {
  entity: ImportEntityKey;
  siteId: string;
  companyId: string;
  csvText: string;
  actorUserId: string | null;
}): Promise<CommitResult> {
  const meta = getImportEntityMeta(input.entity);
  if (!meta) throw new Error(`Unknown import entity: ${input.entity}`);

  const plan = await planFor(input.entity, input.siteId, input.csvText);
  let committed = 0;

  for (const row of plan.rows) {
    if (row.status !== "create" && row.status !== "update") continue;
    if (input.entity === "workforce-period") {
      const v = row.value as {
        orgUnitId: string | null;
        periodType: "MONTH" | "QUARTER" | "YEAR";
        year: number;
        periodIndex: number;
        headcount: number | null;
        hoursWorked: number | null;
      };
      await setSiteWorkforcePeriod({
        siteId: input.siteId,
        companyId: input.companyId,
        orgUnitId: v.orgUnitId,
        periodType: v.periodType,
        year: v.year,
        periodIndex: v.periodIndex,
        headcount: v.headcount,
        hoursWorked: v.hoursWorked,
        actorUserId: input.actorUserId,
      });
    } else {
      const v = row.value as {
        type: Parameters<typeof createIncident>[0]["type"];
        title: string;
        description: string;
        occurredAt: Date;
        subjectWorkstationId: string | null;
        subjectOrgUnitId: string | null;
      };
      await createIncident({
        companyId: input.companyId,
        siteId: input.siteId,
        type: v.type,
        title: v.title,
        description: v.description,
        occurredAt: v.occurredAt,
        actorUserId: input.actorUserId,
        subjectWorkstationId: v.subjectWorkstationId,
        subjectOrgUnitId: v.subjectOrgUnitId,
      });
    }
    committed++;
  }

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "import.commit",
    entityType: "Import",
    companyId: input.companyId,
    siteId: input.siteId,
    diff: {
      entity: input.entity,
      committed,
      errors: plan.summary.error,
      skipped: plan.summary.skip,
    },
  });

  return {
    committed,
    errors: plan.summary.error,
    skipped: plan.summary.skip,
  };
}
