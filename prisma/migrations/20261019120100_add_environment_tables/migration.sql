-- E1 (SLD_IMPLEMENTATION_PLAN_hazards-and-environment.md §5.2), option (b):
-- the environment-domain tables (EnvironmentalAspect, EnvironmentalAssessment,
-- EnvironmentalFinding, EnvironmentalCategoryCheck), the two new Action
-- columns (environmentalFindingId, environmentalMeasureType), the updated
-- exactly-one-source CHECK, RLS on every new table, and the seeded system
-- aspect catalogue.
--
-- Hand-added constructs re-verify against the live DB after migrate deploy
-- (CLAUDE.md gotcha):
--   1. CHECK "EnvironmentalCategoryCheck_rationale_check" — copy of
--      HazardCategoryCheck_rationale_check.
--   2. CHECK "Action_exactly_one_source_check" — dropped and re-added as an
--      exactly-one-OF-THREE check (riskFinding / assessmentSession /
--      environmentalFinding). Existing Action rows each have exactly one of
--      the first two, so they still satisfy it.

-- CreateTable: EnvironmentalAspect (mirrors Hazard)
CREATE TABLE "EnvironmentalAspect" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "category" "EnvironmentalAspectCategory" NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnvironmentalAspect_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EnvironmentalAspect_companyId_category_idx" ON "EnvironmentalAspect"("companyId", "category");
ALTER TABLE "EnvironmentalAspect" ADD CONSTRAINT "EnvironmentalAspect_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EnvironmentalAspect" ENABLE ROW LEVEL SECURITY;

-- CreateTable: EnvironmentalAssessment
CREATE TABLE "EnvironmentalAssessment" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "workstationId" TEXT,
    "matrixVersion" TEXT NOT NULL,
    "status" "RiskAssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "assessorUserId" UUID NOT NULL,
    "approvedByUserId" UUID,
    "assessedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "pilotContext" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnvironmentalAssessment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EnvironmentalAssessment_siteId_idx" ON "EnvironmentalAssessment"("siteId");
CREATE INDEX "EnvironmentalAssessment_workstationId_idx" ON "EnvironmentalAssessment"("workstationId");
ALTER TABLE "EnvironmentalAssessment" ADD CONSTRAINT "EnvironmentalAssessment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EnvironmentalAssessment" ADD CONSTRAINT "EnvironmentalAssessment_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "Workstation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EnvironmentalAssessment" ADD CONSTRAINT "EnvironmentalAssessment_matrixVersion_fkey" FOREIGN KEY ("matrixVersion") REFERENCES "RiskMatrixVersion"("version") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EnvironmentalAssessment" ENABLE ROW LEVEL SECURITY;

