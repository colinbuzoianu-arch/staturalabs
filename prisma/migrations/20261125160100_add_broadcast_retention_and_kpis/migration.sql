-- Sicherheitsinformationen slice 4: retention + KPI definitions.
--
-- 1) Broadcast.retentionSummary — the aggregate (recipients / read / confirmed)
--    frozen onto the message before its per-person confirmation rows are
--    deleted by a matured retention batch. Without it, retention would destroy
--    the only trace that the information was passed on at all; with it, the
--    message and its totals survive while the PERSONAL list does not.
--
-- 2) BroadcastRetentionBatch / -Item — a FOURTH, separate batch kind, for the
--    same reason the substance and incident batches are separate from person
--    anonymisation (ERGO §3.18): the two kinds of review must never be
--    co-approved, and no FK reaches into the people compartment. Propose →
--    company_admin approves → the matured BroadcastRecipient rows are
--    HARD-DELETED. Legal hold on a person suppresses their rows.
--
-- 3) Retention catalogue v4-2026-11: copies v3 forward verbatim (so every
--    existing record type keeps a rule) and adds the BROADCAST_CONFIRMATION
--    rows. Basis POLICY_DEFAULT, P5Y, trigger RECORD_DATE (= publication).
--    There is NO statutory retention period for "proof that information was
--    passed on" in AT/DE/CH — the same honest finding P7d §C recorded for
--    instruction records — so the basis is company policy, editable per company
--    through the existing CompanyRetentionSetting surface, and the notes say so.
--
-- 4) KPI-set v3-2026: copies v2 forward verbatim and adds the three broadcast
--    KPIs (confirmation rate, overdue confirmations, average days to confirm).
--
-- NOTE: the first live attempt failed mid-way (two authoring bugs: the new
-- RetentionRule VALUES had country and catalogVersion swapped, and KpiDomain
-- has CROSS, not SHARED). Recovered with `prisma migrate resolve
-- --rolled-back`; the statements below were then made idempotent
-- (IF NOT EXISTS / ON CONFLICT / NOT EXISTS guards) so the corrected migration
-- is safe to run against the partially-applied state that attempt left behind
-- — the same recovery pattern the B2 migration documents.
--
-- Hand-added constructs to re-verify live:
--   * RLS + app_rls on both new tables; items Cascade with their batch.
--   * v4-2026-11 is the single active retention catalogue; v3 deactivated.
--   * v3-2026 is the single active KPI set; v2 deactivated.

ALTER TABLE "Broadcast" ADD COLUMN IF NOT EXISTS "retentionSummary" JSONB;

