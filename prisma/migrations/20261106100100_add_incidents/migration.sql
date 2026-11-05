-- P10a Ereignisse / incidents — the person-free case core, and the FIFTH
-- Action source. No person data and no health data here (P10b/P10c); no legal
-- deadline/retention value (P10d/P10e, founder-gated). RLS on every table.
-- FKs ON DELETE RESTRICT (§3.9) except an incident's own 1:1 investigation,
-- which is a composed child (Cascade with its parent incident).

-- CreateTable: Incident
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "type" "IncidentType" NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'REPORTED',
    "severity" "RiskBand",
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reportedByUserId" UUID,
    "subjectWorkstationId" TEXT,
    "subjectOrgUnitId" TEXT,
    "locationText" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isWorkRelated" BOOLEAN,
    "environmentalEventFlagged" BOOLEAN NOT NULL DEFAULT false,
    "assessmentReviewFlagged" BOOLEAN NOT NULL DEFAULT false,
    "closedAt" TIMESTAMP(3),
    "closedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Incident_siteId_status_idx" ON "Incident"("siteId", "status");
CREATE INDEX "Incident_companyId_idx" ON "Incident"("companyId");
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Incident" ENABLE ROW LEVEL SECURITY;

-- CreateTable: IncidentInvestigation (1:1, composed child)
CREATE TABLE "IncidentInvestigation" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "method" "IncidentInvestigationMethod" NOT NULL DEFAULT 'NARRATIVE',
    "sequenceOfEvents" TEXT,
    "directCauses" TEXT,
    "rootCauses" TEXT,
    "contributingFactors" TEXT,
    "investigatedByUserId" UUID,
    "investigatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IncidentInvestigation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "IncidentInvestigation_incidentId_key" ON "IncidentInvestigation"("incidentId");
ALTER TABLE "IncidentInvestigation" ADD CONSTRAINT "IncidentInvestigation_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IncidentInvestigation" ENABLE ROW LEVEL SECURITY;

-- Action: the FIFTH source. Add the column + FK, then widen the exactly-one-
-- source CHECK to one OF FIVE. Existing rows each already have exactly one of
-- the other four, so they continue to satisfy it.
ALTER TABLE "Action" ADD COLUMN "incidentId" TEXT;
ALTER TABLE "Action" ADD CONSTRAINT "Action_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Action" DROP CONSTRAINT "Action_exactly_one_source_check";
ALTER TABLE "Action" ADD CONSTRAINT "Action_exactly_one_source_check" CHECK (
  (
    (CASE WHEN "riskFindingId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "assessmentSessionId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "environmentalFindingId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "inspectionObservationId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "incidentId" IS NOT NULL THEN 1 ELSE 0 END)
  ) = 1
);
