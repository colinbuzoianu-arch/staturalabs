import { renderToBuffer } from "@react-pdf/renderer";
import { notFound, redirect } from "next/navigation";
import { createElement } from "react";
import { getCurrentPlatformUser } from "@/lib/auth/current-user";
import { canDownloadOperatingInstructionAsPerson } from "@/lib/people/self-service";
import { prisma } from "@/lib/prisma";
import { BetriebsanweisungDocument } from "@/lib/report/BetriebsanweisungDocument";
import { getBetriebsanweisungData } from "@/lib/report/get-betriebsanweisung-data";

// P17 §5: the employee's Betriebsanweisung download. A SELF-scoped employee has
// no site access, so the admin BA route (requireSiteAccess) 404s for them. This
// is the separate, assignment-scoped door: it serves the SAME document, but
// only when the signed-in user's linked Person is assigned to a workstation
// where this operating instruction's substance is actively used. The admin
// route's gate is never widened.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getCurrentPlatformUser();
  if (!user) redirect("/login");

  if (!(await canDownloadOperatingInstructionAsPerson(user, id))) {
    notFound();
  }

  const oi = await prisma.operatingInstruction.findUnique({
    where: { id },
    select: { site: { select: { country: true } } },
  });
  if (!oi) notFound();
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
