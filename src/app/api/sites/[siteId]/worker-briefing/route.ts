import { renderToBuffer } from "@react-pdf/renderer";
import { notFound } from "next/navigation";
import { createElement } from "react";
import { requireSiteAccess } from "@/lib/auth/require-access";
import { getWorkerBriefingData } from "@/lib/report/get-worker-briefing-data";
import { resolveReportLang } from "@/lib/report/report-lang";
import { WorkerBriefingDocument } from "@/lib/report/WorkerBriefingDocument";

// ERGO_COMPLIANCE_BY_DESIGN.md §3.5: "Auto-generated worker-representative
// briefing artifact, produced per deployment ... Treat this as a product
// feature, not paperwork bolted on later." Same auth pattern as the other
// two reports: requireSiteAccess is the exact wrapper the read-only
// dashboard already uses for this site, no new authorization logic.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const { siteId } = await params;
  const data = await getWorkerBriefingData(siteId);
  if (!data) notFound();
  await requireSiteAccess(siteId);

  // Country-driven (B8c, SLD_NEXT_STEPS_B8b-B8f.md §6) — same
  // resolveReportLang the other two non-SGD reports use.
  const lang = resolveReportLang(
    data.site.country,
    new URL(request.url).searchParams.get("lang"),
  );

  const buffer = await renderToBuffer(
    createElement(WorkerBriefingDocument, { data, lang }) as Parameters<
      typeof renderToBuffer
    >[0],
  );

  const safeSiteName = data.site.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const filename = `statura-worker-briefing-${safeSiteName || "site"}.pdf`;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
