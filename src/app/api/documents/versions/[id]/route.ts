import { notFound, redirect } from "next/navigation";
import { requireSiteAccess } from "@/lib/auth/require-access";
import { prisma } from "@/lib/prisma";
import { getDocumentSignedUrl } from "@/lib/storage/document";

// Gated download of a document version: resolve the version, gate on its
// document's siteId (requireSiteAccess — 404 for inaccessible, /login for
// anonymous), then redirect to a short-lived signed URL. The bucket stays
// private; the raw storage path is never exposed.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const version = await prisma.documentVersion.findUnique({
    where: { id },
    include: { document: { select: { siteId: true } } },
  });
  if (!version) notFound();
  await requireSiteAccess(version.document.siteId);

  const signedUrl = await getDocumentSignedUrl(version.storagePath);
  redirect(signedUrl);
}
