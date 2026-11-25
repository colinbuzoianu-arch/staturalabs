-- Sicherheitsinformationen (safety broadcasts), slice 1 — enums only.
--
-- Enum-first per the standing gotcha (CLAUDE.md "Known gotchas"): a brand-new
-- enum value can never be referenced in a CHECK or a seed INSERT in the SAME
-- migration that adds it, so the ModuleKey value and the four new enums land
-- here and the tables that use them in the next migration.

ALTER TYPE "ModuleKey" ADD VALUE 'BROADCASTS';

-- INFO = routine information. SAFETY_ALERT = the prominent, banner-level kind
-- (a near miss, an immediate hazard) — a presentation/urgency distinction, not
-- a legal classification.
CREATE TYPE "BroadcastPriority" AS ENUM ('INFO', 'SAFETY_ALERT');

-- Per-record domain tag (§2.2 rule 8: an artifact never mixes OSH and
-- environment vocabularies). GENERAL for anything that is neither.
CREATE TYPE "BroadcastDomain" AS ENUM ('OSH', 'ENVIRONMENT', 'GENERAL');

-- DRAFT → PUBLISHED → ARCHIVED. The transition table lives in
-- src/lib/broadcasts/transitions.ts; an archived broadcast stays readable with
-- its confirmation list (proof the information was passed on).
CREATE TYPE "BroadcastStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- Who a broadcast is addressed to. ORG_UNIT includes sub-units; WORKSTATION
-- means the persons assigned to it; ROLE means every holder of that tenant role
-- at the broadcast's site.
CREATE TYPE "BroadcastAudienceScope" AS ENUM ('COMPANY', 'SITE', 'ORG_UNIT', 'WORKSTATION', 'ROLE');
