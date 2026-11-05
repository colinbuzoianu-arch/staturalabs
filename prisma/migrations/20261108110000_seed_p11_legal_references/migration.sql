-- P11 §4 (SLD_P11_LEGAL_REQUIREMENTS_APPROVED.md): the genuinely-new
-- LegalReference rows, into the active P3 catalogue v1-dach-2026. Fixed ids so
-- the LegalRequirement rows (next slice) reference them deterministically.
-- verifiedBy = "Colin Buzoianu", verifiedAt = 2026-11-05.
--
-- seed-check discipline: every official/seed-check page was read at build time
-- (2026-11-08). Resolved identifiers:
--   AT-GKV  RIS Gesetzesnummer 20001418 (Grenzwerteverordnung, BGBl. II 253/2001 idF BGBl. II 330/2024)
--   AT-VOLV ELI bgbl/II/2006/22 (VOLV, BGBl. II 22/2006 idF BGBl. II 302/2009)
--   AT-BSV  RIS Gesetzesnummer 10009121 (BS-V, BGBl. II 124/1998)
--   AT-AWG  RIS Gesetzesnummer 20002086 (AWG 2002, BGBl. I 102/2002)
--   AT-WRG  RIS Gesetzesnummer 10010290 (WRG 1959, BGBl. 215/1959)
--   DE pages all resolved on gesetze-im-internet.de; AbfBeauftrV's given URL
--     404'd and was corrected to the /abfbeauftrv_2017/ slug.
-- SKIPPED (reported): AT-EMI (EG-K / GewO-Anlagenrecht) — no single clean
--   anchor without knowing the installation type; AT-ENV-05 is seeded in the
--   next slice with a null legalReferenceId and a note instead of a guessed
--   citation (§3.15 — honest gap over invented value).

INSERT INTO "LegalReference"
  ("id","catalogVersion","country","topic","code","obligation","sourceUrl","consolidatedVersion","verifiedBy","verifiedAt","verificationMethod","createdAt")
