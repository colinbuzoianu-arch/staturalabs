-- Seeds v1-at-2026, the first ExposureLimitCatalogVersion
-- (SLD_IMPLEMENTATION_PLAN_austria-first.md §4.5, §7 B4). Activated
-- directly in this same migration (isActive = true at insert) — unlike
-- the B3 methodology-version bump, there is no pre-existing active
-- catalog to displace and no historical data whose re-scoring parity
-- needs proving first, so the two-step "seed inactive, verify, activate
-- separately" dance B3 needed doesn't apply here.
--
-- === VERIFICATION BAR (per §4.5 of the plan) ===
-- "Do not let CC seed a legal value from its own recollection" — every
-- numeric value below was checked against a real source during this
-- session, not recalled from training data:
--   - RIS (ris.bka.gv.at) itself could not be fetched directly during
--     this session (the relevant pages — GeltendeFassung.wxe and
--     NormDokument.wxe for Gesetzesnummer 20004576, VOLV — returned
--     HTTP 503 on every attempt, likely bot protection).
--   - As a substitute, wko.at (Wirtschaftskammer Österreich — the
--     statutory Austrian Chamber of Commerce, an authoritative body for
--     employer OSH-compliance guidance, not a random blog) was fetched
--     directly and independently confirmed all four NOISE/VIBRATION
--     numbers below, including the two vibration Auslösewert figures the
--     plan itself had flagged "*verify*" and left uncleared (2,5 m/s²
--     HAV / 0,5 m/s² WBV) — these matched the plan's own tentative
--     EU-directive-sourced figures exactly.
--   - This is AI-assisted secondary-source verification, not the human
--     RIS check the plan asks for. Treat every NOISE/VIBRATION value
--     below as "corroborated, pending a final human confirmation
--     directly against RIS" before any customer-facing legal/compliance
--     claim is made from it — not yet the closed loop the plan's
--     verification bar describes.
--   - LIGHTING, CLIMATE_THERMAL, and CHEMICAL are seeded reference-only
--     (both actionValue and limitValue NULL), on the same principle the
--     plan itself uses for ERGONOMIC_MSD: these categories have no
--     single legal number (illuminance is task-specific per ÖNORM EN
--     12464-1, MAK/TRK chemical limits are one row per substance under
--     the Grenzwerteverordnung) — modeling a single seeded figure for
--     any of them would itself be exactly the "seeded from recollection"
--     failure mode this bar exists to prevent, structural mismatch aside
--     from the verification concern.
INSERT INTO "ExposureLimitCatalogVersion" ("version", "label", "isActive", "activatedAt")
VALUES ('v1-at-2026', 'Austria — AT exposure limits, 2026', true, CURRENT_TIMESTAMP);

