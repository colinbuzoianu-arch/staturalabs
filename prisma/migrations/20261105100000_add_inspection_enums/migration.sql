-- P9 Begehungen & Audits (SLD_RESTRUCTURE_PLAN_platform-modules.md §7.3).
-- Enums only (standing gotcha: new enum types created separately from the
-- migration that references them in tables/seeds).
CREATE TYPE "InspectionDomain" AS ENUM ('OSH', 'ENVIRONMENT');
CREATE TYPE "InspectionType" AS ENUM ('WALKTHROUGH', 'AUDIT', 'EQUIPMENT_INSPECTION', 'COMPLIANCE_CHECKLIST', 'ISO_INTERNAL_AUDIT');
CREATE TYPE "InspectionStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED');
CREATE TYPE "InspectionAnswerType" AS ENUM ('YES_NO_NA', 'SCALE', 'NUMBER', 'TEXT', 'CHOICE', 'FILE');
CREATE TYPE "YesNoNa" AS ENUM ('YES', 'NO', 'NA');
