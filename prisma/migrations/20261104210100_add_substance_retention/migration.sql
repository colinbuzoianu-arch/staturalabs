-- P8 slice 6 §3.4. Substance-record retention: a separate deletion-batch flow
-- (SubstanceRetentionBatch/Item), deliberately NOT the person-anonymisation
-- batch (RetentionBatch) — person anonymisation and non-person substance-data
-- deletion must never be co-approved, and the people-compartment stays pristine
-- (no FK from these tables into Person). Reuses the RetentionBatchStatus enum
-- and the PROPOSED -> APPROVED/CANCELLED flow; approval HARD-DELETES the
-- expired SDS / SubstanceUse rows (they are company data, not person data, so
-- there is nothing to anonymise — the REACH Art. 36 period has passed).

-- CreateTable: SubstanceRetentionBatch
CREATE TABLE "SubstanceRetentionBatch" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "status" "RetentionBatchStatus" NOT NULL DEFAULT 'PROPOSED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedByUserId" UUID,
    "approvedAt" TIMESTAMP(3),
    CONSTRAINT "SubstanceRetentionBatch_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SubstanceRetentionBatch_companyId_status_idx" ON "SubstanceRetentionBatch"("companyId", "status");
ALTER TABLE "SubstanceRetentionBatch" ENABLE ROW LEVEL SECURITY;

-- CreateTable: SubstanceRetentionItem. recordType is the kind of record
-- (SDS | SUBSTANCE_USE); recordId is its plain id (the batch outlives the row,
-- like RetentionBatchItem's plain personId). maturedAt = when retention matured.
CREATE TABLE "SubstanceRetentionItem" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "recordType" "RetentionRecordType" NOT NULL,
    "recordId" TEXT NOT NULL,
    "maturedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "SubstanceRetentionItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SubstanceRetentionItem_batchId_idx" ON "SubstanceRetentionItem"("batchId");
ALTER TABLE "SubstanceRetentionItem"
  ADD CONSTRAINT "SubstanceRetentionItem_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "SubstanceRetentionBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Only substance record types are legal here (the person types stay in the
-- person batch; the reserved exposure types have no rows until P10).
ALTER TABLE "SubstanceRetentionItem" ADD CONSTRAINT "SubstanceRetentionItem_record_type_check"
  CHECK ("recordType" IN ('SDS', 'SUBSTANCE_USE'));
ALTER TABLE "SubstanceRetentionItem" ENABLE ROW LEVEL SECURITY;

-- Seed catalogue v2-2026-11 (active). Deactivate v1 first (single-active
-- partial unique index on isActive). Copy every v1 rule forward verbatim so the
-- catalogue stays complete, then add the substance rows. REACH Art. 36(1) is
-- EU-wide: downstream users keep the required information (incl. the SDS) for
-- >= 10 years after they last manufactured/imported/supplied/used the substance
-- — so AT and DE get identical P10Y/LAST_USE rows. SUBSTANCE_USE is a company
-- policy default aligned to the same period (POLICY_DEFAULT, a company may
-- extend). The per-person exposure register (40y DE § 10a / AT § 47) is
-- deliberately NOT seeded here — it is reserved for P10 (§3.4).
UPDATE "RetentionRuleCatalogVersion" SET "isActive" = false WHERE "isActive" = true;

INSERT INTO "RetentionRuleCatalogVersion" ("version","label","isActive","activatedAt")
VALUES ('v2-2026-11','Aufbewahrungsfristen v2 (2026-11, inkl. Gefahrstoffe)', true, CURRENT_TIMESTAMP);

-- Carry every v1 rule forward unchanged.
INSERT INTO "RetentionRule"
  ("id","catalogVersion","country","recordType","basis","minRetention","trigger","sourceUrl","consolidatedVersion","verifiedAt","verifiedBy","verificationMethod","notes")
SELECT
  'v2-' || "id", 'v2-2026-11', "country", "recordType", "basis", "minRetention", "trigger", "sourceUrl", "consolidatedVersion", "verifiedAt", "verifiedBy", "verificationMethod", "notes"
FROM "RetentionRule" WHERE "catalogVersion" = 'v1-2026-11';

-- Substance rows (§3.4). SDS = statutory (REACH Art. 36), SUBSTANCE_USE = policy.
INSERT INTO "RetentionRule"
  ("id","catalogVersion","country","recordType","basis","minRetention","trigger","sourceUrl","consolidatedVersion","verifiedAt","verifiedBy","verificationMethod","notes")
VALUES
  ('rr2-at-sds','v2-2026-11','AT','SDS','STATUTORY','P10Y','LAST_USE','https://eur-lex.europa.eu/eli/reg/2006/1907/oj',NULL,TIMESTAMP '2026-11-04','Colin Buzoianu','mirror','REACH Art. 36(1): nachgeschaltete Anwender bewahren die erforderlichen Informationen (inkl. Sicherheitsdatenblatt) mindestens 10 Jahre nach der letzten Verwendung auf.'),
  ('rr2-de-sds','v2-2026-11','DE','SDS','STATUTORY','P10Y','LAST_USE','https://eur-lex.europa.eu/eli/reg/2006/1907/oj',NULL,TIMESTAMP '2026-11-04','Colin Buzoianu','mirror','REACH Art. 36(1): nachgeschaltete Anwender bewahren die erforderlichen Informationen (inkl. Sicherheitsdatenblatt) mindestens 10 Jahre nach der letzten Verwendung auf.'),
  ('rr2-at-su','v2-2026-11','AT','SUBSTANCE_USE','POLICY_DEFAULT','P10Y','LAST_USE',NULL,NULL,TIMESTAMP '2026-11-04','Colin Buzoianu','mirror','Unternehmensrichtlinie, an REACH Art. 36 ausgerichtet (das Unternehmen kann verlaengern). Keine eigenstaendige gesetzliche Frist fuer den Verwendungsnachweis.'),
  ('rr2-de-su','v2-2026-11','DE','SUBSTANCE_USE','POLICY_DEFAULT','P10Y','LAST_USE',NULL,NULL,TIMESTAMP '2026-11-04','Colin Buzoianu','mirror','Unternehmensrichtlinie, an REACH Art. 36 ausgerichtet (das Unternehmen kann verlaengern). Keine eigenstaendige gesetzliche Frist fuer den Verwendungsnachweis.');
