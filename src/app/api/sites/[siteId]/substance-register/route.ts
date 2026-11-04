import { renderToBuffer } from "@react-pdf/renderer";
import { notFound } from "next/navigation";
import { createElement } from "react";
import { requireSiteAccess } from "@/lib/auth/require-access";
import { archiveGeneratedDocument } from "@/lib/report/archive-generated-document";
import { getSubstanceRegisterData } from "@/lib/report/get-substance-register-data";
import { SubstanceRegisterDocument } from "@/lib/report/SubstanceRegisterDocument";

// P8 §3.3 substance register PDF (DE Gefahrstoffverzeichnis / AT
// Arbeitsstoffliste). Country-gated AT/DE, fail-closed 400 otherwise. Archived
// via GeneratedDocument.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const { siteId } = await params;
  const { user, site } = await requireSiteAccess(siteId);

  if (site.country !== "AT" && site.country !== "DE") {
    return Response.json(
      {
        error: `Substance register is not available for country ${site.country}.`,
      },
      { status: 400 },
    );
  }

  const data = await getSubstanceRegisterData(siteId);
  if (!data) notFound();

  const buffer = await renderToBuffer(
    createElement(SubstanceRegisterDocument, { data }) as Parameters<
      typeof renderToBuffer
    >[0],
  );
  try {
    await archiveGeneratedDocument({
      type: "GEFAHRSTOFFVERZEICHNIS",
      companyId: site.companyId,
      siteId,
      title: data.siteName,
      country: site.country,
      generatedByUserId: user.id,
      buffer,
    });
  } catch {
    // best-effort archive, never blocks the download
  }
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="gefahrstoffverzeichnis-${siteId}.pdf"`,
    },
  });
}
