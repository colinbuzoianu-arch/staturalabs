-- P14 G5: the light field set for complaints/liability, as nullable free-text
-- columns on Incident (no new table, no new compartment — person-safe). A
-- complaint's source is a channel/role (e.g. "Kunde", "Behörde", "anonym"),
-- never a named person; liability's claim basis is the legal/contractual ground.
ALTER TABLE "Incident" ADD COLUMN "complaintSource"     TEXT;
ALTER TABLE "Incident" ADD COLUMN "complaintSubject"    TEXT;
ALTER TABLE "Incident" ADD COLUMN "liabilityClaimBasis" TEXT;
