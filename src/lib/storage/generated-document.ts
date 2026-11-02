import "server-only";

import { createAdminClient } from "@/lib/supabase/server";

// Backs GeneratedDocument.storagePath (prisma/schema.prisma). PRIVATE bucket
// "generated-documents" (created manually in the Supabase dashboard, same as
// "floor-plans") — never made public; every read goes through a short-lived
// signed URL, the raw path is never exposed to the browser.
const GENERATED_DOCUMENT_BUCKET = "generated-documents";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

// Content-addressed path: companyId/siteId/type/<sha256>.pdf. Because the path
// is derived from the content hash, re-archiving identical bytes targets the
// same object (upsert is a harmless no-op), which is exactly the dedup the
// GeneratedDocument unique index enforces at the row level.
export async function uploadGeneratedDocument(
  buffer: Buffer,
  params: { companyId: string; siteId: string; type: string; sha256: string },
): Promise<string> {
  const storagePath = `${params.companyId}/${params.siteId}/${params.type}/${params.sha256}.pdf`;
  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(GENERATED_DOCUMENT_BUCKET)
    .upload(storagePath, buffer, {
      contentType: "application/pdf",
      upsert: true,
    });
  if (error) {
    throw new Error(`Failed to archive generated document: ${error.message}`);
  }
  return storagePath;
}

export async function getGeneratedDocumentSignedUrl(
  storagePath: string,
): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(GENERATED_DOCUMENT_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (error || !data) {
    throw new Error(
      `Failed to create signed URL for generated document: ${error?.message ?? "no data returned"}`,
    );
  }
  return data.signedUrl;
}
