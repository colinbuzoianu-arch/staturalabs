-- E1 of the hazards-and-environment plan
-- (SLD_IMPLEMENTATION_PLAN_hazards-and-environment.md §5), option (b):
-- environment as a SEPARATE domain. Enum-only migration first, per the
-- standing gotcha — a brand-new enum type can't be referenced (in a column,
-- a CHECK, a seed INSERT) in the same migration that creates it. The tables,
-- the Action columns, the updated source CHECK and the catalogue seed land
-- in the next migration (20261019120100_add_environment_tables).

-- CreateEnum
CREATE TYPE "EnvironmentalAspectCategory" AS ENUM ('AIR_EMISSIONS', 'ENERGY_USE', 'WATER_USE', 'WASTEWATER', 'WASTE_NON_HAZARDOUS', 'WASTE_HAZARDOUS', 'RAW_MATERIALS', 'HAZARDOUS_SUBSTANCES', 'SOIL_GROUNDWATER', 'NOISE_NEIGHBOURHOOD', 'ODOUR', 'LIGHT_EMISSIONS', 'TRANSPORT_LOGISTICS', 'BIODIVERSITY_LAND_USE');

-- CreateEnum
CREATE TYPE "OperatingCondition" AS ENUM ('NORMAL', 'ABNORMAL', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "EnvironmentalMeasureType" AS ENUM ('AVOID', 'REDUCE', 'REUSE', 'RECYCLE', 'RECOVER', 'DISPOSE_SAFELY', 'SUBSTITUTE', 'TECHNICAL', 'ORGANISATIONAL', 'MONITORING');
