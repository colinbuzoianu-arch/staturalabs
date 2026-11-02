import { notFound, redirect } from "next/navigation";
import { requireSiteAccess } from "@/lib/auth/require-access";
import { prisma } from "@/lib/prisma";
import { getGeneratedDocumentSignedUrl } from "@/lib/storage/generated-document";

// Gated download for an archived generated document. Resource-first: fetch
// the row, gate on its own siteId via requireSiteAccess (the same wrapper the
// dashboard uses — 404 for an inaccessible-but-real doc, /login when
// unauthenticated), then redirect to a short-lived signed URL. The raw
// storage path is never exposed; the bucket stays private.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const doc = await prisma.generatedDocument.findUnique({ where: { id } });
  if (!doc) notFound();
  await requireSiteAccess(doc.siteId);

  const signedUrl = await getGeneratedDocumentSignedUrl(doc.storagePath);
  redirect(signedUrl);
}
