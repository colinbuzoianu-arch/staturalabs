-- P11 §2/§3 (SLD_P11_LEGAL_REQUIREMENTS_APPROVED.md): the v1 core requirement
-- register, system rows (companyId null) under catalogue v1-dach-2026. Each row
-- links to a verified LegalReference by its code (reused P3/P8/P10 rows and the
-- new P11 rows), via a scalar subquery; obligationSummary is SLD's own label.
--
-- SIX requirements carry a NULL legalReferenceId with a note, because the
-- provision the approved doc named was only ever stored as a RetentionRule
-- source or lives in a module, not as a LegalReference row (the model allows a
-- null reference; §3.15 — honest gap over a wrong link). Reported to the
-- founder: AT-OSH-07 (PSA, deferred in P3), AT-OSH-08 (ASchG §47
-- Expositionsverzeichnis), AT-OSH-11 (ASchG §16 accident records, P10
-- retention only), AT-ENV-01 (AWG 2002 §10 — the AWK duty, E4 module),
-- AT-ENV-05 (EG-K/GewO anchor skipped in §4), DE-OSH-15 (DGUV V1 §24, P10
-- retention only).

INSERT INTO "LegalRequirementCatalogVersion" ("version","label","isActive","activatedAt")
VALUES ('v1-dach-2026','DACH legal-requirements register v1 (AT+DE OSH & environment, 2026-11-05)', true, CURRENT_TIMESTAMP);

-- Helper note: ref(country, code) = scalar subquery into the active P3 catalogue.
INSERT INTO "LegalRequirement"
  ("id","catalogVersion","companyId","country","domain","code","title","obligationSummary","legalReferenceId","applicability","defaultReviewInterval","notes","updatedAt")
