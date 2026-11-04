-- P8 Gefahrstoffe tables (SLD_P8_GEFAHRSTOFFE_APPROVED.md §2). Person-free.
-- FKs Restrict, RLS on. SubstanceUse carries an exactly-one-subject CHECK
-- (pattern: Action_exactly_one_source_check). SubstanceStatement carries a
-- format CHECK per kind. TrainingRequirementType gains the §C.2 retention
-- override.

-- TrainingRequirementType override columns
ALTER TABLE "TrainingRequirementType"
  ADD COLUMN "retentionOverride" TEXT,
  ADD COLUMN "retentionOverrideTrigger" "RetentionTrigger";

-- Substance
CREATE TABLE "Substance" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tradeName" TEXT NOT NULL,
    "manufacturer" TEXT,
    "casNumber" TEXT,
    "ecNumber" TEXT,
    "physicalState" "PhysicalState" NOT NULL,
    "signalWord" "SubstanceSignalWord" NOT NULL DEFAULT 'NONE',
    "carcinogenicCategory" "CmrCategory" NOT NULL DEFAULT 'NONE',
    "mutagenicCategory" "CmrCategory" NOT NULL DEFAULT 'NONE',
    "reprotoxicCategory" "CmrCategory" NOT NULL DEFAULT 'NONE',
    "substitutionCheckDone" BOOLEAN NOT NULL DEFAULT false,
    "substitutionCheckNote" TEXT,
    "substitutionCheckedAt" TIMESTAMP(3),
    "excludedLowHazard" BOOLEAN NOT NULL DEFAULT false,
    "excludedLowHazardRationale" TEXT,
    "environmentalAspectId" TEXT,
    "wasteStreamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Substance_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Substance_companyId_idx" ON "Substance"("companyId");
ALTER TABLE "Substance" ADD CONSTRAINT "Substance_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Substance" ADD CONSTRAINT "Substance_environmentalAspectId_fkey" FOREIGN KEY ("environmentalAspectId") REFERENCES "EnvironmentalAspect"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Substance" ADD CONSTRAINT "Substance_wasteStreamId_fkey" FOREIGN KEY ("wasteStreamId") REFERENCES "WasteStream"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Substance" ENABLE ROW LEVEL SECURITY;

