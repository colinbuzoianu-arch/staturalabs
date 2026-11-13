-- P15 S2 (SLD_P15_GEFAHRSTOFFE_EXTENDED_APPROVED.md §2 S2): SDS ingestion with AI.
-- A supplier SDS (PDF) is uploaded; Claude (server-side, tenant-scoped, behind the
-- KI-Funktionen entitlement) extracts its fields into a PRE-FILLED REVIEW FORM.
-- Nothing is saved as confirmed SDS data until a user accepts it field by field;
-- SdsExtraction is that review record, holding the AI draft + per-field evidence
-- (page + snippet) + token usage + the creating/confirming PlatformUser ids.
--
-- Person-free (ERGO §3.1/§3.13): SDS are product documents (no worker data); the
-- user ids are staff accounts, plain @db.Uuid like Action.responsibleUserId.
-- `extractedData` is the full typed draft as JSON (shape in
-- src/lib/chemicals/sds-extraction-schema.ts). Company-scoped RLS (P13 §1).
-- FKs Restrict (ERGO §3.9). The confirmed SDS detail columns/children land in S2b.

CREATE TYPE "SdsExtractionStatus" AS ENUM ('PENDING_REVIEW', 'CONFIRMED', 'REJECTED', 'FAILED');

CREATE TABLE "SdsExtraction" (
    "id"                TEXT NOT NULL,
    "companyId"         TEXT NOT NULL,
    "substanceId"       TEXT,
    "documentId"        TEXT,
    "fileName"          TEXT,
    "status"            "SdsExtractionStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "aiModel"           TEXT,
    "inputTokens"       INTEGER,
    "outputTokens"      INTEGER,
    "extractedData"     JSONB,
    "errorMessage"      TEXT,
    "createdByUserId"   UUID NOT NULL,
    "confirmedByUserId" UUID,
    "confirmedAt"       TIMESTAMP(3),
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SdsExtraction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SdsExtraction_companyId_idx" ON "SdsExtraction"("companyId");
CREATE INDEX "SdsExtraction_substanceId_idx" ON "SdsExtraction"("substanceId");
CREATE INDEX "SdsExtraction_documentId_idx" ON "SdsExtraction"("documentId");

ALTER TABLE "SdsExtraction" ADD CONSTRAINT "SdsExtraction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SdsExtraction" ADD CONSTRAINT "SdsExtraction_substanceId_fkey" FOREIGN KEY ("substanceId") REFERENCES "Substance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SdsExtraction" ADD CONSTRAINT "SdsExtraction_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SdsExtraction" ENABLE ROW LEVEL SECURITY;
-- Company-scoped RLS (P13 §1): own company only.
CREATE POLICY app_rls ON "SdsExtraction" FOR ALL TO statura_app
  USING ("companyId" = ANY(app_company_ids()))
  WITH CHECK ("companyId" = ANY(app_company_ids()));
