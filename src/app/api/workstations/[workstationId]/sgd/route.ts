import { renderToBuffer } from "@react-pdf/renderer";
import { notFound } from "next/navigation";
import { createElement } from "react";
import { requireWorkstationAccess } from "@/lib/auth/require-access";
import { getSgdReportData } from "@/lib/report/get-sgd-report-data";
import { SgdDocument } from "@/lib/report/SgdDocument";
import { resolveSgdCountryPack } from "@/lib/report/sgd-availability";

// Per-workstation SGD — the narrower scope DOK-VO also permits (grouping
// comparable workplaces/activities), for when a customer wants one
// workplace's document rather than the whole site's (SLD_IMPLEMENTATION_
// PLAN_austria-first.md §7 B5). Same auth pattern as every other
// workstation-scoped read: requireWorkstationAccess.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workstationId: string }> },
) {
  const { workstationId } = await params;
  const { workstation } = await requireWorkstationAccess(workstationId);

  if (!resolveSgdCountryPack(workstation.site.country)) {
    return Response.json(
      {
        error: `SGD generation is not yet available for country ${workstation.site.country} — no verified country pack with an SGD template.`,
      },
      { status: 400 },
    );
  }

  const data = await getSgdReportData({
    siteId: workstation.siteId,
    workstationId,
  });
  if (!data) notFound();

  const buffer = await renderToBuffer(
    createElement(SgdDocument, { data }) as Parameters<
      typeof renderToBuffer
    >[0],
  );

  const safeName = (data.workstation?.name ?? "workstation")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const filename = `statura-sgd-${safeName || "workstation"}.pdf`;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
