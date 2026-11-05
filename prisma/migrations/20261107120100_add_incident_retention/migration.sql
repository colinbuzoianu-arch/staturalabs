-- P10e §B.1 + §D.3: incident-retention batch tables, and catalogue v3-2026-11
-- (copy v2 forward verbatim, add the §B.1 rows, activate). RLS on. FKs as the
-- substance batch: items Cascade with their batch; recordId is a plain id.

CREATE TABLE "IncidentRetentionBatch" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "status" "RetentionBatchStatus" NOT NULL DEFAULT 'PROPOSED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedByUserId" UUID,
    "approvedAt" TIMESTAMP(3),
    CONSTRAINT "IncidentRetentionBatch_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "IncidentRetentionBatch_companyId_status_idx" ON "IncidentRetentionBatch"("companyId", "status");
ALTER TABLE "IncidentRetentionBatch" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "IncidentRetentionItem" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "recordType" "RetentionRecordType" NOT NULL,
    "recordId" TEXT NOT NULL,
    "maturedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "IncidentRetentionItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "IncidentRetentionItem_batchId_idx" ON "IncidentRetentionItem"("batchId");
ALTER TABLE "IncidentRetentionItem" ADD CONSTRAINT "IncidentRetentionItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "IncidentRetentionBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IncidentRetentionItem" ENABLE ROW LEVEL SECURITY;

-- Catalogue v3-2026-11 (active). Deactivate v2 first (single-active partial
-- unique index). Copy every v2 rule forward verbatim as v3-<id> so prior
-- record types keep a rule, then add the §B.1 incident rows.
UPDATE "RetentionRuleCatalogVersion" SET "isActive" = false WHERE "isActive" = true;

INSERT INTO "RetentionRuleCatalogVersion" ("version","label","isActive","activatedAt")
VALUES ('v3-2026-11','Aufbewahrungsfristen v3 (2026-11, inkl. Ereignisse)', true, CURRENT_TIMESTAMP);

INSERT INTO "RetentionRule"
  ("id","catalogVersion","country","recordType","basis","minRetention","trigger","sourceUrl","consolidatedVersion","verifiedAt","verifiedBy","verificationMethod","notes")
SELECT
  'v3-' || "id", 'v3-2026-11', "country", "recordType", "basis", "minRetention", "trigger", "sourceUrl", "consolidatedVersion", "verifiedAt", "verifiedBy", "verificationMethod", "notes"
FROM "RetentionRule" WHERE "catalogVersion" = 'v2-2026-11';

-- §B.1 incident rows. Two STATUTORY (minRetention + sourceUrl, mirror); the
-- rest POLICY_DEFAULT (no statutory period — honest basis, verificationMethod
-- null, rationale in notes). verifiedBy/verifiedAt = founder / 2026-11-05.
INSERT INTO "RetentionRule"
  ("id","catalogVersion","country","recordType","basis","minRetention","trigger","sourceUrl","consolidatedVersion","verifiedAt","verifiedBy","verificationMethod","notes")
VALUES
  ('rr3-at-incident','v3-2026-11','AT','INCIDENT','STATUTORY','P5Y','RECORD_DATE','https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10008910&Paragraf=16','§16 Abs. 2 ASchG — Aufzeichnungen über Arbeitsunfälle mind. 5 Jahre',TIMESTAMP '2026-11-05','Colin Buzoianu','mirror','§16 Abs. 2 ASchG: Aufzeichnungen über Arbeitsunfälle (Tod oder >3 Tage AU) sind mindestens 5 Jahre aufzubewahren.'),
  ('rr3-de-firstaid','v3-2026-11','DE','FIRST_AID_RECORD','STATUTORY','P5Y','RECORD_DATE','https://publikationen.dguv.de','§24 Abs. 6 DGUV Vorschrift 1 / DGUV Information 204-020',TIMESTAMP '2026-11-05','Colin Buzoianu','mirror','§24 Abs. 6 DGUV Vorschrift 1 (DGUV Information 204-020): Erste-Hilfe-Dokumentation/Verbandbuch 5 Jahre nach der letzten Eintragung.'),
  ('rr3-de-incident','v3-2026-11','DE','INCIDENT','POLICY_DEFAULT','P5Y','RECORD_DATE',NULL,NULL,TIMESTAMP '2026-11-05','Colin Buzoianu',NULL,'Keine eigenständige gesetzliche Aufbewahrungsfrist für die Unfallanzeige-Kopie; Vorgabe nach Unternehmensrichtlinie, an der 5-Jahres-Norm (Verbandbuch/Personalunterlagen) ausgerichtet.'),
  ('rr3-at-firstaid','v3-2026-11','AT','FIRST_AID_RECORD','POLICY_DEFAULT','P5Y','RECORD_DATE',NULL,NULL,TIMESTAMP '2026-11-05','Colin Buzoianu',NULL,'Kein AT-Äquivalent zur DGUV-Verbandbuch-Regel gefunden; Vorgabe nach Unternehmensrichtlinie, an §16 ASchG (5 Jahre) ausgerichtet.'),
  ('rr3-at-incident-health','v3-2026-11','AT','INCIDENT_HEALTH','POLICY_DEFAULT','P10Y','END_OF_EMPLOYMENT',NULL,NULL,TIMESTAMP '2026-11-05','Colin Buzoianu',NULL,'Keine einzelne gesetzliche Frist für medizinische Ereignisfelder. Langzeit-Expositionsregister (AT §47 ASchG, 40 Jahre) wird gesondert geführt, nicht hier. Standard 10 Jahre; Unternehmen kann verlängern.'),
  ('rr3-de-incident-health','v3-2026-11','DE','INCIDENT_HEALTH','POLICY_DEFAULT','P10Y','END_OF_EMPLOYMENT',NULL,NULL,TIMESTAMP '2026-11-05','Colin Buzoianu',NULL,'Keine einzelne gesetzliche Frist für medizinische Ereignisfelder. Langzeit-Expositionsregister (DE §10a GefStoffV / AMR 6.1 zu ArbMedVV, 40 Jahre CMR) wird gesondert geführt, nicht hier. Standard 10 Jahre; Unternehmen kann verlängern.');
