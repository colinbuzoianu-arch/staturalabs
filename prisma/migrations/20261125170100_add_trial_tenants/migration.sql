-- P18 A.1: trial tenants.
--
-- Company gains its kind plus the five trial-only fields. Everything that
-- exists today is a CUSTOMER except the founder's demo company, which is
-- matched BY NAME here — the same marker the demo seed/reset scripts use, and
-- the only reliable way to identify it (there is no other flag). If no row
-- matches, nothing is marked DEMO and the migration is still correct; the
-- founder can set the kind in /admin.
--
-- The trial fields live on Company rather than in a side table: they are
-- one-to-one with the tenant, read on every trial page (the band, the lock) and
-- always NULL for a customer, so a join would buy nothing. A hand-added CHECK
-- keeps them honest: only a TRIAL may carry an expiry or a conversion stamp.
--
-- Hand-added constructs to re-verify live after `migrate deploy`:
--   * Company_trial_fields_check (trial-only fields are NULL off TRIAL)
--   * the DEMO backfill matched exactly one company
--   * Company.tenantKind is NOT NULL with default CUSTOMER

ALTER TABLE "Company" ADD COLUMN "tenantKind" "TenantKind" NOT NULL DEFAULT 'CUSTOMER';
ALTER TABLE "Company" ADD COLUMN "trialExpiresAt" TIMESTAMP(3);
ALTER TABLE "Company" ADD COLUMN "trialContactEmail" TEXT;
ALTER TABLE "Company" ADD COLUMN "trialCreatedByUserId" UUID;
ALTER TABLE "Company" ADD COLUMN "trialConvertedAt" TIMESTAMP(3);
-- Founder-only free text (never shown to the tenant).
ALTER TABLE "Company" ADD COLUMN "trialNotes" TEXT;
-- A.4: the trial was locked at expiry; data is kept for the grace period.
ALTER TABLE "Company" ADD COLUMN "trialLockedAt" TIMESTAMP(3);
-- A.2: whether the trial started from the seeded demo data ("Mit Demo-Daten")
-- or empty — "Zurücksetzen" is only offered for the seeded kind.
ALTER TABLE "Company" ADD COLUMN "trialSeeded" BOOLEAN NOT NULL DEFAULT false;

-- The founder's demo tenant (the marker the seed scripts share).
UPDATE "Company" SET "tenantKind" = 'DEMO'
WHERE name = 'DEMO — Statura Referenzfertigung Österreich';

-- Trial-only fields must be empty on a non-trial. A converted trial becomes a
-- CUSTOMER and therefore gives up its expiry/lock, which is exactly the
-- intent: conversion removes the time limit rather than hiding it.
ALTER TABLE "Company" ADD CONSTRAINT "Company_trial_fields_check" CHECK (
  "tenantKind" = 'TRIAL'
  OR ("trialExpiresAt" IS NULL AND "trialLockedAt" IS NULL AND "trialConvertedAt" IS NULL)
);

CREATE INDEX "Company_tenantKind_idx" ON "Company"("tenantKind");
-- The daily lifecycle job scans by expiry.
CREATE INDEX "Company_trialExpiresAt_idx" ON "Company"("trialExpiresAt");
