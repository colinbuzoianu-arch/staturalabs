import "server-only";

import { createAdminClient } from "@/lib/supabase/server";

// Backs DocumentVersion.storagePath. PRIVATE bucket "documents" (created in the
// Supabase dashboard, like floor-plans/generated-documents) — read only via
// short-lived signed URLs, never public. Uploads reach here only after passing
// src/lib/storage/malware-scan.ts.
const DOCUMENTS_BUCKET = "documents";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export async function uploadDocumentVersion(
  buffer: Buffer,
  params: {
    companyId: string;
    siteId: string;
    documentId: string;
    version: number;
    fileName: string;
    contentType: string;
  },
): Promise<string> {
  const ext = params.fileName.split(".").pop()?.toLowerCase() ?? "bin";
  const storagePath = `${params.companyId}/${params.siteId}/${params.documentId}/v${params.version}.${ext}`;
  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(storagePath, buffer, {
      contentType: params.contentType,
      upsert: false,
    });
  if (error) {
    throw new Error(`Failed to upload document: ${error.message}`);
  }
  return storagePath;
}

export async function getDocumentSignedUrl(
  storagePath: string,
): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (error || !data) {
    throw new Error(
      `Failed to create signed URL for document: ${error?.message ?? "no data returned"}`,
    );
  }
  return data.signedUrl;
}
