-- P18 A.4: after the grace period, a trial's data is deleted — but never
-- automatically on the first run. The daily job PROPOSES, the founder approves,
-- exactly like every retention batch in this codebase (P7d §C.4).
--
-- Deliberately its own table rather than a RetentionBatch row: this deletes a
-- whole TENANT through the P13 deletion path, not matured records inside one,
-- and the two reviews must never be confused for each other.
--
-- companyId is a PLAIN column, not an FK: the proposal has to outlive the
-- tenant it deleted, which is the only lasting record that the deletion
-- happened (together with the AuditEvent, which is also FK-free).
--
-- Company.trialFirstSignInAt (A.5) is set once, the first time anyone from a
-- trial tenant reaches an authenticated page, and is what makes the founder's
-- "the prospect has started" e-mail fire exactly once.
--
-- Hand-added constructs to re-verify live after `migrate deploy`:
--   * TrialDeletionProposal: RLS enabled (no policy — super_admin-only surface,
--     reached through the owner connection like the rest of /admin), the
--     partial unique index allowing only ONE open proposal per company, and the
--     approved/executed shape CHECK.

ALTER TABLE "Company" ADD COLUMN "trialFirstSignInAt" TIMESTAMP(3);

CREATE TABLE "TrialDeletionProposal" (
    "id"               TEXT NOT NULL,
    -- Plain column (see the header): the proposal outlives the company.
    "companyId"        TEXT NOT NULL,
    -- Kept so the record still says WHICH tenant after the row is gone.
    "companyName"      TEXT NOT NULL,
    "status"           "RetentionBatchStatus" NOT NULL DEFAULT 'PROPOSED',
    "lockedAt"         TIMESTAMP(3) NOT NULL,
    "graceEndedAt"     TIMESTAMP(3) NOT NULL,
    "proposedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedByUserId" UUID,
    "approvedAt"       TIMESTAMP(3),
    "executedAt"       TIMESTAMP(3),
    "cancelledAt"      TIMESTAMP(3),
    CONSTRAINT "TrialDeletionProposal_pkey" PRIMARY KEY ("id")
);

-- Only one OPEN proposal per company, so a daily job cannot pile up duplicates.
-- A partial unique index, which Prisma's schema language cannot express.
CREATE UNIQUE INDEX "TrialDeletionProposal_open_unique"
  ON "TrialDeletionProposal"("companyId") WHERE "status" = 'PROPOSED';
CREATE INDEX "TrialDeletionProposal_status_idx" ON "TrialDeletionProposal"("status");

-- The stamps must match the status: an approved proposal names its approver, a
-- cancelled one carries no approval, and only an approved one may be executed.
ALTER TABLE "TrialDeletionProposal" ADD CONSTRAINT "TrialDeletionProposal_shape_check" CHECK (
  (status = 'PROPOSED'  AND "approvedAt" IS NULL     AND "approvedByUserId" IS NULL AND "executedAt" IS NULL AND "cancelledAt" IS NULL)
  OR (status = 'APPROVED'  AND "approvedAt" IS NOT NULL AND "approvedByUserId" IS NOT NULL AND "cancelledAt" IS NULL)
  OR (status = 'CANCELLED' AND "cancelledAt" IS NOT NULL AND "executedAt" IS NULL)
);

ALTER TABLE "TrialDeletionProposal" ENABLE ROW LEVEL SECURITY;
