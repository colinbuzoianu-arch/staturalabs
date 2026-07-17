-- AlterEnum
-- Split into its own migration for the same reason as the ManualInputType
-- TOOL_USED addition: Postgres won't let a newly added enum value be
-- referenced (the seed INSERTs in the next migration reference these) in
-- the same transaction that adds it.
ALTER TYPE "BodyRegion" ADD VALUE 'ELBOW_LEFT';
ALTER TYPE "BodyRegion" ADD VALUE 'ELBOW_RIGHT';
