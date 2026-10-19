-- E4 (SLD_IMPLEMENTATION_PLAN_hazards-and-environment.md §6): two additive
-- columns for the Abfallwirtschaftskonzept (AWK) generator.
--   - Site.emasRegistered: a site with a valid EMAS environmental statement
--     is exempt from the separate AWK (§10 Abs. 1 AWG 2002). Default false —
--     a safe, correct default (not EMAS until marked), unlike the
--     semantically-required country/mode fields.
--   - EnvironmentalAssessment.futureDevelopment: free text for AWG §10
--     Abs. 3 Z5 ("estimate of future development").
-- No enum, no CHECK, no seed.

ALTER TABLE "Site" ADD COLUMN "emasRegistered" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "EnvironmentalAssessment" ADD COLUMN "futureDevelopment" TEXT;
