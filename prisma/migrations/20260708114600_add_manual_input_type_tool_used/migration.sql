-- AlterEnum
-- Split into its own migration: Postgres won't let a newly added enum value
-- be referenced (e.g. in the CHECK constraint added in the next migration)
-- within the same transaction that adds it.
ALTER TYPE "ManualInputType" ADD VALUE 'TOOL_USED';
