import "server-only";

import { createHash } from "node:crypto";
import type {
  CountryCode,
  GeneratedDocumentType,
} from "@/generated/prisma/enums";
import type { GeneratedDocumentModel } from "@/generated/prisma/models";
import { prisma } from "@/lib/prisma";
import { uploadGeneratedDocument } from "@/lib/storage/generated-document";

// The one archive helper (SLD_RESTRUCTURE_PLAN_platform-modules.md §2.2 rule
// 4): every PDF route calls this after rendering. Deduplicates by content —
// identical bytes for the same (site, type) reuse the existing row (and its
// storage object), so re-downloading a report doesn't balloon the archive;
// genuinely different output is a new row, never an overwrite of the old.
//
// Callers wrap this in try/catch: a storage/DB hiccup must never block the
// user's download. A missing archive row is an operational gap to monitor,
// not a reason to deny the document.
export async function archiveGeneratedDocument(params: {
  type: GeneratedDocumentType;
  companyId: string;
  siteId: string;
  title: string;
  country: CountryCode;
  generatedByUserId: string | null;
  versions?: Record<string, unknown> | null;
  buffer: Buffer;
}): Promise<GeneratedDocumentModel> {
  const sha256 = createHash("sha256").update(params.buffer).digest("hex");

  const existing = await prisma.generatedDocument.findUnique({
    where: {
      siteId_type_sha256: {
        siteId: params.siteId,
        type: params.type,
        sha256,
      },
    },
  });
  if (existing) return existing;

  const storagePath = await uploadGeneratedDocument(params.buffer, {
    companyId: params.companyId,
    siteId: params.siteId,
    type: params.type,
    sha256,
  });

  return prisma.generatedDocument.create({
    data: {
      type: params.type,
      companyId: params.companyId,
      siteId: params.siteId,
      title: params.title,
      country: params.country,
      generatedByUserId: params.generatedByUserId,
      versions:
        params.versions === undefined || params.versions === null
          ? undefined
          : (params.versions as never),
      sha256,
      storagePath,
      fileSize: params.buffer.byteLength,
    },
  });
}
