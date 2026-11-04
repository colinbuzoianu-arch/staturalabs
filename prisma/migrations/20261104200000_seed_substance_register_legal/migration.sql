-- P8 §3.3: legal anchors for the substance register document, into the active
-- P3 catalogue (topic 'substance-register'). DE: GefStoffV § 6 Abs. 12 (a real
-- statutory register). AT: ASchG § 41 — NOT a stand-alone statutory register,
-- so the AT document is an Arbeitsstoffliste forming part of the evaluation
-- (the generator's header says so; it must not claim to be statutory).
INSERT INTO "LegalReference" ("id","catalogVersion","country","topic","code","obligation","sourceUrl","consolidatedVersion","verifiedBy","verifiedAt","verificationMethod")
VALUES
('gv-de-1','v1-dach-2026','DE','substance-register','GefStoffV § 6 Abs. 12','Verzeichnis der im Betrieb verwendeten Gefahrstoffe mit Verweis auf die Sicherheitsdatenblätter','https://www.gesetze-im-internet.de/gefstoffv_2010/__6.html',NULL,'Colin Buzoianu',TIMESTAMP '2026-11-04','seed-check'),
('gv-at-1','v1-dach-2026','AT','substance-register','ASchG § 41','Ermittlung und Beurteilung von Arbeitsstoffen; Arbeitsstoffliste als Bestandteil der Arbeitsplatzevaluierung (kein eigenes gesetzliches Verzeichnis)','https://www.ris.bka.gv.at/',NULL,'Colin Buzoianu',TIMESTAMP '2026-11-04','mirror')
ON CONFLICT ("catalogVersion","country","code") DO NOTHING;
