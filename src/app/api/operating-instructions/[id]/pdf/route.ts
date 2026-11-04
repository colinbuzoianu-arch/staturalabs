import { renderToBuffer } from "@react-pdf/renderer";
import { notFound } from "next/navigation";
import { createElement } from "react";
import { requireSiteAccess } from "@/lib/auth/require-access";
import { prisma } from "@/lib/prisma";
import { BetriebsanweisungDocument } from "@/lib/report/BetriebsanweisungDocument";
import { getBetriebsanweisungData } from "@/lib/report/get-betriebsanweisung-data";

// P8 §3.2 Betriebsanweisung PDF. Country-gated AT/DE (fail-closed 400 like the
// SGD). Preview/download; archiving happens on approval (page action).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const oi = await prisma.operatingInstruction.findUnique({
    where: { id },
    select: { site: { select: { id: true, country: true } } },
  });
  if (!oi) notFound();
  await requireSiteAccess(oi.site.id);

  if (oi.site.country !== "AT" && oi.site.country !== "DE") {
    return Response.json(
      {
        error: `Betriebsanweisung is not available for country ${oi.site.country}.`,
      },
      { status: 400 },
    );
  }

  const data = await getBetriebsanweisungData(id);
  if (!data) notFound();

  const buffer = await renderToBuffer(
    createElement(BetriebsanweisungDocument, { data }) as Parameters<
      typeof renderToBuffer
    >[0],
  );
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="betriebsanweisung-${id}.pdf"`,
    },
  });
}
