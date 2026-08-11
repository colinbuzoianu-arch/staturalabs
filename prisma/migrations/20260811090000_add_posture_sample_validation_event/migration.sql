-- Append-only validation-status history for PostureSample (§3.6) — same
-- shape and rationale as ActionStatusEvent (20260730120400_add_actions):
-- a PostureSample's validationStatus is now a small state machine
-- (PENDING_REVIEW -> VALIDATED, and back via reopenPostureSampleForEdit),
-- so every transition needs an audited record of who did it and when, not
-- just the row's current state. byUserId is a plain UUID column, not an FK
-- to PlatformUser — same pattern as ActionStatusEvent.byUserId and
-- PostureSample.validatedByUserId (§3.13: application-level, not a
-- DB-level FK to auth data).
-- CreateTable
CREATE TABLE "PostureSampleValidationEvent" (
    "id" TEXT NOT NULL,
    "postureSampleId" TEXT NOT NULL,
    "fromStatus" "ValidationStatus",
    "toStatus" "ValidationStatus" NOT NULL,
    "byUserId" UUID NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostureSampleValidationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PostureSampleValidationEvent_postureSampleId_idx" ON "PostureSampleValidationEvent"("postureSampleId");

-- AddForeignKey
ALTER TABLE "PostureSampleValidationEvent" ADD CONSTRAINT "PostureSampleValidationEvent_postureSampleId_fkey" FOREIGN KEY ("postureSampleId") REFERENCES "PostureSample"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PostureSampleValidationEvent" ENABLE ROW LEVEL SECURITY;