CREATE TABLE IF NOT EXISTS "BroadcastRetentionBatch" (
    "id"               TEXT NOT NULL,
    "companyId"        TEXT NOT NULL,
    "status"           "RetentionBatchStatus" NOT NULL DEFAULT 'PROPOSED',
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedByUserId" UUID,
    "approvedAt"       TIMESTAMP(3),
    CONSTRAINT "BroadcastRetentionBatch_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "BroadcastRetentionBatch_companyId_status_idx"
  ON "BroadcastRetentionBatch"("companyId", "status");
ALTER TABLE "BroadcastRetentionBatch" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS app_rls ON "BroadcastRetentionBatch";
CREATE POLICY app_rls ON "BroadcastRetentionBatch" FOR ALL TO statura_app
  USING ("companyId" = ANY (app_company_ids()))
  WITH CHECK ("companyId" = ANY (app_company_ids()));

CREATE TABLE IF NOT EXISTS "BroadcastRetentionItem" (
    "id"          TEXT NOT NULL,
    "batchId"     TEXT NOT NULL,
    -- The matured broadcast; recipientCount is what will be deleted, kept here
    -- so the proposal is reviewable without re-resolving it.
    "broadcastId" TEXT NOT NULL,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "maturedAt"   TIMESTAMP(3) NOT NULL,
    "deletedAt"   TIMESTAMP(3),
    CONSTRAINT "BroadcastRetentionItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "BroadcastRetentionItem_batchId_idx" ON "BroadcastRetentionItem"("batchId");
ALTER TABLE "BroadcastRetentionItem" DROP CONSTRAINT IF EXISTS "BroadcastRetentionItem_batchId_fkey";
ALTER TABLE "BroadcastRetentionItem" ADD CONSTRAINT "BroadcastRetentionItem_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "BroadcastRetentionBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BroadcastRetentionItem" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS app_rls ON "BroadcastRetentionItem";
CREATE POLICY app_rls ON "BroadcastRetentionItem" FOR ALL TO statura_app
  USING (EXISTS (SELECT 1 FROM "BroadcastRetentionBatch" p WHERE p.id = "BroadcastRetentionItem"."batchId"))
  WITH CHECK (EXISTS (SELECT 1 FROM "BroadcastRetentionBatch" p WHERE p.id = "BroadcastRetentionItem"."batchId"));

-- --- Retention catalogue v4-2026-11 --------------------------------------
UPDATE "RetentionRuleCatalogVersion" SET "isActive" = false WHERE "isActive" = true;

INSERT INTO "RetentionRuleCatalogVersion" ("version","label","isActive","activatedAt")
VALUES ('v4-2026-11','Aufbewahrungsfristen v4 (2026-11, inkl. Sicherheitsinformationen)', true, CURRENT_TIMESTAMP)
ON CONFLICT ("version") DO UPDATE SET "isActive" = true;

-- Carry v3 forward verbatim so no record type loses its rule.
INSERT INTO "RetentionRule"
  ("id","catalogVersion","country","recordType","basis","minRetention","trigger","sourceUrl","consolidatedVersion","verifiedAt","verifiedBy","verificationMethod","notes")
SELECT gen_random_uuid()::text, 'v4-2026-11', "country", "recordType", "basis", "minRetention", "trigger",
       "sourceUrl", "consolidatedVersion", "verifiedAt", "verifiedBy", "verificationMethod", "notes"
FROM "RetentionRule"
WHERE "catalogVersion" = 'v3-2026-11'
  AND NOT EXISTS (SELECT 1 FROM "RetentionRule" r2 WHERE r2."catalogVersion" = 'v4-2026-11');

-- The new rows: one per country in the enum, all POLICY_DEFAULT. No statutory
-- period exists for this record type anywhere in DACH — stated in the notes so
-- the UI shows an honest basis rather than implying a legal minimum.
INSERT INTO "RetentionRule"
  ("id","catalogVersion","country","recordType","basis","minRetention","trigger","notes")
VALUES
  (gen_random_uuid()::text,'v4-2026-11','AT','BROADCAST_CONFIRMATION','POLICY_DEFAULT','P5Y','RECORD_DATE',
   'Kein gesetzlicher Zeitraum fuer den Nachweis der Informationsweitergabe; Unternehmenspolicy, ab Veroeffentlichung.'),
  (gen_random_uuid()::text,'v4-2026-11','DE','BROADCAST_CONFIRMATION','POLICY_DEFAULT','P5Y','RECORD_DATE',
   'Kein gesetzlicher Zeitraum fuer den Nachweis der Informationsweitergabe; Unternehmenspolicy, ab Veroeffentlichung.'),
  (gen_random_uuid()::text,'v4-2026-11','CH','BROADCAST_CONFIRMATION','POLICY_DEFAULT','P5Y','RECORD_DATE',
   'Kein gesetzlicher Zeitraum fuer den Nachweis der Informationsweitergabe; Unternehmenspolicy, ab Veroeffentlichung.'),
  (gen_random_uuid()::text,'v4-2026-11','RO','BROADCAST_CONFIRMATION','POLICY_DEFAULT','P5Y','RECORD_DATE',
   'Kein gesetzlicher Zeitraum fuer den Nachweis der Informationsweitergabe; Unternehmenspolicy, ab Veroeffentlichung.');

-- --- KPI-set v3-2026 ------------------------------------------------------
INSERT INTO "KpiCatalogVersion" ("version","label","isActive","activatedAt")
VALUES ('v3-2026','KPI-Set v3 (2026)', false, CURRENT_TIMESTAMP)
ON CONFLICT ("version") DO NOTHING;

INSERT INTO "KpiDefinition"
  ("id","catalogVersion","key","label","unit","domain","personDerived","higherIsBetter","periodScoped","order","country","createdAt")
SELECT gen_random_uuid()::text, 'v3-2026', "key", "label", "unit", "domain",
       "personDerived", "higherIsBetter", "periodScoped", "order", "country", CURRENT_TIMESTAMP
FROM "KpiDefinition"
WHERE "catalogVersion" = 'v2-2026'
  AND NOT EXISTS (SELECT 1 FROM "KpiDefinition" d2 WHERE d2."catalogVersion" = 'v3-2026');

-- The three broadcast KPIs. personDerived = they are computed over recipient
-- rows that identify people, so the §3.4 minimum-group-size gate applies to
-- them in src/lib/analytics/kpi.ts, exactly like the lost-day rates.
INSERT INTO "KpiDefinition"
  ("id","catalogVersion","key","label","unit","domain","personDerived","higherIsBetter","periodScoped","order")
VALUES
  (gen_random_uuid()::text,'v3-2026','broadcast-confirmation-rate','Bestaetigungsquote Sicherheitsinformationen','%','CROSS', true, true,  true, 60),
  (gen_random_uuid()::text,'v3-2026','broadcast-confirmations-overdue','Ueberfaellige Bestaetigungen','Anzahl','CROSS', true, false, true, 61),
  (gen_random_uuid()::text,'v3-2026','broadcast-days-to-confirm','Durchschnittliche Tage bis Bestaetigung','Tage','CROSS', true, false, true, 62);

UPDATE "KpiCatalogVersion" SET "isActive" = false WHERE "version" = 'v2-2026';
UPDATE "KpiCatalogVersion" SET "isActive" = true  WHERE "version" = 'v3-2026';
