import { renderToBuffer } from "@react-pdf/renderer";
import { notFound } from "next/navigation";
import { createElement } from "react";
import { requireSiteAccess } from "@/lib/auth/require-access";
import { getRiskAssessmentReportData } from "@/lib/report/get-risk-assessment-report-data";
import { RiskAssessmentReportDocument } from "@/lib/report/RiskAssessmentReportDocument";

// Resource-first access, same pattern as the risk-assessment/action detail
// pages under (app)/administration: a RiskAssessment id already fully
// identifies the resource, so fetch first, then gate on its own siteId via
// the exact same requireSiteAccess every read-only dashboard page uses —
// no new authorization logic, and a report is a read action available to
// anyone who can read the site, not gated to the write surface.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ riskAssessmentId: string }> },
) {
  const { riskAssessmentId } = await params;
  const data = await getRiskAssessmentReportData(riskAssessmentId);
  if (!data) notFound();
  await requireSiteAccess(data.riskAssessment.siteId);

  const buffer = await renderToBuffer(
    createElement(RiskAssessmentReportDocument, { data }) as Parameters<
      typeof renderToBuffer
    >[0],
  );

  const subjectName =
    data.riskAssessment.workstation?.name ?? data.riskAssessment.process?.name;
  const safeSubjectName = (subjectName ?? "assessment")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const filename = `statura-risk-assessment-${safeSubjectName || "assessment"}-${data.riskAssessment.id}.pdf`;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
