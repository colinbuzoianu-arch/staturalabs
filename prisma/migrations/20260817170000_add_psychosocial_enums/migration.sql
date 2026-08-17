-- B7 of the Austria-first plan (SLD_IMPLEMENTATION_PLAN_austria-first.md
-- §7 B7): psychosocial evaluation. Enum-only migration first, per the
-- standing gotcha — a brand-new enum type can't be referenced (in a
-- column, a CHECK, a seed INSERT) in the same migration that creates it.
-- No tables, no columns here.

-- CreateEnum
CREATE TYPE "PsychosocialDimension" AS ENUM ('TASK_AND_ACTIVITY', 'WORK_ORGANIZATION', 'WORK_ENVIRONMENT', 'SOCIAL_CLIMATE');

-- CreateEnum
CREATE TYPE "PsychosocialMethod" AS ENUM ('QUESTIONNAIRE', 'GROUP_DISCUSSION', 'OBSERVATION', 'INTERVIEW');
