"use server";

import { notFound } from "next/navigation";
import { hasPermission } from "@/lib/auth/permissions";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import type { ImportRowStatus } from "@/lib/import/framework";
import {
  getImportEntityMeta,
  type ImportEntityKey,
} from "@/lib/import/registry";
import { commitImport, runImportDryRun } from "@/lib/import/service";

// P14 G3 server actions for the shared import UI. Both re-gate access and
// re-validate on the server (never trusting the client), per the pipeline's
// dry-run → commit discipline.

export type PreviewRow = {
  rowNumber: number;
  status: ImportRowStatus;
  reason?: string;
  display: string;
};

export type PreviewResult = {
  summary: { create: number; update: number; skip: number; error: number };
  rows: PreviewRow[];
};

function displayFor(
  entity: ImportEntityKey,
  raw: Record<string, string>,
): string {
  if (entity === "workforce-period") {
    const idx = raw.periodIndex ? ` #${raw.periodIndex}` : "";
    return `${raw.period || "?"} ${raw.year || "?"}${idx} · ${raw.headcount || "–"} MA / ${raw.hoursWorked || "–"} h`;
  }
  if (entity === "vehicle") {
    return `${raw.identifier || "?"} · ${raw.type || ""}`;
  }
  return `${raw.type || "?"}: ${raw.title || ""} (${raw.occurredAt || "?"})`;
}

async function gate(siteId: string, entity: string) {
  const { user, site } = await requireSiteAdministrationAccess(siteId);
  const meta = getImportEntityMeta(entity);
  if (!meta) notFound();
  if (!hasPermission(user, meta.permission)) notFound();
  return { user, site, meta };
}

export async function previewImport(
  siteId: string,
  entity: ImportEntityKey,
  csvText: string,
): Promise<PreviewResult> {
  await gate(siteId, entity);
  const plan = await runImportDryRun({ entity, siteId, csvText });
  return {
    summary: plan.summary,
    rows: plan.rows.map((r) => ({
      rowNumber: r.rowNumber,
      status: r.status,
      reason: r.reason,
      display: displayFor(entity, r.raw),
    })),
  };
}

export async function runImport(
  siteId: string,
  entity: ImportEntityKey,
  csvText: string,
): Promise<{ committed: number; errors: number; skipped: number }> {
  const { user, site } = await gate(siteId, entity);
  return commitImport({
    entity,
    siteId,
    companyId: site.companyId,
    csvText,
    actorUserId: user.id,
  });
}
