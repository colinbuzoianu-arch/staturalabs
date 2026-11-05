-- P10d §D.4: StatutoryNotification — the persisted "submitted on / reference
-- number" fact for an incident's notification duty. RLS on. Composed child of
-- the incident (Cascade). The duty itself is resolved live from the catalogue.
CREATE TABLE "StatutoryNotification" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "status" "IncidentNotificationStatus" NOT NULL DEFAULT 'REQUIRED',
    "submittedAt" TIMESTAMP(3),
    "referenceNumber" TEXT,
    "submittedByUserId" UUID,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StatutoryNotification_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StatutoryNotification_incidentId_key" ON "StatutoryNotification"("incidentId");
ALTER TABLE "StatutoryNotification" ADD CONSTRAINT "StatutoryNotification_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StatutoryNotification" ENABLE ROW LEVEL SECURITY;
