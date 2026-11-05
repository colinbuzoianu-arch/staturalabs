-- P10b: involved-person role enum first (standing gotcha — enum before use).
CREATE TYPE "IncidentInvolvedRole" AS ENUM (
  'INJURED',
  'WITNESS',
  'FIRST_AIDER',
  'OTHER'
);
