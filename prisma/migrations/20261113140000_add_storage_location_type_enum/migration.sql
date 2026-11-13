-- P15 S5a: StorageLocationType enum (own migration first, per the standing gotcha
-- that a brand-new enum value can't be referenced in the same migration that adds
-- it — the next migration's backfill INSERT references 'OTHER').
CREATE TYPE "StorageLocationType" AS ENUM ('ROOM', 'CABINET', 'OUTDOOR_AREA', 'TANK', 'OTHER');
