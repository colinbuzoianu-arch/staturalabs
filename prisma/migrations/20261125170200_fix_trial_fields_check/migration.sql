-- P18 A.1 correction, caught by the slice-1 live probes before any trial
-- existed: the first version of Company_trial_fields_check forbade EVERY
-- trial-only field off a TRIAL, including trialConvertedAt — which made the
-- A.4 "In Kunde umwandeln" action impossible, because conversion sets
-- tenantKind = CUSTOMER and KEEPS the conversion stamp as the record that this
-- customer came from a trial.
--
-- The rule that was actually meant: a non-trial may carry its history
-- (trialConvertedAt, trialContactEmail, trialNotes) but never a LIVE time
-- limit — no expiry, no lock. That is what conversion means: the limit is
-- removed, the provenance is kept.

ALTER TABLE "Company" DROP CONSTRAINT "Company_trial_fields_check";

ALTER TABLE "Company" ADD CONSTRAINT "Company_trial_fields_check" CHECK (
  "tenantKind" = 'TRIAL'
  OR ("trialExpiresAt" IS NULL AND "trialLockedAt" IS NULL)
);

-- A conversion stamp only makes sense once there was something to convert, so
-- it may not appear on a tenant that was never a trial and has no contact.
ALTER TABLE "Company" ADD CONSTRAINT "Company_trial_converted_shape_check" CHECK (
  "trialConvertedAt" IS NULL OR "trialContactEmail" IS NOT NULL
);
