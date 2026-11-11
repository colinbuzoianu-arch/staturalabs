-- P14 G1: granularity of a workforce-figures period. Enum-first (standing
-- gotcha: a new enum value can't be referenced in the same migration that adds
-- the type), so the table + its shape CHECK land in the next migration.
CREATE TYPE "WorkforcePeriodType" AS ENUM ('MONTH', 'QUARTER', 'YEAR');
