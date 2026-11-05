-- P10a Ereignisse: enums first (the standing gotcha — a new enum type must be
-- created in its own migration, before any table or CHECK references it).

CREATE TYPE "IncidentType" AS ENUM (
  'ARBEITSUNFALL',
  'WEGEUNFALL',
  'BERUFSKRANKHEIT_VERDACHT',
  'BEINAHEUNFALL',
  'ERSTE_HILFE',
  'BRAND',
  'SACHSCHADEN',
  'UMWELTEREIGNIS',
  'FAHRZEUGEREIGNIS',
  'SECURITY_VORFALL',
  'GEWALT_UEBERGRIFF',
  'BEHOERDE_BEANSTANDUNG',
  'SONSTIGES'
);

CREATE TYPE "IncidentStatus" AS ENUM (
  'REPORTED',
  'TRIAGED',
  'UNDER_INVESTIGATION',
  'ACTIONS_PENDING',
  'CLOSED'
);

CREATE TYPE "IncidentInvestigationMethod" AS ENUM (
  'FIVE_WHY',
  'ISHIKAWA',
  'NARRATIVE'
);
