-- P10d §C (SLD_P10_STATUTORY_NOTIFICATIONS_APPROVED.md): three new LegalReference
-- rows for the statutory incident-notification duties, into the active P3
-- catalogue v1-dach-2026. Fixed ids so IncidentNotificationRule can reference
-- them deterministically. verifiedBy = "Colin Buzoianu", verifiedAt =
-- 2026-11-05, per-row verificationMethod from §C.
--
-- seed-check discipline (DE-N1): the Stand was read off the official page at
-- build time (gesetze-im-internet.de/sgb_7/__193.html, 2026-11-05) — the §193
-- page resolves and states the 3-day duty; it carries no section-level
-- "zuletzt geändert" note, so the geltende Fassung + read date is recorded.
-- AT-N1 (mirror): RIS Gesetzesnummer 10008147 §363 resolves — in force
-- 01.03.2024, last amended BGBl. I Nr. 106/2024, 5-day/>3-day-or-death. CH-N1
-- (mirror): fedlex UVG, "so rasch wie möglich" (positioning-only — the ch pack
-- stays verified:false, so it never renders on a live CH site).
--
-- topic = 'incident-notification' (a new §4.2-style topic grouping). The
-- lookup never borrows across countries (§3.15).

INSERT INTO "LegalReference"
  ("id", "catalogVersion", "country", "topic", "code", "obligation", "sourceUrl", "consolidatedVersion", "verifiedBy", "verifiedAt", "verificationMethod", "createdAt")
VALUES
  ('legalref-at-n1', 'v1-dach-2026', 'AT', 'incident-notification', 'ASVG §363 Abs. 1',
   'Meldung jedes Arbeitsunfalls (Tod oder mehr als 3 Tage völlige/teilweise Arbeitsunfähigkeit) und begründeten Berufskrankheitsverdachts an den zuständigen Unfallversicherungsträger, längstens binnen 5 Tagen',
   'https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10008147&Paragraf=363',
   '§363 Abs. 1 idF BGBl. I Nr. 106/2024, in Kraft 01.03.2024 (RIS-Fassung gelesen 2026-11-05)',
   'Colin Buzoianu', '2026-11-05', 'mirror', CURRENT_TIMESTAMP),
  ('legalref-de-n1', 'v1-dach-2026', 'DE', 'incident-notification', 'SGB VII §193',
   'Unfallanzeige an den Unfallversicherungsträger bei Tod oder mehr als 3 Tagen Arbeitsunfähigkeit, binnen 3 Tagen ab Kenntnis; Mitunterzeichnung durch den Betriebs-/Personalrat (Abs. 5)',
   'https://www.gesetze-im-internet.de/sgb_7/__193.html',
   'SGB VII (Art. 1 G v. 7.8.1996, BGBl. I S. 1254), §193 geltende Fassung (gesetze-im-internet.de, gelesen 2026-11-05)',
   'Colin Buzoianu', '2026-11-05', 'seed-check', CURRENT_TIMESTAMP),
  ('legalref-ch-n1', 'v1-dach-2026', 'CH', 'incident-notification', 'UVG / VUV',
   'Meldung von Berufs- und Nichtberufsunfällen sowie Berufskrankheiten an den Versicherer, so rasch wie möglich',
   'https://www.fedlex.admin.ch/eli/cc/1982/1676_1676_1676/de',
   'UVG (SR 832.20) / VUV — so rasch wie möglich, keine gesetzliche Tagesfrist',
   'Colin Buzoianu', '2026-11-05', 'mirror', CURRENT_TIMESTAMP);
