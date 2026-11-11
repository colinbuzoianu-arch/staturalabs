-- P14 G4: Fuhrpark / Fahrzeugstammdaten — a fleet master register. PERSON-FREE:
-- no driver on the vehicle record (a driver involved in an incident stays in the
-- incident compartment, §3.18). Company-scoped (a company can have one fleet
-- across sites); optional site + org unit placement. `type` is free text
-- (Gabelstapler, LKW, PKW, …) — the fleet taxonomy varies too widely for an enum.
--
-- P10's Fahrzeugereignis (Incident.type = FAHRZEUGEREIGNIS) gains an optional
-- vehicleId link, enabling fleet-level incident views and a vehicles-by-incident
-- report. Restrict: a vehicle in use by an incident can't be deleted out from
-- under it (ERGO §3.9).

CREATE TABLE "Vehicle" (
    "id"         TEXT NOT NULL,
    "companyId"  TEXT NOT NULL,
    "siteId"     TEXT,
    "orgUnitId"  TEXT,
    "identifier" TEXT NOT NULL,
    "type"       TEXT NOT NULL,
    "notes"      TEXT,
    "activeFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activeTo"   TIMESTAMP(3),
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Vehicle_companyId_idx" ON "Vehicle"("companyId");
CREATE INDEX "Vehicle_siteId_idx" ON "Vehicle"("siteId");
CREATE INDEX "Vehicle_orgUnitId_idx" ON "Vehicle"("orgUnitId");
-- One active identifier per company (a retired vehicle, activeTo set, may share
-- an identifier with a new one).
CREATE UNIQUE INDEX "Vehicle_company_identifier_active_unique"
  ON "Vehicle"("companyId", "identifier") WHERE "activeTo" IS NULL;

ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Vehicle" ENABLE ROW LEVEL SECURITY;
-- Company-scoped RLS (P13 §1): own company only.
CREATE POLICY app_rls ON "Vehicle" FOR ALL TO statura_app
  USING ("companyId" = ANY(app_company_ids()))
  WITH CHECK ("companyId" = ANY(app_company_ids()));

-- Link Fahrzeugereignisse to a vehicle (optional).
ALTER TABLE "Incident" ADD COLUMN "vehicleId" TEXT;
CREATE INDEX "Incident_vehicleId_idx" ON "Incident"("vehicleId");
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
