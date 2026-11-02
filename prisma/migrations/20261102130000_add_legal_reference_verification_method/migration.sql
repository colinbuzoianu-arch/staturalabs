-- P3 (SLD_P3_LEGAL_CATALOGUE_APPROVED.md §4.1): the per-row verification
-- method the founder-approved delegated-verification process requires
-- (official / mirror / seed-check). NOT NULL with no default — the
-- LegalReference table is still empty (nothing seeded before this), so there
-- are no rows to backfill; the seed migration that follows supplies the value
-- on every row.
ALTER TABLE "LegalReference" ADD COLUMN "verificationMethod" TEXT NOT NULL;
