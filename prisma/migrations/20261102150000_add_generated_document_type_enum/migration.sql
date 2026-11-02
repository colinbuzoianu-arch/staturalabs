-- P4 (SLD_RESTRUCTURE_PLAN_platform-modules.md §2.2 rule 4): the generated-
-- document archive's type enum. Enum-only first, per the standing gotcha — the
-- table that uses it lands in the next migration.
CREATE TYPE "GeneratedDocumentType" AS ENUM ('TASK_REPORT', 'RISK_ASSESSMENT_REPORT', 'WORKER_BRIEFING', 'SGD', 'AWK');
