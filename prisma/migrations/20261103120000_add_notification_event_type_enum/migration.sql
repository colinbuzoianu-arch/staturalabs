-- P5 notifications service (SLD_RESTRUCTURE_PLAN_platform-modules.md §7.9).
-- Enum only, no table — the standing gotcha: a brand-new enum value can't be
-- referenced (as a column type) in the same migration that creates the type.
-- The Notification table that uses this type lands in the next migration
-- (20261103120100_add_notification).

-- CreateEnum
CREATE TYPE "NotificationEventType" AS ENUM ('ACTION_DUE_SOON', 'ACTION_OVERDUE', 'ACTION_VERIFICATION_DUE', 'DOCUMENT_REVIEW_DUE', 'ASSESSMENT_REVIEW_DUE', 'ENVIRONMENTAL_ASSESSMENT_REVIEW_DUE', 'INSPECTION_DUE', 'INCIDENT_REPORTED', 'NOTIFICATION_DEADLINE_APPROACHING', 'SDS_OUTDATED', 'INSTRUCTION_DUE', 'INSTRUCTION_OVERDUE', 'LEGAL_REQUIREMENT_REVIEW_DUE');