-- CreateTable: EnvironmentalFinding
CREATE TABLE "EnvironmentalFinding" (
    "id" TEXT NOT NULL,
    "environmentalAssessmentId" TEXT NOT NULL,
    "environmentalAspectId" TEXT NOT NULL,
    "probability" INTEGER NOT NULL,
    "severity" INTEGER NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "riskBand" "RiskBand" NOT NULL,
    "operatingCondition" "OperatingCondition" NOT NULL,
    "legallyRelevant" BOOLEAN NOT NULL DEFAULT false,
    "significant" BOOLEAN NOT NULL,
    "existingControls" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnvironmentalFinding_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EnvironmentalFinding_environmentalAssessmentId_idx" ON "EnvironmentalFinding"("environmentalAssessmentId");
ALTER TABLE "EnvironmentalFinding" ADD CONSTRAINT "EnvironmentalFinding_environmentalAssessmentId_fkey" FOREIGN KEY ("environmentalAssessmentId") REFERENCES "EnvironmentalAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EnvironmentalFinding" ADD CONSTRAINT "EnvironmentalFinding_environmentalAspectId_fkey" FOREIGN KEY ("environmentalAspectId") REFERENCES "EnvironmentalAspect"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EnvironmentalFinding" ENABLE ROW LEVEL SECURITY;

-- CreateTable: EnvironmentalCategoryCheck (copy of HazardCategoryCheck)
CREATE TABLE "EnvironmentalCategoryCheck" (
    "id" TEXT NOT NULL,
    "environmentalAssessmentId" TEXT NOT NULL,
    "category" "EnvironmentalAspectCategory" NOT NULL,
    "status" "CategoryCheckStatus" NOT NULL,
    "rationale" TEXT,
    "checkedByUserId" UUID,
    "checkedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnvironmentalCategoryCheck_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EnvironmentalCategoryCheck_environmentalAssessmentId_category_key" ON "EnvironmentalCategoryCheck"("environmentalAssessmentId", "category");
CREATE INDEX "EnvironmentalCategoryCheck_environmentalAssessmentId_idx" ON "EnvironmentalCategoryCheck"("environmentalAssessmentId");
ALTER TABLE "EnvironmentalCategoryCheck" ADD CONSTRAINT "EnvironmentalCategoryCheck_environmentalAssessmentId_fkey" FOREIGN KEY ("environmentalAssessmentId") REFERENCES "EnvironmentalAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Copy of HazardCategoryCheck_rationale_check.
ALTER TABLE "EnvironmentalCategoryCheck" ADD CONSTRAINT "EnvironmentalCategoryCheck_rationale_check" CHECK (
  "status" NOT IN ('NOT_APPLICABLE', 'CHECKED_NO_HAZARD') OR "rationale" IS NOT NULL
);
ALTER TABLE "EnvironmentalCategoryCheck" ENABLE ROW LEVEL SECURITY;

-- AlterTable: Action gains the environmental source + measure type.
ALTER TABLE "Action" ADD COLUMN "environmentalFindingId" TEXT;
ALTER TABLE "Action" ADD COLUMN "environmentalMeasureType" "EnvironmentalMeasureType";
ALTER TABLE "Action" ADD CONSTRAINT "Action_environmentalFindingId_fkey" FOREIGN KEY ("environmentalFindingId") REFERENCES "EnvironmentalFinding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Update the exactly-one-source CHECK to exactly one OF THREE. Drop the old
-- two-way check first, then add the three-way one. Existing rows satisfy it
-- (each has exactly one of riskFindingId / assessmentSessionId).
ALTER TABLE "Action" DROP CONSTRAINT "Action_exactly_one_source_check";
ALTER TABLE "Action" ADD CONSTRAINT "Action_exactly_one_source_check" CHECK (
  (
    (CASE WHEN "riskFindingId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "assessmentSessionId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "environmentalFindingId" IS NOT NULL THEN 1 ELSE 0 END)
  ) = 1
);

-- Seed: system environmental aspect catalogue (companyId = NULL, isSystem =
-- true), a few credible rows per EnvironmentalAspectCategory. Names written
-- fresh for SLD, NO legal numbers or statutory references in descriptions
-- (§3.17/§5.2 — legal content is country-scoped and RIS-verified elsewhere,
-- never baked into a catalogue name). Companies add their own via companyId.
INSERT INTO "EnvironmentalAspect" ("id", "companyId", "category", "code", "name", "description", "isSystem", "updatedAt") VALUES
  (gen_random_uuid()::text, NULL, 'AIR_EMISSIONS', 'AIR-01', 'Dust and particulate emissions to air', 'Particulate released to the outside air from processing, extraction or handling.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'AIR_EMISSIONS', 'AIR-02', 'Solvent / VOC emissions', 'Volatile organic compounds released from coating, printing or cleaning.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'AIR_EMISSIONS', 'AIR-03', 'Combustion flue gases', 'Exhaust gases from boilers, furnaces or on-site combustion.', true, CURRENT_TIMESTAMP),

  (gen_random_uuid()::text, NULL, 'ENERGY_USE', 'ENER-01', 'Electricity consumption', 'Grid electricity drawn by the site and its processes.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'ENERGY_USE', 'ENER-02', 'Thermal energy / fuel use', 'Natural gas, oil or other fuel burned for heat or process energy.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'ENERGY_USE', 'ENER-03', 'Compressed-air generation and leakage', 'Energy used to generate compressed air, including losses from leaks.', true, CURRENT_TIMESTAMP),

  (gen_random_uuid()::text, NULL, 'WATER_USE', 'WATER-01', 'Process water consumption', 'Water drawn for production processes.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'WATER_USE', 'WATER-02', 'Cooling water use', 'Water used for cooling, once-through or recirculated.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'WATER_USE', 'WATER-03', 'Sanitary / domestic water use', 'Water used for washrooms, canteens and general facilities.', true, CURRENT_TIMESTAMP),

  (gen_random_uuid()::text, NULL, 'WASTEWATER', 'WW-01', 'Process wastewater discharge', 'Wastewater from production discharged to sewer or receiving water.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'WASTEWATER', 'WW-02', 'Contaminated surface runoff', 'Rainwater runoff from yards or roofs that may carry contaminants.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'WASTEWATER', 'WW-03', 'Oil / grease separator discharge', 'Discharge passing through an oil or grease separator before release.', true, CURRENT_TIMESTAMP),

  (gen_random_uuid()::text, NULL, 'WASTE_NON_HAZARDOUS', 'WASTE-01', 'Mixed commercial waste', 'General non-hazardous operating waste sent for disposal or recovery.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'WASTE_NON_HAZARDOUS', 'WASTE-02', 'Packaging waste (paper, cardboard, plastic)', 'Packaging materials collected for recycling or disposal.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'WASTE_NON_HAZARDOUS', 'WASTE-03', 'Metal / production offcuts', 'Metal scrap and offcuts from production, typically recovered.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'WASTE_NON_HAZARDOUS', 'WASTE-04', 'Wood waste', 'Offcuts, pallets and other wood waste.', true, CURRENT_TIMESTAMP),

  (gen_random_uuid()::text, NULL, 'WASTE_HAZARDOUS', 'HWASTE-01', 'Waste oils and emulsions', 'Spent oils, coolants and oil-water emulsions.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'WASTE_HAZARDOUS', 'HWASTE-02', 'Solvent and paint residues', 'Spent solvents, paint sludge and contaminated cleaning agents.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'WASTE_HAZARDOUS', 'HWASTE-03', 'Contaminated absorbents and rags', 'Absorbents, filters and rags contaminated with hazardous substances.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'WASTE_HAZARDOUS', 'HWASTE-04', 'Waste batteries and electronic scrap', 'Spent batteries, accumulators and WEEE.', true, CURRENT_TIMESTAMP),

  (gen_random_uuid()::text, NULL, 'RAW_MATERIALS', 'RAW-01', 'Primary raw-material consumption', 'Input materials consumed by production.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'RAW_MATERIALS', 'RAW-02', 'Packaging-material input', 'Packaging purchased and used for products.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'RAW_MATERIALS', 'RAW-03', 'Auxiliary and operating materials', 'Adhesives, lubricants, cleaning agents and other consumables.', true, CURRENT_TIMESTAMP),

  (gen_random_uuid()::text, NULL, 'HAZARDOUS_SUBSTANCES', 'HSUB-01', 'Storage of water-hazardous substances', 'Storage of substances hazardous to water, with spill/leak potential.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'HAZARDOUS_SUBSTANCES', 'HSUB-02', 'Handling and transfer of chemicals', 'Decanting, dosing or transferring hazardous substances.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'HAZARDOUS_SUBSTANCES', 'HSUB-03', 'Above/below-ground tanks', 'Tanks and vessels holding hazardous liquids.', true, CURRENT_TIMESTAMP),

  (gen_random_uuid()::text, NULL, 'SOIL_GROUNDWATER', 'SOIL-01', 'Leakage to soil from storage/handling', 'Loss of liquids to ground from storage, handling or filling points.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'SOIL_GROUNDWATER', 'SOIL-02', 'Historical / suspected contamination', 'Known or suspected legacy contamination of soil or groundwater.', true, CURRENT_TIMESTAMP),

  (gen_random_uuid()::text, NULL, 'NOISE_NEIGHBOURHOOD', 'NNOISE-01', 'Plant noise to the neighbourhood', 'Noise emitted beyond the site boundary from fixed plant.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'NOISE_NEIGHBOURHOOD', 'NNOISE-02', 'Traffic and loading noise', 'Noise from on-site vehicle movements, loading and unloading.', true, CURRENT_TIMESTAMP),

  (gen_random_uuid()::text, NULL, 'ODOUR', 'ODOUR-01', 'Process odour emissions', 'Odour released from processes perceptible beyond the site boundary.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'ODOUR', 'ODOUR-02', 'Waste-storage odour', 'Odour from stored waste or organic residues.', true, CURRENT_TIMESTAMP),

  (gen_random_uuid()::text, NULL, 'LIGHT_EMISSIONS', 'LIGHTEM-01', 'External lighting spill', 'Outdoor or facade lighting affecting the surroundings.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'LIGHT_EMISSIONS', 'LIGHTEM-02', 'Signage and advertising illumination', 'Illuminated signage emitting light to the neighbourhood.', true, CURRENT_TIMESTAMP),

  (gen_random_uuid()::text, NULL, 'TRANSPORT_LOGISTICS', 'TRANS-01', 'Inbound/outbound goods transport', 'Environmental load from transporting materials and products.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'TRANSPORT_LOGISTICS', 'TRANS-02', 'On-site vehicle and forklift operation', 'Fuel use and emissions from on-site mobile equipment.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'TRANSPORT_LOGISTICS', 'TRANS-03', 'Employee commuting and business travel', 'Transport associated with staff commuting and travel.', true, CURRENT_TIMESTAMP),

  (gen_random_uuid()::text, NULL, 'BIODIVERSITY_LAND_USE', 'BIODIV-01', 'Site sealing / impervious surfaces', 'Sealed ground reducing infiltration and habitat.', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'BIODIVERSITY_LAND_USE', 'BIODIV-02', 'Green-space and habitat management', 'Management of on-site green areas and habitats.', true, CURRENT_TIMESTAMP);
