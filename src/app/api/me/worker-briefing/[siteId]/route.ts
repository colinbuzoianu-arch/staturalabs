import { renderToBuffer } from "@react-pdf/renderer";
import { notFound, redirect } from "next/navigation";
import { createElement } from "react";
import { getCurrentPlatformUser } from "@/lib/auth/current-user";
import { canDownloadWorkerBriefingAsPerson } from "@/lib/people/self-service";
import { getWorkerBriefingData } from "@/lib/report/get-worker-briefing-data";
import { resolveReportLang } from "@/lib/report/report-lang";
import { WorkerBriefingDocument } from "@/lib/report/WorkerBriefingDocument";

// P17 §5: the employee's worker-representative briefing download for a site
// they are assigned to. Assignment-scoped door (canDownloadWorkerBriefingAs-
// Person), not requireSiteAccess — a SELF-scoped employee has no site access.
// Read-only: unlike the admin route it does NOT archive a GeneratedDocument
// (that is an admin artifact action).
export async function GET(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const { siteId } = await params;
  const user = await getCurrentPlatformUser();
  if (!user) redirect("/login");

  if (!(await canDownloadWorkerBriefingAsPerson(user, siteId))) {
    notFound();
  }

  const data = await getWorkerBriefingData(siteId);
  if (!data) notFound();

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
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="briefing-${safeSiteName || siteId}.pdf"`,
    },
  });
}
