import { notFound } from "next/navigation";
import { hasPermission } from "@/lib/auth/permissions";
import { requireSiteAccess } from "@/lib/auth/require-access";
import { buildTemplateCsv } from "@/lib/import/framework";
import { incidentImporter } from "@/lib/import/importers/incident";
import { workforcePeriodImporter } from "@/lib/import/importers/workforce-period";
import { getImportEntityMeta } from "@/lib/import/registry";

// P14 G3: downloadable per-entity CSV template (the plan's "standard upload
// template") — canonical headers + one example row, so an auto-detected import
// just works. Same requireSiteAccess gate as the import page; also checks the
// entity's own permission.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ siteId: string; entity: string }> },
) {
  const { siteId, entity } = await params;
  const { user } = await requireSiteAccess(siteId);
  const meta = getImportEntityMeta(entity);
  if (!meta) notFound();
  if (!hasPermission(user, meta.permission)) notFound();

  const def =
    entity === "workforce-period" ? workforcePeriodImporter : incidentImporter;
  const csv = buildTemplateCsv(def);

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="statura-import-${entity}-template.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