VALUES
  -- AT — OSH
  (gen_random_uuid()::text,'v1-dach-2026',NULL,'AT','OSH','AT-OSH-01','Arbeitsplatzevaluierung','Gefahren ermitteln, beurteilen und Maßnahmen festlegen',(SELECT id FROM "LegalReference" WHERE "catalogVersion"='v1-dach-2026' AND country='AT' AND code='ASchG §4'),'{"domain":"OSH"}'::jsonb,'P1Y',NULL,now()),
  (gen_random_uuid()::text,'v1-dach-2026',NULL,'AT','OSH','AT-OSH-02','Sicherheits- und Gesundheitsschutzdokumente','Ergebnisse der Evaluierung dokumentieren',(SELECT id FROM "LegalReference" WHERE "catalogVersion"='v1-dach-2026' AND country='AT' AND code='ASchG §5'),'{"domain":"OSH"}'::jsonb,'P1Y',NULL,now()),
  (gen_random_uuid()::text,'v1-dach-2026',NULL,'AT','OSH','AT-OSH-03','Unterweisung','Arbeitnehmer nachweislich unterweisen',(SELECT id FROM "LegalReference" WHERE "catalogVersion"='v1-dach-2026' AND country='AT' AND code='ASchG §14'),'{"domain":"OSH"}'::jsonb,'P1Y',NULL,now()),
  (gen_random_uuid()::text,'v1-dach-2026',NULL,'AT','OSH','AT-OSH-04','Präventivdienste','Sicherheitsfachkräfte und Arbeitsmediziner bestellen',(SELECT id FROM "LegalReference" WHERE "catalogVersion"='v1-dach-2026' AND country='AT' AND code='ASchG §§73 ff.'),'{"domain":"OSH"}'::jsonb,'P1Y',NULL,now()),
  (gen_random_uuid()::text,'v1-dach-2026',NULL,'AT','OSH','AT-OSH-05','Arbeitsstätten','Anforderungen an Arbeitsstätten einhalten',(SELECT id FROM "LegalReference" WHERE "catalogVersion"='v1-dach-2026' AND country='AT' AND code='AStV'),'{"domain":"OSH"}'::jsonb,'P1Y',NULL,now()),
  (gen_random_uuid()::text,'v1-dach-2026',NULL,'AT','OSH','AT-OSH-06','Arbeitsmittel','Schutz bei der Benutzung von Arbeitsmitteln',(SELECT id FROM "LegalReference" WHERE "catalogVersion"='v1-dach-2026' AND country='AT' AND code='AM-VO'),'{"domain":"OSH"}'::jsonb,'P1Y',NULL,now()),
  (gen_random_uuid()::text,'v1-dach-2026',NULL,'AT','OSH','AT-OSH-07','Persönliche Schutzausrüstung','Auswahl, Bereitstellung und Benutzung von PSA',NULL,'{"domain":"OSH"}'::jsonb,'P1Y','PSA-V in P3 zurückgestellt — noch keine Katalogreferenz.',now()),
  (gen_random_uuid()::text,'v1-dach-2026',NULL,'AT','OSH','AT-OSH-08','Verzeichnis exponierter Arbeitnehmer','Verzeichnis bei CMR-/biologischen Arbeitsstoffen führen; Übermittlung an den UV-Träger',NULL,'{"domain":"OSH","requiresSubstances":true}'::jsonb,'P1Y','ASchG §47 — Referenz noch nicht im Katalog (Expositionsregister, gesondert geführt).',now()),
  (gen_random_uuid()::text,'v1-dach-2026',NULL,'AT','OSH','AT-OSH-09','Grenzwerte für Arbeitsstoffe','Grenzwerte (GKV) einhalten und Exposition ermitteln','legalref-at-gkv','{"domain":"OSH","requiresSubstances":true}'::jsonb,'P1Y',NULL,now()),
  (gen_random_uuid()::text,'v1-dach-2026',NULL,'AT','OSH','AT-OSH-10','Unfallmeldung','Arbeitsunfälle und Berufskrankheitsverdacht melden','legalref-at-n1','{"domain":"OSH"}'::jsonb,'P1Y',NULL,now()),
  (gen_random_uuid()::text,'v1-dach-2026',NULL,'AT','OSH','AT-OSH-11','Aufzeichnung von Arbeitsunfällen','Aufzeichnungen über Arbeitsunfälle führen (mind. 5 Jahre)',NULL,'{"domain":"OSH"}'::jsonb,'P1Y','ASchG §16 — in P10 nur als Aufbewahrungsregel hinterlegt, noch keine Katalogreferenz.',now()),
  (gen_random_uuid()::text,'v1-dach-2026',NULL,'AT','OSH','AT-OSH-12','Lärm und Vibrationen','Gefährdung durch Lärm/Vibrationen ermitteln, Grenzwerte beachten','legalref-at-volv','{"domain":"OSH","requiresHazardCategories":["NOISE","VIBRATION"]}'::jsonb,'P1Y',NULL,now()),
  (gen_random_uuid()::text,'v1-dach-2026',NULL,'AT','OSH','AT-OSH-13','Bildschirmarbeit','Anforderungen an Bildschirmarbeitsplätze','legalref-at-bsv','{"domain":"OSH"}'::jsonb,'P1Y',NULL,now()),
  -- DE — OSH
  (gen_random_uuid()::text,'v1-dach-2026',NULL,'DE','OSH','DE-OSH-01','Gefährdungsbeurteilung','Arbeitsbedingungen beurteilen, Maßnahmen ableiten',(SELECT id FROM "LegalReference" WHERE "catalogVersion"='v1-dach-2026' AND country='DE' AND code='ArbSchG §5'),'{"domain":"OSH"}'::jsonb,'P1Y',NULL,now()),
  (gen_random_uuid()::text,'v1-dach-2026',NULL,'DE','OSH','DE-OSH-02','Dokumentation','Gefährdungsbeurteilung dokumentieren',(SELECT id FROM "LegalReference" WHERE "catalogVersion"='v1-dach-2026' AND country='DE' AND code='ArbSchG §6'),'{"domain":"OSH"}'::jsonb,'P1Y',NULL,now()),
  (gen_random_uuid()::text,'v1-dach-2026',NULL,'DE','OSH','DE-OSH-03','Psychische Belastung','Psychische Belastung in die Beurteilung einbeziehen',(SELECT id FROM "LegalReference" WHERE "catalogVersion"='v1-dach-2026' AND country='DE' AND code='ArbSchG §5 Abs. 3 Nr. 6'),'{"domain":"OSH"}'::jsonb,'P1Y',NULL,now()),
  (gen_random_uuid()::text,'v1-dach-2026',NULL,'DE','OSH','DE-OSH-04','Unterweisung','Beschäftigte unterweisen',(SELECT id FROM "LegalReference" WHERE "catalogVersion"='v1-dach-2026' AND country='DE' AND code='ArbSchG §12'),'{"domain":"OSH"}'::jsonb,'P1Y',NULL,now()),
  (gen_random_uuid()::text,'v1-dach-2026',NULL,'DE','OSH','DE-OSH-05','Betriebsärzte / Fachkräfte','Betriebsärzte und Fachkräfte für Arbeitssicherheit bestellen',(SELECT id FROM "LegalReference" WHERE "catalogVersion"='v1-dach-2026' AND country='DE' AND code='ASiG'),'{"domain":"OSH"}'::jsonb,'P1Y','Konkretisiert durch DGUV Vorschrift 2.',now()),
  (gen_random_uuid()::text,'v1-dach-2026',NULL,'DE','OSH','DE-OSH-06','Arbeitsstätten','ArbStättV (+ ASR) einhalten',(SELECT id FROM "LegalReference" WHERE "catalogVersion"='v1-dach-2026' AND country='DE' AND code='ArbStättV'),'{"domain":"OSH"}'::jsonb,'P1Y',NULL,now()),
  (gen_random_uuid()::text,'v1-dach-2026',NULL,'DE','OSH','DE-OSH-07','Betriebssicherheit (Arbeitsmittel)','Gefährdungsbeurteilung und Schutzmaßnahmen bei Arbeitsmitteln',(SELECT id FROM "LegalReference" WHERE "catalogVersion"='v1-dach-2026' AND country='DE' AND code='BetrSichV'),'{"domain":"OSH"}'::jsonb,'P1Y',NULL,now()),
  (gen_random_uuid()::text,'v1-dach-2026',NULL,'DE','OSH','DE-OSH-08','Lärm und Vibrationen','Gefährdung durch Lärm/Vibrationen beurteilen',(SELECT id FROM "LegalReference" WHERE "catalogVersion"='v1-dach-2026' AND country='DE' AND code='LärmVibrationsArbSchV'),'{"domain":"OSH","requiresHazardCategories":["NOISE","VIBRATION"]}'::jsonb,'P1Y',NULL,now()),
  (gen_random_uuid()::text,'v1-dach-2026',NULL,'DE','OSH','DE-OSH-09','Persönliche Schutzausrüstung','Auswahl, Bereitstellung, Benutzung und Unterweisung PSA',(SELECT id FROM "LegalReference" WHERE "catalogVersion"='v1-dach-2026' AND country='DE' AND code='PSA-BV'),'{"domain":"OSH"}'::jsonb,'P1Y',NULL,now()),
  (gen_random_uuid()::text,'v1-dach-2026',NULL,'DE','OSH','DE-OSH-10','Gefahrstoffe','Gefahrstoffverzeichnis, Betriebsanweisung und Schutzmaßnahmen',(SELECT id FROM "LegalReference" WHERE "catalogVersion"='v1-dach-2026' AND country='DE' AND code='GefStoffV § 14 Abs. 1'),'{"domain":"OSH","requiresSubstances":true}'::jsonb,'P1Y',NULL,now()),
  (gen_random_uuid()::text,'v1-dach-2026',NULL,'DE','OSH','DE-OSH-11','Expositionsverzeichnis CMR/repro','Expositionsverzeichnis führen (40 J. CMR 1A/1B; 5 J. reprotoxisch)','legalref-de-exp','{"domain":"OSH","requiresSubstances":true}'::jsonb,'P1Y',NULL,now()),
  (gen_random_uuid()::text,'v1-dach-2026',NULL,'DE','OSH','DE-OSH-12','Arbeitsmedizinische Vorsorge','Vorsorge nach ArbMedVV anbieten/veranlassen, Vorsorgekartei führen','legalref-de-arbmedvv','{"domain":"OSH"}'::jsonb,'P1Y',NULL,now()),
  (gen_random_uuid()::text,'v1-dach-2026',NULL,'DE','OSH','DE-OSH-13','Biologische Arbeitsstoffe','Schutzmaßnahmen nach BioStoffV','legalref-de-biostoffv','{"domain":"OSH","requiresHazardCategories":["BIOLOGICAL"]}'::jsonb,'P1Y',NULL,now()),
  (gen_random_uuid()::text,'v1-dach-2026',NULL,'DE','OSH','DE-OSH-14','Unfallanzeige','Arbeitsunfälle / Berufskrankheitsverdacht anzeigen','legalref-de-n1','{"domain":"OSH"}'::jsonb,'P1Y',NULL,now()),
  (gen_random_uuid()::text,'v1-dach-2026',NULL,'DE','OSH','DE-OSH-15','Erste Hilfe','Erste-Hilfe-Organisation und Dokumentation (Verbandbuch)',NULL,'{"domain":"OSH"}'::jsonb,'P1Y','DGUV Vorschrift 1 §24 — in P10 nur als Aufbewahrungsregel hinterlegt, noch keine Katalogreferenz.',now()),
  -- AT — ENVIRONMENT
  (gen_random_uuid()::text,'v1-dach-2026',NULL,'AT','ENVIRONMENT','AT-ENV-01','Abfallwirtschaftskonzept','AWK ab >20 Arbeitnehmern erstellen und fortschreiben',NULL,'{"domain":"ENVIRONMENT","minEmployees":21}'::jsonb,'P1Y','AWG 2002 §10 — im AWK-Modul (E4) umgesetzt, noch keine eigene Katalogreferenz.',now()),
  (gen_random_uuid()::text,'v1-dach-2026',NULL,'AT','ENVIRONMENT','AT-ENV-02','Abfallbeauftragter','Abfallbeauftragten bestellen, wo erforderlich','legalref-at-awg-abf','{"domain":"ENVIRONMENT"}'::jsonb,'P1Y',NULL,now()),
  (gen_random_uuid()::text,'v1-dach-2026',NULL,'AT','ENVIRONMENT','AT-ENV-03','Abfallnachweise / Aufzeichnungen','Aufzeichnungen und Nachweise über Abfälle führen','legalref-at-awg-reg','{"domain":"ENVIRONMENT","requiresWasteStreams":true}'::jsonb,'P1Y',NULL,now()),
  (gen_random_uuid()::text,'v1-dach-2026',NULL,'AT','ENVIRONMENT','AT-ENV-04','Gewässerschutz / Abwasser','Umgang mit wassergefährdenden Stoffen und Einleitungen nach WRG 1959','legalref-at-wrg','{"domain":"ENVIRONMENT"}'::jsonb,'P1Y',NULL,now()),
  (gen_random_uuid()::text,'v1-dach-2026',NULL,'AT','ENVIRONMENT','AT-ENV-05','Anlagengenehmigung Luft/Emissionen','Emissions-/Anlagenpflichten (z. B. EG-K, GewO-Anlagenrecht)',NULL,'{"domain":"ENVIRONMENT"}'::jsonb,'P1Y','Rechtsanker abhängig vom Anlagentyp — vom Unternehmen je Standort zu ergänzen (§4 AT-EMI).',now()),
  -- DE — ENVIRONMENT
  (gen_random_uuid()::text,'v1-dach-2026',NULL,'DE','ENVIRONMENT','DE-ENV-01','Kreislaufwirtschaft / Abfall','Pflichten zur Abfallvermeidung und -bewirtschaftung','legalref-de-krwg','{"domain":"ENVIRONMENT","requiresWasteStreams":true}'::jsonb,'P1Y',NULL,now()),
  (gen_random_uuid()::text,'v1-dach-2026',NULL,'DE','ENVIRONMENT','DE-ENV-02','Betriebsbeauftragter für Abfall','Abfallbeauftragten bestellen, wo erforderlich','legalref-de-abfbeauftrv','{"domain":"ENVIRONMENT"}'::jsonb,'P1Y',NULL,now()),
  (gen_random_uuid()::text,'v1-dach-2026',NULL,'DE','ENVIRONMENT','DE-ENV-03','Gewerbeabfall','Getrennthaltung/Dokumentation nach GewAbfV','legalref-de-gewabfv','{"domain":"ENVIRONMENT","requiresWasteStreams":true}'::jsonb,'P1Y',NULL,now()),
  (gen_random_uuid()::text,'v1-dach-2026',NULL,'DE','ENVIRONMENT','DE-ENV-04','Immissionsschutz','Pflichten für genehmigungsbedürftige/nicht genehmigungsbedürftige Anlagen','legalref-de-bimschg','{"domain":"ENVIRONMENT"}'::jsonb,'P1Y',NULL,now()),
  (gen_random_uuid()::text,'v1-dach-2026',NULL,'DE','ENVIRONMENT','DE-ENV-05','Wasserhaushalt / wassergefährdende Stoffe','Umgang mit wassergefährdenden Stoffen (WHG / AwSV)','legalref-de-whg','{"domain":"ENVIRONMENT"}'::jsonb,'P1Y',NULL,now());
