-- Sicherheitsinformationen (safety broadcasts), slice 1 — tables.
--
-- An EHS user writes one safety message, picks an audience, and it reaches
-- everyone in it; recipients confirm "gelesen und verstanden" and the sender
-- sees who has and who has not. Delivery reuses the P5 notification service;
-- this schema holds the message, its audience, the published recipient
-- snapshot and the append-only status history.
--
-- COMPARTMENT REASONING (ERGO_COMPLIANCE_BY_DESIGN.md §3.18(a)) — read before
-- adding a column here:
--   * Content links (Document / Incident / OperatingInstruction / Action) are
--     real FKs, one explicit nullable column per type with an at-most-one
--     CHECK — never a stringly entityType/entityId pair.
--   * The AUDIENCE org-unit and workstation targets and the RECIPIENT personId
--     are deliberately PLAIN COLUMNS, not FKs, exactly like Incident subject
--     columns and PersonAssignment job columns. That is what keeps the
--     compartment airtight: with no Person relation on the recipient row there
--     is no schema-level join path from a person to the assessment chain
--     through a broadcast. The app layer owns the integrity the missing FK
--     would give (src/lib/subject/, validated in the gates).
--   * A recipient sees only the text the sender wrote. An incident link never
--     copies incident person or health data into the body.
--
-- Hand-added constructs to re-verify live after `migrate deploy`:
--   * Broadcast_link_at_most_one_check, Broadcast_published_shape_check,
--     Broadcast_confirmation_due_shape_check
--   * BroadcastAudience_scope_shape_check (exactly one target per scope type)
--   * BroadcastRecipient_identity_check + its two partial unique indexes
--   * RLS enabled + policy app_rls on all four tables
--   * every FK ON DELETE RESTRICT (§3.9: no cascade shortcuts)

CREATE TABLE "Broadcast" (
    "id"                     TEXT NOT NULL,
    "companyId"              TEXT NOT NULL,
    -- NULL = company-wide (every site). A site-scoped broadcast names its site.
    "siteId"                 TEXT,
    "title"                  TEXT NOT NULL,
    -- Sanitised rich text (server-side sanitiser, src/lib/broadcasts/sanitise.ts).
    "body"                   TEXT NOT NULL,
    "priority"               "BroadcastPriority" NOT NULL DEFAULT 'INFO',
    "domain"                 "BroadcastDomain" NOT NULL DEFAULT 'OSH',
    "status"                 "BroadcastStatus" NOT NULL DEFAULT 'DRAFT',
    -- Content links: at most one, explicit column per type.
    "documentId"             TEXT,
    "incidentId"             TEXT,
    "operatingInstructionId" TEXT,
    "actionId"               TEXT,
    "requiresConfirmation"   BOOLEAN NOT NULL DEFAULT false,
    "confirmationDueAt"      TIMESTAMP(3),
    "createdByUserId"        UUID,
    "publishedAt"            TIMESTAMP(3),
    "archivedAt"             TIMESTAMP(3),
    "recipientsRefreshedAt"  TIMESTAMP(3),
    "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"              TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Broadcast_pkey" PRIMARY KEY ("id")
);

-- At most one content link.
ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_link_at_most_one_check" CHECK (
  (("documentId" IS NOT NULL)::int
   + ("incidentId" IS NOT NULL)::int
   + ("operatingInstructionId" IS NOT NULL)::int
   + ("actionId" IS NOT NULL)::int) <= 1
);
-- publishedAt exists exactly when the broadcast has left DRAFT; archivedAt
-- only on an ARCHIVED row. A DRAFT can never carry either stamp.
ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_published_shape_check" CHECK (
  (status = 'DRAFT' AND "publishedAt" IS NULL AND "archivedAt" IS NULL)
  OR (status = 'PUBLISHED' AND "publishedAt" IS NOT NULL AND "archivedAt" IS NULL)
  OR (status = 'ARCHIVED' AND "publishedAt" IS NOT NULL AND "archivedAt" IS NOT NULL)
);
-- A due date is only meaningful when a confirmation is actually required.
ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_confirmation_due_shape_check" CHECK (
  "requiresConfirmation" = true OR "confirmationDueAt" IS NULL
);

