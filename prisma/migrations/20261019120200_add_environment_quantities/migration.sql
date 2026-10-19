-- E2 (SLD_IMPLEMENTATION_PLAN_hazards-and-environment.md §5.3): quantities
-- and waste streams. Purely additive — two new tables, no enum, no CHECK.
-- No seed (these are tenant data, not a catalogue). wasteCode and
-- collectorCompany are free-text, no legal values baked in (§3.17).

-- CreateTable: EnvironmentalQuantity
CREATE TABLE "EnvironmentalQuantity" (
    "id" TEXT NOT NULL,
    "environmentalFindingId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "isEstimate" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnvironmentalQuantity_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EnvironmentalQuantity_environmentalFindingId_idx" ON "EnvironmentalQuantity"("environmentalFindingId");
ALTER TABLE "EnvironmentalQuantity" ADD CONSTRAINT "EnvironmentalQuantity_environmentalFindingId_fkey" FOREIGN KEY ("environmentalFindingId") REFERENCES "EnvironmentalFinding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EnvironmentalQuantity" ENABLE ROW LEVEL SECURITY;

-- CreateTable: WasteStream
CREATE TABLE "WasteStream" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "wasteCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hazardous" BOOLEAN NOT NULL DEFAULT false,
    "originWorkstationId" TEXT,
    "originProcessId" TEXT,
    "environmentalFindingId" TEXT,
    "annualQuantity" DOUBLE PRECISION,
    "unit" TEXT,
    "collectorCompany" TEXT,
    "treatment" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WasteStream_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WasteStream_siteId_idx" ON "WasteStream"("siteId");
CREATE INDEX "WasteStream_environmentalFindingId_idx" ON "WasteStream"("environmentalFindingId");
ALTER TABLE "WasteStream" ADD CONSTRAINT "WasteStream_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WasteStream" ADD CONSTRAINT "WasteStream_originWorkstationId_fkey" FOREIGN KEY ("originWorkstationId") REFERENCES "Workstation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WasteStream" ADD CONSTRAINT "WasteStream_originProcessId_fkey" FOREIGN KEY ("originProcessId") REFERENCES "Process"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WasteStream" ADD CONSTRAINT "WasteStream_environmentalFindingId_fkey" FOREIGN KEY ("environmentalFindingId") REFERENCES "EnvironmentalFinding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WasteStream" ENABLE ROW LEVEL SECURITY;
