import { renderToBuffer } from "@react-pdf/renderer";
import { notFound } from "next/navigation";
import { createElement } from "react";
import { requireSiteAccess } from "@/lib/auth/require-access";
import { AwkDocument } from "@/lib/report/AwkDocument";
import { resolveAwkCountryPack } from "@/lib/report/awk-availability";
import { getAwkReportData } from "@/lib/report/get-awk-report-data";

// Site-wide Abfallwirtschaftskonzept (AWK), §10 AWG 2002 (E4,
// SLD_IMPLEMENTATION_PLAN_hazards-and-environment.md §6). Same auth + gating
// pattern as the SGD route: requireSiteAccess (the wrapper the read-only
// dashboard already uses for this site), then fail closed on country —
// never a silent cross-jurisdiction guess (§3.15). 400, not 404 — the site
// is real and accessible, only this document type isn't available for its
// country.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const { siteId } = await params;
  const { site } = await requireSiteAccess(siteId);

  if (!resolveAwkCountryPack(site.country)) {
    return Response.json(
      {
        error: `AWK generation is not yet available for country ${site.country} — no verified country pack with an AWK template.`,
      },
      { status: 400 },
    );
  }

  const data = await getAwkReportData({ siteId });
  if (!data) notFound();

  const buffer = await renderToBuffer(
    createElement(AwkDocument, { data }) as Parameters<
      typeof renderToBuffer
    >[0],
  );

  const safeSiteName = data.site.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const filename = `statura-awk-${safeSiteName || "site"}.pdf`;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
