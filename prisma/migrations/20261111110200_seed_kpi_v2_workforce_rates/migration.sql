-- P14 G1: new KPI-set version v2-2026. Copies v1-2026 forward verbatim, then
-- adds the three founder-confirmed workforce-rate definitions (the two core
-- accident rates already exist in v1 and are carried forward unchanged). KPI
-- definitions are versioned config (display metadata); the COMPUTATION for each
-- key lives in src/lib/analytics/kpi.ts. Labels here are German fallbacks; the
-- UI localises via the kpiLabels i18n map keyed by `key`.
--
-- The three new keys:
--   severity-rate        Ausfalltage je Unfall            (lost days ÷ accidents)
--   lost-day-rate-1000   Ausfallrate je 1.000 Beschäftigte (lost days × 1000 ÷ headcount)
--   near-miss-rate-1000  Beinaheunfall-Quote je 1.000 MA  (near misses × 1000 ÷ headcount)
-- The first two are person-derived (read lost-day data) → §3.4 min-group gate.

INSERT INTO "KpiCatalogVersion" ("version", "label", "isActive", "activatedAt")
VALUES ('v2-2026', 'KPI-Set v2 (2026)', false, CURRENT_TIMESTAMP);

-- Carry v1 forward verbatim (new ids, new catalogVersion).
INSERT INTO "KpiDefinition"
  ("id", "catalogVersion", "key", "label", "unit", "domain",
   "personDerived", "higherIsBetter", "periodScoped", "order", "country", "createdAt")
SELECT gen_random_uuid()::text, 'v2-2026', "key", "label", "unit", "domain",
       "personDerived", "higherIsBetter", "periodScoped", "order", "country", CURRENT_TIMESTAMP
FROM "KpiDefinition"
WHERE "catalogVersion" = 'v1-2026';

-- The three new workforce-rate definitions.
INSERT INTO "KpiDefinition"
  ("id", "catalogVersion", "key", "label", "unit", "domain",
   "personDerived", "higherIsBetter", "periodScoped", "order")
VALUES
  (gen_random_uuid()::text, 'v2-2026', 'severity-rate',       'Ausfalltage je Unfall',             'Tage/Unfall', 'OSH', true,  false, true, 45),
  (gen_random_uuid()::text, 'v2-2026', 'lost-day-rate-1000',  'Ausfallrate je 1.000 Beschäftigte', 'je 1.000 MA', 'OSH', true,  false, true, 46),
  (gen_random_uuid()::text, 'v2-2026', 'near-miss-rate-1000', 'Beinaheunfall-Quote je 1.000 Beschäftigte', 'je 1.000 MA', 'OSH', false, true, true, 55);

-- Activate v2 (single-active partial unique index: clear v1 first).
UPDATE "KpiCatalogVersion" SET "isActive" = false WHERE "version" = 'v1-2026';
UPDATE "KpiCatalogVersion" SET "isActive" = true  WHERE "version" = 'v2-2026';
