-- H1a of the hazards-and-environment plan
-- (SLD_IMPLEMENTATION_PLAN_hazards-and-environment.md §3.1): hazard-category
-- completeness. Enum-only migration first, per the standing gotcha — a
-- brand-new enum type can't be referenced (in a column, a CHECK, a seed
-- INSERT) in the same migration that creates it. No tables, no columns here;
-- the HazardCategoryCheck table and its backfill land in the next migration
-- (20261016120100_add_hazard_category_check).

-- CreateEnum
CREATE TYPE "CategoryCheckStatus" AS ENUM ('NOT_APPLICABLE', 'CHECKED_NO_HAZARD', 'HAZARD_PRESENT', 'OPEN');
