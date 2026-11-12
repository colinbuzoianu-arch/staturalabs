-- Tenant-level presentation defaults set by a super-admin. Both nullable,
-- no backfill: an unset tenant keeps today's behaviour (English fallback;
-- site country chosen per site). Neither drives legal content.
--
-- homeCountry reuses the existing "CountryCode" enum (added in
-- 20260817120000_add_country_code_enum), so no enum-first split is needed.
ALTER TABLE "Company" ADD COLUMN "defaultLocale" TEXT;
ALTER TABLE "Company" ADD COLUMN "homeCountry" "CountryCode";
