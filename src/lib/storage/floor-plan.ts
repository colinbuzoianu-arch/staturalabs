import "server-only";

import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/server";

// Backs FloorPlan.storagePath (prisma/schema.prisma). This bucket must be
// created manually in the Supabase dashboard as a PRIVATE bucket named
// "floor-plans" — never created programmatically here, and never made
// public: every read goes through getFloorPlanSignedUrl()'s short-lived
// signed URL, the raw storage path is never exposed to the browser.
const FLOOR_PLAN_BUCKET = "floor-plans";

const MAX_FLOOR_PLAN_BYTES = 10 * 1024 * 1024;

const SIGNED_URL_TTL_SECONDS = 60 * 60;

const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

// fileName is only ever used to derive an extension/content-type — the
// actual storage path is siteId + a fresh random id, so an attacker-chosen
// fileName has no path-traversal surface.
function resolveMimeType(fileName: string): {
  extension: string;
  mimeType: string;
} {
  const extension = fileName.split(".").pop()?.toLowerCase();
  const mimeType = extension ? MIME_TYPE_BY_EXTENSION[extension] : undefined;

  if (!extension || !mimeType) {
    throw new Error(
      `Unsupported floor plan file type: "${fileName}". Only PNG, JPEG, and WEBP images are allowed.`,
    );
  }

  return { extension, mimeType };
}

export async function uploadFloorPlan(
  file: Buffer,
  fileName: string,
  siteId: string,
): Promise<string> {
  if (file.byteLength > MAX_FLOOR_PLAN_BYTES) {
    throw new Error(
      `Floor plan file is too large (${file.byteLength} bytes) — the limit is ${MAX_FLOOR_PLAN_BYTES} bytes.`,
    );
  }

  const { extension, mimeType } = resolveMimeType(fileName);
  const storagePath = `${siteId}/${randomUUID()}.${extension}`;

  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(FLOOR_PLAN_BUCKET)
    .upload(storagePath, file, { contentType: mimeType, upsert: false });

  if (error) {
    throw new Error(`Failed to upload floor plan: ${error.message}`);
  }

  return storagePath;
}

export async function getFloorPlanSignedUrl(
  storagePath: string,
): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(FLOOR_PLAN_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  if (error || !data) {
    throw new Error(
      `Failed to create signed URL for floor plan: ${error?.message ?? "no data returned"}`,
    );
  }

  return data.signedUrl;
}

export async function deleteFloorPlanFile(storagePath: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(FLOOR_PLAN_BUCKET)
    .remove([storagePath]);

  if (error) {
    throw new Error(`Failed to delete floor plan file: ${error.message}`);
  }
}
