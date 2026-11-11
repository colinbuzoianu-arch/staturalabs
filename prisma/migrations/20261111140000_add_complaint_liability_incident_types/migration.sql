-- P14 G5: two more event types the DACH functional list carries — Beschwerde
-- (complaint) and Haftungsfall (liability). Enum-first (the light field set that
-- goes with them lands in the next migration). Person-safe; no new compartment.
ALTER TYPE "IncidentType" ADD VALUE 'BESCHWERDE';
ALTER TYPE "IncidentType" ADD VALUE 'HAFTUNGSFALL';
