-- P8 Gefahrstoffe (SLD_P8_GEFAHRSTOFFE_APPROVED.md §2). Enums only (standing
-- gotcha). CLP values per Regulation (EC) No 1272/2008.
CREATE TYPE "PhysicalState" AS ENUM ('SOLID', 'LIQUID', 'GAS', 'POWDER', 'GRANULATE', 'PASTE', 'AEROSOL', 'OTHER');
CREATE TYPE "SubstanceSignalWord" AS ENUM ('GEFAHR', 'ACHTUNG', 'NONE');
CREATE TYPE "CmrCategory" AS ENUM ('CAT_1A', 'CAT_1B', 'CAT_2', 'NONE');
CREATE TYPE "GhsPictogram" AS ENUM ('GHS01', 'GHS02', 'GHS03', 'GHS04', 'GHS05', 'GHS06', 'GHS07', 'GHS08', 'GHS09');
CREATE TYPE "SubstanceStatementKind" AS ENUM ('H', 'P', 'EUH');
CREATE TYPE "SubstanceQuantityClass" AS ENUM ('XS', 'S', 'M', 'L', 'XL');
CREATE TYPE "ExposureRoute" AS ENUM ('INHALATION', 'DERMAL', 'ORAL', 'EYE');