-- SubstancePictogram
CREATE TABLE "SubstancePictogram" (
    "id" TEXT NOT NULL,
    "substanceId" TEXT NOT NULL,
    "pictogram" "GhsPictogram" NOT NULL,
    CONSTRAINT "SubstancePictogram_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SubstancePictogram_substanceId_pictogram_key" ON "SubstancePictogram"("substanceId", "pictogram");
CREATE INDEX "SubstancePictogram_substanceId_idx" ON "SubstancePictogram"("substanceId");
ALTER TABLE "SubstancePictogram" ADD CONSTRAINT "SubstancePictogram_substanceId_fkey" FOREIGN KEY ("substanceId") REFERENCES "Substance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubstancePictogram" ENABLE ROW LEVEL SECURITY;

-- SubstanceStatement (format CHECK per kind)
CREATE TABLE "SubstanceStatement" (
    "id" TEXT NOT NULL,
    "substanceId" TEXT NOT NULL,
    "kind" "SubstanceStatementKind" NOT NULL,
    "code" TEXT NOT NULL,
    "text" TEXT,
    CONSTRAINT "SubstanceStatement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SubstanceStatement_substanceId_idx" ON "SubstanceStatement"("substanceId");
ALTER TABLE "SubstanceStatement" ADD CONSTRAINT "SubstanceStatement_substanceId_fkey" FOREIGN KEY ("substanceId") REFERENCES "Substance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubstanceStatement" ADD CONSTRAINT "SubstanceStatement_code_shape_check" CHECK (
  ("kind" = 'H' AND "code" ~ '^H[2-4][0-9]{2}[A-Za-z]{0,3}$')
  OR ("kind" = 'EUH' AND "code" ~ '^EUH[0-9]{3}[A-Za-z]?$')
  OR ("kind" = 'P' AND "code" ~ '^P[1-5][0-9]{2}(\+P[1-5][0-9]{2})*$')
);
ALTER TABLE "SubstanceStatement" ENABLE ROW LEVEL SECURITY;

-- SafetyDataSheet
CREATE TABLE "SafetyDataSheet" (
    "id" TEXT NOT NULL,
    "substanceId" TEXT NOT NULL,
    "version" TEXT,
    "revisionDate" TIMESTAMP(3) NOT NULL,
    "language" TEXT NOT NULL,
    "supplier" TEXT,
    "documentId" TEXT,
    "supersededAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SafetyDataSheet_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SafetyDataSheet_substanceId_idx" ON "SafetyDataSheet"("substanceId");
ALTER TABLE "SafetyDataSheet" ADD CONSTRAINT "SafetyDataSheet_substanceId_fkey" FOREIGN KEY ("substanceId") REFERENCES "Substance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SafetyDataSheet" ADD CONSTRAINT "SafetyDataSheet_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SafetyDataSheet" ENABLE ROW LEVEL SECURITY;

-- SubstanceUse (exactly one of workstation/process/orgUnit)
CREATE TABLE "SubstanceUse" (
    "id" TEXT NOT NULL,
    "substanceId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "workstationId" TEXT,
    "processId" TEXT,
    "orgUnitId" TEXT,
    "purpose" TEXT NOT NULL,
    "quantityClass" "SubstanceQuantityClass" NOT NULL,
    "storageLocation" TEXT,
    "exposureRoutes" "ExposureRoute"[] NOT NULL DEFAULT ARRAY[]::"ExposureRoute"[],
    "activeFrom" TIMESTAMP(3) NOT NULL,
    "activeTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubstanceUse_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SubstanceUse_substanceId_idx" ON "SubstanceUse"("substanceId");
CREATE INDEX "SubstanceUse_siteId_idx" ON "SubstanceUse"("siteId");
ALTER TABLE "SubstanceUse" ADD CONSTRAINT "SubstanceUse_substanceId_fkey" FOREIGN KEY ("substanceId") REFERENCES "Substance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubstanceUse" ADD CONSTRAINT "SubstanceUse_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubstanceUse" ADD CONSTRAINT "SubstanceUse_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "Workstation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubstanceUse" ADD CONSTRAINT "SubstanceUse_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubstanceUse" ADD CONSTRAINT "SubstanceUse_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubstanceUse" ADD CONSTRAINT "SubstanceUse_exactly_one_subject_check" CHECK (
  (("workstationId" IS NOT NULL)::int + ("processId" IS NOT NULL)::int + ("orgUnitId" IS NOT NULL)::int) = 1
);
ALTER TABLE "SubstanceUse" ENABLE ROW LEVEL SECURITY;

-- FindingSubstance
CREATE TABLE "FindingSubstance" (
    "id" TEXT NOT NULL,
    "riskFindingId" TEXT NOT NULL,
    "substanceId" TEXT NOT NULL,
    CONSTRAINT "FindingSubstance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FindingSubstance_riskFindingId_substanceId_key" ON "FindingSubstance"("riskFindingId", "substanceId");
CREATE INDEX "FindingSubstance_riskFindingId_idx" ON "FindingSubstance"("riskFindingId");
CREATE INDEX "FindingSubstance_substanceId_idx" ON "FindingSubstance"("substanceId");
ALTER TABLE "FindingSubstance" ADD CONSTRAINT "FindingSubstance_riskFindingId_fkey" FOREIGN KEY ("riskFindingId") REFERENCES "RiskFinding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FindingSubstance" ADD CONSTRAINT "FindingSubstance_substanceId_fkey" FOREIGN KEY ("substanceId") REFERENCES "Substance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FindingSubstance" ENABLE ROW LEVEL SECURITY;
