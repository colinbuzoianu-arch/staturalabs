-- P1 of the platform-modules restructure plan
-- (SLD_RESTRUCTURE_PLAN_platform-modules.md §2.4). Enum only, no tables, no
-- columns, no seed: a brand-new enum *value* can't be referenced (in a
-- column type, a CHECK, or a seed INSERT that casts to it) in the same
-- migration that creates the type — the standing gotcha documented in
-- CLAUDE.md and followed for CountryCode / the environment enums / every
-- other enum-first split. CompanyModule (which uses this type) and its
-- enable-all seed land in the next migration
-- (20261031120100_add_company_module_and_audit_event).

-- CreateEnum
CREATE TYPE "ModuleKey" AS ENUM ('COCKPIT', 'MY_TASKS', 'RISK', 'INSPECTIONS', 'INCIDENTS', 'ENVIRONMENT', 'ACTIONS', 'CHEMICALS', 'TRAINING', 'PEOPLE', 'LEGAL', 'DOCUMENTS', 'REPORTS', 'SETTINGS');
