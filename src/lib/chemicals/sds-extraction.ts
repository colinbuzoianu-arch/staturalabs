import "server-only";

import {
  AiNotEnabledError,
  getAiModel,
  getAnthropicClient,
  isGefahrstoffeAiAvailable,
} from "@/lib/ai/anthropic";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { prisma } from "@/lib/prisma";
import {
  parseSdsExtractionResponse,
  SDS_EXTRACTION_JSON_SHAPE,
  type SdsExtractionResult,
} from "./sds-extraction-schema";

// P15 S2: extract a supplier SDS (PDF) into a pre-filled review draft. The model
// reads ONLY the uploaded document; it must return null for anything not present
// and never fill a value from its own knowledge (§0.7/§7). Every field carries
// page + snippet evidence so the review form can show provenance. Nothing here
// writes confirmed SDS data — it produces a PENDING_REVIEW draft a user then
// accepts field by field (S2b).

const SYSTEM_PROMPT = [
  "You extract data from a supplier Safety Data Sheet (SDS / Sicherheitsdatenblatt) PDF.",
  "You are a precise extractor, not an author. Rules:",
  "1. Report ONLY what is literally written in the document. If a field is not present, set its value to null.",
  "2. NEVER infer, complete, translate-guess, or recall a value from your own knowledge. No value from outside this document.",
  "3. For every field, give the 1-based PDF page number and the exact text snippet you read it from.",
  "4. Return ONLY a single JSON object in the exact shape given, with no prose before or after.",
  "5. Keep the original language of the document for text values (do not translate).",
].join("\n");

export type SdsExtractionRun = {
  result: SdsExtractionResult;
  model: string;
  inputTokens: number;
  outputTokens: number;
};

// Call the model against a base64 PDF. Throws AiNotConfiguredError when no key,
// and SdsExtractionParseError when the response is not JSON. Caller decides
// whether a thrown error becomes a FAILED record.
export async function extractSdsFromPdf(
  pdfBase64: string,
): Promise<SdsExtractionRun> {
  const client = getAnthropicClient();
  const model = getAiModel();
  const response = await client.messages.create({
    model,
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: pdfBase64,
            },
          },
          {
            type: "text",
            text: `Extract this SDS into exactly this JSON shape (comments are guidance, do not echo them):\n\n${SDS_EXTRACTION_JSON_SHAPE}`,
          },
        ],
      },
    ],
  });

  const text = response.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("");

  const result = parseSdsExtractionResponse(text);
  return {
    result,
    model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

// Persist a PENDING_REVIEW extraction draft, audited. Gated on the KI-Funktionen
// entitlement — the caller must have passed availability, but we re-check here
// (fail-closed) because a server action runs in its own context.
export async function createPendingSdsExtraction(input: {
  companyId: string;
  createdByUserId: string;
  run: SdsExtractionRun;
  fileName?: string | null;
  documentId?: string | null;
  substanceId?: string | null;
}): Promise<string> {
  if (!(await isGefahrstoffeAiAvailable(input.companyId))) {
    throw new AiNotEnabledError();
  }
  const row = await prisma.sdsExtraction.create({
    data: {
      companyId: input.companyId,
      substanceId: input.substanceId ?? null,
      documentId: input.documentId ?? null,
      fileName: input.fileName ?? null,
      status: "PENDING_REVIEW",
      aiModel: input.run.model,
      inputTokens: input.run.inputTokens,
      outputTokens: input.run.outputTokens,
      extractedData: input.run.result as unknown as object,
      createdByUserId: input.createdByUserId,
    },
    select: { id: true },
  });
  await recordAuditEvent({
    actorUserId: input.createdByUserId,
    action: "sds_extraction.create",
    entityType: "SdsExtraction",
    entityId: row.id,
    companyId: input.companyId,
    diff: { model: input.run.model, fileName: input.fileName ?? null },
  });
  return row.id;
}

// Record a FAILED extraction (e.g. a non-JSON response or an API error) so the
// attempt is visible, audited, and the user can retry. Never stores a guessed draft.
export async function recordFailedSdsExtraction(input: {
  companyId: string;
  createdByUserId: string;
  errorMessage: string;
  fileName?: string | null;
  documentId?: string | null;
  model?: string | null;
}): Promise<string> {
  const row = await prisma.sdsExtraction.create({
    data: {
      companyId: input.companyId,
      status: "FAILED",
      aiModel: input.model ?? null,
      errorMessage: input.errorMessage.slice(0, 2000),
      fileName: input.fileName ?? null,
      documentId: input.documentId ?? null,
      createdByUserId: input.createdByUserId,
    },
    select: { id: true },
  });
  await recordAuditEvent({
    actorUserId: input.createdByUserId,
    action: "sds_extraction.fail",
    entityType: "SdsExtraction",
    entityId: row.id,
    companyId: input.companyId,
    diff: { error: input.errorMessage.slice(0, 500) },
  });
  return row.id;
}

export async function rejectSdsExtraction(input: {
  extractionId: string;
  companyId: string;
  actorUserId: string;
}): Promise<void> {
  const row = await prisma.sdsExtraction.findFirst({
    where: { id: input.extractionId, companyId: input.companyId },
    select: { id: true, status: true },
  });
  if (!row) throw new Error("SdsExtraction not found in company");
  if (row.status === "CONFIRMED") {
    throw new Error("A confirmed extraction cannot be rejected");
  }
  await prisma.sdsExtraction.update({
    where: { id: row.id },
    data: { status: "REJECTED" },
  });
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "sds_extraction.reject",
    entityType: "SdsExtraction",
    entityId: row.id,
    companyId: input.companyId,
  });
}
