import { renderToBuffer } from "@react-pdf/renderer";
import { notFound } from "next/navigation";
import { createElement } from "react";
import { requireSiteAccess } from "@/lib/auth/require-access";
import { getSgdReportData } from "@/lib/report/get-sgd-report-data";
import { SgdDocument } from "@/lib/report/SgdDocument";
import { resolveSgdCountryPack } from "@/lib/report/sgd-availability";

// Site-wide SGD — the scope DOK-VO expects to be shown to an inspector
// (SLD_IMPLEMENTATION_PLAN_austria-first.md §7 B5). Same auth pattern as
// the other three report generators: requireSiteAccess is the exact
// wrapper the read-only dashboard already uses for this site.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const { siteId } = await params;
  const { site } = await requireSiteAccess(siteId);

  // Fail closed, never a silent guess (ERGO_COMPLIANCE_BY_DESIGN.md §3.15):
  // no unverified or template-less country produces a document that reads
  // as though it were legally reviewed for that market. 400, not 404 — the
  // site itself is real and accessible, only this document type isn't
  // available for its country yet.
  if (!resolveSgdCountryPack(site.country)) {
    return Response.json(
      {
        error: `SGD generation is not yet available for country ${site.country} — no verified country pack with an SGD template.`,
      },
      { status: 400 },
    );
  }

  const data = await getSgdReportData({ siteId });
  if (!data) notFound();

  const buffer = await renderToBuffer(
    createElement(SgdDocument, { data }) as Parameters<
      typeof renderToBuffer
    >[0],
  );

  const safeSiteName = data.site.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const filename = `statura-sgd-${safeSiteName || "site"}.pdf`;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