CREATE INDEX "Broadcast_companyId_status_idx" ON "Broadcast"("companyId", "status");
CREATE INDEX "Broadcast_siteId_idx" ON "Broadcast"("siteId");
CREATE INDEX "Broadcast_confirmationDueAt_idx" ON "Broadcast"("confirmationDueAt");

ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_incidentId_fkey"
  FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_operatingInstructionId_fkey"
  FOREIGN KEY ("operatingInstructionId") REFERENCES "OperatingInstruction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_actionId_fkey"
  FOREIGN KEY ("actionId") REFERENCES "Action"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Append-only status history (never updated, never deleted — same discipline
-- as ActionStatusEvent / ComplianceEvaluationEvent).
CREATE TABLE "BroadcastStatusEvent" (
    "id"          TEXT NOT NULL,
    "broadcastId" TEXT NOT NULL,
    "fromStatus"  "BroadcastStatus",
    "toStatus"    "BroadcastStatus" NOT NULL,
    "note"        TEXT,
    "actorUserId" UUID,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BroadcastStatusEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BroadcastStatusEvent_broadcastId_idx" ON "BroadcastStatusEvent"("broadcastId");
ALTER TABLE "BroadcastStatusEvent" ADD CONSTRAINT "BroadcastStatusEvent_broadcastId_fkey"
  FOREIGN KEY ("broadcastId") REFERENCES "Broadcast"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- One row per addressed group; a broadcast may have several.
CREATE TABLE "BroadcastAudience" (
    "id"            TEXT NOT NULL,
    "broadcastId"   TEXT NOT NULL,
    "scope"         "BroadcastAudienceScope" NOT NULL,
    -- SITE scope: a real FK (Site is tenant hierarchy, not the assessment chain).
    "siteId"        TEXT,
    -- ORG_UNIT / WORKSTATION scope: plain columns by design (see the header).
    "orgUnitId"     TEXT,
    "workstationId" TEXT,
    -- ROLE scope: a tenant role, every holder of it within the broadcast scope.
    "role"          "PlatformRole",
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BroadcastAudience_pkey" PRIMARY KEY ("id")
);
-- Exactly one target, and it must match the scope type.
ALTER TABLE "BroadcastAudience" ADD CONSTRAINT "BroadcastAudience_scope_shape_check" CHECK (
  (scope = 'COMPANY' AND "siteId" IS NULL AND "orgUnitId" IS NULL AND "workstationId" IS NULL AND role IS NULL)
  OR (scope = 'SITE' AND "siteId" IS NOT NULL AND "orgUnitId" IS NULL AND "workstationId" IS NULL AND role IS NULL)
  OR (scope = 'ORG_UNIT' AND "siteId" IS NULL AND "orgUnitId" IS NOT NULL AND "workstationId" IS NULL AND role IS NULL)
  OR (scope = 'WORKSTATION' AND "siteId" IS NULL AND "orgUnitId" IS NULL AND "workstationId" IS NOT NULL AND role IS NULL)
  OR (scope = 'ROLE' AND "siteId" IS NULL AND "orgUnitId" IS NULL AND "workstationId" IS NULL AND role IS NOT NULL)
);
CREATE INDEX "BroadcastAudience_broadcastId_idx" ON "BroadcastAudience"("broadcastId");
ALTER TABLE "BroadcastAudience" ADD CONSTRAINT "BroadcastAudience_broadcastId_fkey"
  FOREIGN KEY ("broadcastId") REFERENCES "Broadcast"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BroadcastAudience" ADD CONSTRAINT "BroadcastAudience_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The recipient snapshot, fixed at publish time. People who join the audience
-- later are added only when the sender refreshes recipients.
CREATE TABLE "BroadcastRecipient" (
    "id"             TEXT NOT NULL,
    "broadcastId"    TEXT NOT NULL,
    -- The login account that sees it in the app (plain uuid, like
    -- Notification.recipientUserId). NULL for a person with no account yet.
    "platformUserId" UUID,
    -- The employee record, when the recipient was resolved through the people
    -- compartment. PLAIN column, no FK — see the header.
    "personId"       TEXT,
    -- Which audience row put them here (the "why"), plain column so trimming an
    -- audience never deletes delivery history.
    "audienceId"     TEXT,
    "deliveredAt"    TIMESTAMP(3),
    "readAt"         TIMESTAMP(3),
    "confirmedAt"    TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BroadcastRecipient_pkey" PRIMARY KEY ("id")
);
-- A recipient row is worthless without at least one identity.
ALTER TABLE "BroadcastRecipient" ADD CONSTRAINT "BroadcastRecipient_identity_check" CHECK (
  "platformUserId" IS NOT NULL OR "personId" IS NOT NULL
);
-- Partial uniques rather than one composite: a person and an account are two
-- different identities, each at most once per broadcast, and a NULL on the
-- other column must not defeat the constraint.
CREATE UNIQUE INDEX "BroadcastRecipient_broadcast_user_key"
  ON "BroadcastRecipient"("broadcastId", "platformUserId") WHERE "platformUserId" IS NOT NULL;
CREATE UNIQUE INDEX "BroadcastRecipient_broadcast_person_key"
  ON "BroadcastRecipient"("broadcastId", "personId") WHERE "personId" IS NOT NULL;
CREATE INDEX "BroadcastRecipient_broadcastId_idx" ON "BroadcastRecipient"("broadcastId");
CREATE INDEX "BroadcastRecipient_platformUserId_idx" ON "BroadcastRecipient"("platformUserId");
ALTER TABLE "BroadcastRecipient" ADD CONSTRAINT "BroadcastRecipient_broadcastId_fkey"
  FOREIGN KEY ("broadcastId") REFERENCES "Broadcast"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS (P13 §1). Broadcast is company-rooted; the three children scope through
-- the parent-EXISTS pattern.
ALTER TABLE "Broadcast" ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_rls ON "Broadcast" FOR ALL TO statura_app
  USING ("companyId" = ANY (app_company_ids()))
  WITH CHECK ("companyId" = ANY (app_company_ids()));

ALTER TABLE "BroadcastStatusEvent" ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_rls ON "BroadcastStatusEvent" FOR ALL TO statura_app
  USING (EXISTS (SELECT 1 FROM "Broadcast" p WHERE p.id = "BroadcastStatusEvent"."broadcastId"))
  WITH CHECK (EXISTS (SELECT 1 FROM "Broadcast" p WHERE p.id = "BroadcastStatusEvent"."broadcastId"));

ALTER TABLE "BroadcastAudience" ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_rls ON "BroadcastAudience" FOR ALL TO statura_app
  USING (EXISTS (SELECT 1 FROM "Broadcast" p WHERE p.id = "BroadcastAudience"."broadcastId"))
  WITH CHECK (EXISTS (SELECT 1 FROM "Broadcast" p WHERE p.id = "BroadcastAudience"."broadcastId"));

ALTER TABLE "BroadcastRecipient" ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_rls ON "BroadcastRecipient" FOR ALL TO statura_app
  USING (EXISTS (SELECT 1 FROM "Broadcast" p WHERE p.id = "BroadcastRecipient"."broadcastId"))
  WITH CHECK (EXISTS (SELECT 1 FROM "Broadcast" p WHERE p.id = "BroadcastRecipient"."broadcastId"));

-- Entitlement: turn the module on for every existing company (the same
-- one-time backfill shape P1 used) and add it to the default template for new
-- tenants.
INSERT INTO "CompanyModule" ("id", "companyId", "moduleKey", "enabledAt")
SELECT gen_random_uuid()::text, c.id, 'BROADCASTS', now()
FROM "Company" c
ON CONFLICT ("companyId", "moduleKey") DO NOTHING;

-- DefaultEntitlementModule is keyed BY moduleKey (no surrogate id column).
INSERT INTO "DefaultEntitlementModule" ("moduleKey", "createdAt")
VALUES ('BROADCASTS', now())
ON CONFLICT ("moduleKey") DO NOTHING;
