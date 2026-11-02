import "server-only";

import { createHash } from "node:crypto";
import type { DocumentCategory } from "@/generated/prisma/enums";
import type { DocumentModel } from "@/generated/prisma/models";
import { prisma } from "@/lib/prisma";
import { uploadDocumentVersion } from "@/lib/storage/document";
import { scanUpload } from "@/lib/storage/malware-scan";

// The single gate for adding a document to the library (§7.2). Order matters:
// SCAN before a byte reaches storage (malware-scan.ts — allowlist + EICAR +
// optional engine), then upload, then record. A rejected scan throws a
// DocumentScanError the caller turns into a localized message; nothing is
// stored or rowed. MVP: each upload creates a new Document at version 1 —
// adding a v2 to an existing document reuses the same (schema-ready) shape and
// is a later enhancement.
export class DocumentScanError extends Error {
  constructor(public reason: string) {
    super(`Upload rejected: ${reason}`);
    this.name = "DocumentScanError";
  }
}

export async function uploadNewDocument(input: {
  companyId: string;
  siteId: string;
  category: DocumentCategory;
  title: string;
  reviewDueDate: Date | null;
  fileName: string;
  declaredMime: string;
  buffer: Buffer;
  userId: string | null;
  notes?: string | null;
}): Promise<DocumentModel> {
  const scan = await scanUpload(input.buffer, input.declaredMime);
  if (!scan.ok) throw new DocumentScanError(scan.reason);

  const sha256 = createHash("sha256").update(input.buffer).digest("hex");

  // Create the Document row first so its id scopes the storage path, then
  // upload, then the version row. If the upload throws, the empty Document is
  // left behind — acceptable (a title with no version), far better than a
  // version row pointing at a non-existent object.
  const document = await prisma.document.create({
    data: {
      companyId: input.companyId,
      siteId: input.siteId,
      category: input.category,
      title: input.title,
      reviewDueDate: input.reviewDueDate,
      createdByUserId: input.userId,
    },
  });

  const storagePath = await uploadDocumentVersion(input.buffer, {
    companyId: input.companyId,
    siteId: input.siteId,
    documentId: document.id,
    version: 1,
    fileName: input.fileName,
    contentType: scan.detectedMime,
  });

  await prisma.documentVersion.create({
    data: {
      documentId: document.id,
      version: 1,
      fileName: input.fileName,
      mimeType: scan.detectedMime,
      fileSize: input.buffer.byteLength,
      sha256,
      storagePath,
      uploadedByUserId: input.userId,
      notes: input.notes ?? null,
    },
  });

  return document;
}
