-- P10b: IncidentInvolvedPerson — the one place a Person attaches to an
-- incident (people→people FK, §3.18). RLS on. incidentId Cascade (composed
-- child of its case); personId Restrict (the "who was involved" record
-- survives a person's lifecycle; a Person is anonymised, never deleted, while
-- referenced). No health data here (P10c) and no assessment-chain FK.
CREATE TABLE "IncidentInvolvedPerson" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "role" "IncidentInvolvedRole" NOT NULL DEFAULT 'INJURED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IncidentInvolvedPerson_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "IncidentInvolvedPerson_incidentId_personId_key" ON "IncidentInvolvedPerson"("incidentId", "personId");
CREATE INDEX "IncidentInvolvedPerson_incidentId_idx" ON "IncidentInvolvedPerson"("incidentId");
CREATE INDEX "IncidentInvolvedPerson_personId_idx" ON "IncidentInvolvedPerson"("personId");
ALTER TABLE "IncidentInvolvedPerson" ADD CONSTRAINT "IncidentInvolvedPerson_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IncidentInvolvedPerson" ADD CONSTRAINT "IncidentInvolvedPerson_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IncidentInvolvedPerson" ENABLE ROW LEVEL SECURITY;
