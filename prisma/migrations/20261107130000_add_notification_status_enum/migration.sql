-- P10d §D.4: enum-first. The notification status enum, and the new generated-
-- document type for the pre-filled authority data sheet.
CREATE TYPE "IncidentNotificationStatus" AS ENUM ('REQUIRED', 'SUBMITTED', 'WAIVED');
ALTER TYPE "GeneratedDocumentType" ADD VALUE 'INCIDENT_NOTIFICATION';
