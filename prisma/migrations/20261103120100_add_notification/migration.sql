-- P5 notifications service (SLD_RESTRUCTURE_PLAN_platform-modules.md §7.9).
-- One additive table, RLS enabled (no policy — same owner-bypass posture as
-- every other table until the non-owner runtime role lands). Deliberately NO
-- foreign keys: like AuditEvent, a notification outlives the entity it points
-- at, so recipientUserId/companyId/siteId/subjectId are plain columns.
-- recipientUserId is a PlatformUser account id only (§3.18(4)), never a Person.
-- The unique (recipientUserId, dedupeKey) index makes generation idempotent.

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "recipientUserId" UUID NOT NULL,
    "eventType" "NotificationEventType" NOT NULL,
    "companyId" TEXT,
    "siteId" TEXT,
    "subjectType" TEXT,
    "subjectId" TEXT,
    "href" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "dedupeKey" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "emailedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Notification_recipientUserId_dedupeKey_key" ON "Notification"("recipientUserId", "dedupeKey");
CREATE INDEX "Notification_recipientUserId_readAt_idx" ON "Notification"("recipientUserId", "readAt");
CREATE INDEX "Notification_siteId_idx" ON "Notification"("siteId");
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