INSERT INTO "ExposureLimit" (
  "id", "catalogVersion", "country", "hazardCategory", "parameterKey", "parameterLabel",
  "unit", "actionValue", "limitValue", "legalReference", "legalReferenceUrl", "notes"
) VALUES
  -- NOISE — VOLV §4 (Auslösewert) / §3 (Expositionsgrenzwert), BGBl. II
  -- Nr. 22/2006. Confirmed via wko.at (see verification bar above): this
  -- is the number the Austria-first plan's whole "five-second
  -- credibility proof" rests on — 85 dB, not the EU directive's
  -- PPE-adjusted 87 dB the original demo fixture used.
  (gen_random_uuid()::text, 'v1-at-2026', 'AT', 'NOISE', 'LA_EX_8H',
   'Lärmexposition, LA,EX,8h (8-Stunden-Beurteilungspegel)', 'dB(A)', 80, 85,
   'VOLV §4 (Auslösewert) / §3 (Expositionsgrenzwert), BGBl. II Nr. 22/2006',
   'https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=20004576',
   'Auslösewert excludes any PPE/hearing-protection attenuation — VOLV explicitly assesses this tier before protective equipment is accounted for.'),
  (gen_random_uuid()::text, 'v1-at-2026', 'AT', 'NOISE', 'LC_PEAK',
   'Lärmspitzenpegel, LC,peak', 'dB(C)', 135, 137,
   'VOLV §4 (Auslösewert) / §3 (Expositionsgrenzwert), BGBl. II Nr. 22/2006',
   'https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=20004576',
   NULL),

  -- VIBRATION — same VOLV sections. The Auslösewert figures here are the
  -- ones the plan itself marked "*verify*"; corroborated via wko.at this
  -- session (see verification bar above), not yet a direct RIS check.
  (gen_random_uuid()::text, 'v1-at-2026', 'AT', 'VIBRATION', 'AHW_8H',
   'Hand-Arm-Vibration, ahw,8h', 'm/s²', 2.5, 5,
   'VOLV §4 (Auslösewert) / §3 (Expositionsgrenzwert), BGBl. II Nr. 22/2006',
   'https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=20004576',
   NULL),
  (gen_random_uuid()::text, 'v1-at-2026', 'AT', 'VIBRATION', 'AW_8H',
   'Ganzkörper-Vibration, aw,8h', 'm/s²', 0.5, 1.15,
   'VOLV §4 (Auslösewert) / §3 (Expositionsgrenzwert), BGBl. II Nr. 22/2006',
   'https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=20004576',
   NULL),

  -- LIGHTING, CLIMATE_THERMAL, CHEMICAL — reference-only, no single
  -- legal number exists for any of these (see verification bar above).
  (gen_random_uuid()::text, 'v1-at-2026', 'AT', 'LIGHTING', 'ILLUMINANCE_TASK_AREA',
   'Beleuchtungsstärke Arbeitsbereich (tätigkeitsabhängig)', 'lx', NULL, NULL,
   'AStV; ÖNORM EN 12464-1', NULL,
   'Illuminance requirements are per-activity (ÖNORM EN 12464-1 tabulates a separate lux value per task type) — not a single AT-wide number. Record the applicable per-task value directly on the measurement.'),
  (gen_random_uuid()::text, 'v1-at-2026', 'AT', 'CLIMATE_THERMAL', 'THERMAL_COMFORT',
   'Thermischer Komfort / Wärmebelastung', '°C', NULL, NULL,
   'AStV; ÖNORM EN ISO 7730', NULL,
   'Thermal comfort is assessed via ÖNORM EN ISO 7730''s PMV/PPD method, not a single degree threshold — reference only.'),
  (gen_random_uuid()::text, 'v1-at-2026', 'AT', 'CHEMICAL', 'MAK_TRK',
   'Grenzwerte gefährlicher Arbeitsstoffe (MAK/TRK)', 'n/a', NULL, NULL,
   '§45 ASchG; Grenzwerteverordnung (GKV)', NULL,
   'MAK/TRK values are one row per substance under the GKV (hundreds of entries) — not modeled as a single figure here. Reference only.'),

  -- ERGONOMIC_MSD — exactly the plan's own example of the "both
  -- thresholds null, reference present" state: §64 ASchG requires manual
  -- load handling to be evaluated but Austria has no
  -- Lastenhandhabungsverordnung (§2(c) of the plan) — an obligation with
  -- no mandated numeric method, which is what B8's manual-handling
  -- sub-score exists to fill.
  (gen_random_uuid()::text, 'v1-at-2026', 'AT', 'ERGONOMIC_MSD', 'MANUAL_HANDLING',
   'Manuelle Lastenhandhabung (Bewertung ohne gesetzlichen Zahlenwert)', 'n/a', NULL, NULL,
   '§64 ASchG; ÖNORM EN 1005-2, EN ISO 11228-1', NULL,
   'No numeric legal limit exists in Austria (no Lastenhandhabungsverordnung) — the obligation to evaluate is real, the method is not government-mandated. See methodology v2''s manual-handling sub-score (SLD_IMPLEMENTATION_PLAN_austria-first.md B8).');
