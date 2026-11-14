import { renderToBuffer } from "@react-pdf/renderer";
import { notFound } from "next/navigation";
import { createElement } from "react";
import { requireSiteAccess } from "@/lib/auth/require-access";
import { isEnginePreviewable } from "@/lib/chemicals/engines/engine-flags";
import { mapToSdsDraft } from "@/lib/chemicals/engines/sds-authoring";
import {
  buildConfirmedPayload,
  type ConfirmedSdsData,
  emptySdsExtraction,
} from "@/lib/chemicals/sds-extraction-schema";
import { prisma } from "@/lib/prisma";
import { archiveGeneratedDocument } from "@/lib/report/archive-generated-document";
import { SdsDraftDocument } from "@/lib/report/SdsDraftDocument";

// P16 §4 slice 5: the watermarked 16-section SDS draft preview (sds.authoring).
// Gated on the engine being PREVIEW+ for the tenant; archived as SDS_DRAFT_PREVIEW.
// NEVER an authoritative SDS — watermarked "ENTWURF — NICHT ZUR WEITERGABE".
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ siteId: string; substanceId: string }> },
) {
  const { siteId, substanceId } = await params;
  const { user, site } = await requireSiteAccess(siteId);

  const substance = await prisma.substance.findFirst({
    where: { id: substanceId, companyId: site.companyId },
    include: {
      safetyDataSheets: {
        where: { supersededAt: null },
        orderBy: { revisionDate: "desc" },
        take: 1,
        select: { confirmedData: true },
      },
    },
  });
  if (!substance) notFound();

  if (!(await isEnginePreviewable("sds.authoring", site.companyId))) {
    return new Response(
      JSON.stringify({
        error: "SDS authoring engine is not enabled for this tenant",
      }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }

  const stored =
    (substance.safetyDataSheets[0]
      ?.confirmedData as Partial<ConfirmedSdsData> | null) ?? null;
  const confirmed: ConfirmedSdsData = {
    ...buildConfirmedPayload(emptySdsExtraction()),
    ...(stored ?? {}),
  };
  const draft = mapToSdsDraft(substance.tradeName, confirmed);

  const buffer = await renderToBuffer(
    createElement(SdsDraftDocument, { draft }) as Parameters<
      typeof renderToBuffer
    >[0],
  );

  const safeName = substance.tradeName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  try {
    await archiveGeneratedDocument({
      type: "SDS_DRAFT_PREVIEW",
      companyId: site.companyId,
      siteId: site.id,
      title: substance.tradeName,
      country: site.country,
      generatedByUserId: user.id,
      buffer,
    });
  } catch (error) {
    console.error("Failed to archive SDS_DRAFT_PREVIEW:", error);
  }

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="sdb-entwurf-${safeName || "stoff"}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
