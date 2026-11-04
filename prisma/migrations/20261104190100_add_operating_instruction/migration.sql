-- P8 §3.2: OperatingInstruction (Betriebsanweisung) lifecycle + the legal
-- anchors for the substance operating instruction (added to the P3 catalogue
-- v1-dach-2026, topic 'substance-operating-instruction'). RLS on. FKs Restrict.

CREATE TABLE "OperatingInstruction" (
    "id" TEXT NOT NULL,
    "substanceId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "status" "RiskAssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedByUserId" UUID,
    "approvedAt" TIMESTAMP(3),
    "basedOnSdsRevisionDate" TIMESTAMP(3),
    "generatedDocumentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OperatingInstruction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OperatingInstruction_substanceId_idx" ON "OperatingInstruction"("substanceId");
CREATE INDEX "OperatingInstruction_siteId_idx" ON "OperatingInstruction"("siteId");
ALTER TABLE "OperatingInstruction" ADD CONSTRAINT "OperatingInstruction_substanceId_fkey" FOREIGN KEY ("substanceId") REFERENCES "Substance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperatingInstruction" ADD CONSTRAINT "OperatingInstruction_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperatingInstruction" ENABLE ROW LEVEL SECURITY;

-- Legal anchors for the Betriebsanweisung (§3.2), into the active P3 catalogue.
INSERT INTO "LegalReference" ("id","catalogVersion","country","topic","code","obligation","sourceUrl","consolidatedVersion","verifiedBy","verifiedAt","verificationMethod")
VALUES
('gs-de-1','v1-dach-2026','DE','substance-operating-instruction','GefStoffV § 14 Abs. 1','Schriftliche Betriebsanweisung, die der Gefährdungsbeurteilung Rechnung trägt, in verständlicher Form und Sprache zugänglich machen','https://www.gesetze-im-internet.de/gefstoffv_2010/__14.html',NULL,'Colin Buzoianu',TIMESTAMP '2026-11-04','seed-check'),
('gs-de-2','v1-dach-2026','DE','substance-operating-instruction','TRGS 555','Technische Regel: Betriebsanweisung und Information der Beschäftigten (Gliederung, Gestaltung)','https://www.baua.de/DE/Angebote/Regelwerk/TRGS/TRGS-555.html',NULL,'Colin Buzoianu',TIMESTAMP '2026-11-04','seed-check'),
('gs-at-1','v1-dach-2026','AT','substance-operating-instruction','ASchG § 14','Unterweisung inkl. schriftlicher Anweisungen; bei Einführung neuer Arbeitsstoffe zwingend','https://www.ris.bka.gv.at/',NULL,'Colin Buzoianu',TIMESTAMP '2026-11-04','mirror')
ON CONFLICT ("catalogVersion","country","code") DO NOTHING;
