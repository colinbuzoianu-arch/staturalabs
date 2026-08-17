-- B1b of the Austria-first plan (SLD_IMPLEMENTATION_PLAN_austria-first.md
-- §4.3, §7 B1). Site.country: which jurisdiction's legal limits/references
-- apply to this site's data. Deliberately NOT on Company (a company can
-- have sites in more than one country). Added nullable first, backfilled
-- explicitly below, then locked to NOT NULL with no column default — same
-- discipline as AssessmentSession.mode
-- (20260716063952_add_assessment_session_mode): "which country" must
-- always be a real, explicit per-row decision, never something that can
-- ride in silently on a DEFAULT clause (ERGO_COMPLIANCE_BY_DESIGN.md
-- §3.15 — no limit/reference is ever shown without a real country behind
-- it).
-- AlterTable
ALTER TABLE "Site" ADD COLUMN "country" "CountryCode";

-- Explicit backfill, by company, not a blanket default:
-- - "Dev Fixture Co" (scripts/seed-dev-fixture.mjs) -> RO, per the plan.
-- - The demo company (scripts/demo-fixture-constants.mjs
--   DEMO_COMPANY_NAME) -> AT, per the plan — this is also the company the
--   Austria-first build targets going forward.
UPDATE "Site" s
SET "country" = 'RO'
FROM "Company" c
WHERE s."companyId" = c.id AND c.name = 'Dev Fixture Co';

UPDATE "Site" s
SET "country" = 'AT'
FROM "Company" c
WHERE s."companyId" = c.id AND c.name = 'DEMO — Statura Reference Manufacturing';

-- Any site belonging to neither fixture (ad hoc test companies created by
-- hand outside the two seed scripts) is not covered by the plan's explicit
-- backfill instruction. Rather than leave it NULL (which would fail the
-- NOT NULL below) or silently guess a jurisdiction, it is backfilled to RO
-- here as a visible, correctable placeholder — RO because that's this
-- deployment's own home jurisdiction and the same choice already made for
-- the dev fixture. Anyone relying on one of these rows for real
-- country-scoped output should confirm/correct it by hand; this is not
-- customer data.
UPDATE "Site"
SET "country" = 'RO'
WHERE "country" IS NULL;

-- Now that every existing row has a value, lock the column down. No
-- DEFAULT is set for future inserts: every future Site.create must pass
-- country explicitly, same reasoning as the backfill comment above.
ALTER TABLE "Site" ALTER COLUMN "country" SET NOT NULL;