VALUES
  ('legalref-at-gkv','v1-dach-2026','AT','hazardous-substances','GKV',
   'Grenzwerte für Arbeitsstoffe (MAK/TRK) einhalten und die Exposition ermitteln',
   'https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=20001418',
   'Grenzwerteverordnung, BGBl. II Nr. 253/2001 idF BGBl. II Nr. 330/2024 (RIS 20001418, gelesen 2026-11-08)',
   'Colin Buzoianu','2026-11-05','seed-check',CURRENT_TIMESTAMP),
  ('legalref-at-volv','v1-dach-2026','AT','noise-vibration','VOLV',
   'Gefährdung durch Lärm und Vibrationen ermitteln und Grenzwerte beachten',
   'https://www.ris.bka.gv.at/eli/bgbl/II/2006/22',
   'Verordnung Lärm und Vibrationen, BGBl. II Nr. 22/2006 idF BGBl. II Nr. 302/2009 (gelesen 2026-11-08)',
   'Colin Buzoianu','2026-11-05','seed-check',CURRENT_TIMESTAMP),
  ('legalref-at-bsv','v1-dach-2026','AT','workplaces','BS-V',
   'Anforderungen an Bildschirmarbeitsplätze einhalten',
   'https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10009121',
   'Bildschirmarbeitsverordnung, BGBl. II Nr. 124/1998 (RIS 10009121, gelesen 2026-11-08)',
   'Colin Buzoianu','2026-11-05','seed-check',CURRENT_TIMESTAMP),
  ('legalref-at-awg-abf','v1-dach-2026','AT','environment','AWG 2002 §11',
   'Abfallbeauftragten bestellen, wo erforderlich',
   'https://www.ris.bka.gv.at/eli/bgbl/i/2002/102',
   'AWG 2002 §11, BGBl. I Nr. 102/2002 (RIS 20002086)',
   'Colin Buzoianu','2026-11-05','mirror',CURRENT_TIMESTAMP),
  ('legalref-at-awg-reg','v1-dach-2026','AT','environment','AWG 2002 §17',
   'Aufzeichnungen und Nachweise über Abfälle führen',
   'https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=20002086',
   'AWG 2002 §17, BGBl. I Nr. 102/2002 (RIS 20002086)',
   'Colin Buzoianu','2026-11-05','mirror',CURRENT_TIMESTAMP),
  ('legalref-at-wrg','v1-dach-2026','AT','environment','WRG 1959',
   'Umgang mit wassergefährdenden Stoffen und Einleitungen nach WRG 1959',
   'https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10010290',
   'Wasserrechtsgesetz 1959, BGBl. Nr. 215/1959 (RIS 10010290, gelesen 2026-11-08)',
   'Colin Buzoianu','2026-11-05','seed-check',CURRENT_TIMESTAMP),
  ('legalref-de-arbmedvv','v1-dach-2026','DE','occupational-health','ArbMedVV',
   'Arbeitsmedizinische Vorsorge anbieten/veranlassen und Vorsorgekartei führen',
   'https://www.gesetze-im-internet.de/arbmedvv/',
   'Verordnung zur arbeitsmedizinischen Vorsorge (geltende Fassung, gesetze-im-internet.de, gelesen 2026-11-08)',
   'Colin Buzoianu','2026-11-05','seed-check',CURRENT_TIMESTAMP),
  ('legalref-de-biostoffv','v1-dach-2026','DE','biological-agents','BioStoffV',
   'Schutzmaßnahmen bei Tätigkeiten mit biologischen Arbeitsstoffen',
   'https://www.gesetze-im-internet.de/biostoffv_2013/',
   'Biostoffverordnung (geltende Fassung, gesetze-im-internet.de, gelesen 2026-11-08)',
   'Colin Buzoianu','2026-11-05','seed-check',CURRENT_TIMESTAMP),
  ('legalref-de-exp','v1-dach-2026','DE','hazardous-substances','GefStoffV §10a',
   'Expositionsverzeichnis bei CMR-Tätigkeiten führen (40 J. CMR 1A/1B; 5 J. reprotoxisch)',
   'https://www.gesetze-im-internet.de/gefstoffv_2010/__10a.html',
   'GefStoffV §10a (geltende Fassung, gesetze-im-internet.de, gelesen 2026-11-08)',
   'Colin Buzoianu','2026-11-05','seed-check',CURRENT_TIMESTAMP),
  ('legalref-de-krwg','v1-dach-2026','DE','environment','KrWG',
   'Abfallvermeidung und ordnungsgemäße Abfallbewirtschaftung',
   'https://www.gesetze-im-internet.de/krwg/',
   'Kreislaufwirtschaftsgesetz (geltende Fassung, gesetze-im-internet.de, gelesen 2026-11-08)',
   'Colin Buzoianu','2026-11-05','official',CURRENT_TIMESTAMP),
  ('legalref-de-abfbeauftrv','v1-dach-2026','DE','environment','AbfBeauftrV',
   'Betriebsbeauftragten für Abfall bestellen, wo erforderlich',
   'https://www.gesetze-im-internet.de/abfbeauftrv_2017/',
   'Verordnung über Betriebsbeauftragte für Abfall, v. 2.12.2016, zuletzt geänd. 30.09.2025 (gelesen 2026-11-08)',
   'Colin Buzoianu','2026-11-05','seed-check',CURRENT_TIMESTAMP),
  ('legalref-de-gewabfv','v1-dach-2026','DE','environment','GewAbfV',
   'Getrennthaltung und Dokumentation von Gewerbeabfällen',
   'https://www.gesetze-im-internet.de/gewabfv_2017/',
   'Gewerbeabfallverordnung (geltende Fassung, gesetze-im-internet.de, gelesen 2026-11-08)',
   'Colin Buzoianu','2026-11-05','seed-check',CURRENT_TIMESTAMP),
  ('legalref-de-bimschg','v1-dach-2026','DE','environment','BImSchG',
   'Pflichten für genehmigungsbedürftige und nicht genehmigungsbedürftige Anlagen',
   'https://www.gesetze-im-internet.de/bimschg/',
   'Bundes-Immissionsschutzgesetz (geltende Fassung, gesetze-im-internet.de, gelesen 2026-11-08)',
   'Colin Buzoianu','2026-11-05','official',CURRENT_TIMESTAMP),
  ('legalref-de-whg','v1-dach-2026','DE','environment','WHG',
   'Umgang mit wassergefährdenden Stoffen (WHG / AwSV)',
   'https://www.gesetze-im-internet.de/whg_2009/',
   'Wasserhaushaltsgesetz (geltende Fassung, gesetze-im-internet.de, gelesen 2026-11-08)',
   'Colin Buzoianu','2026-11-05','official',CURRENT_TIMESTAMP);
