-- P6 §6 Gefährdungsbeurteilung extensions. Additive header attributes +
-- review-cycle columns on RiskAssessment. All nullable except reviewRequired,
-- which carries a DEFAULT false so the column backfills existing rows without
-- a separate two-step NOT NULL migration. No CHECK/partial-index constructs,
-- so nothing extra to re-verify beyond the columns existing.

ALTER TABLE "RiskAssessment"
  ADD COLUMN "activityType" "ActivityType",
  ADD COLUMN "personsExposedCount" INTEGER,
  ADD COLUMN "shiftPattern" TEXT,
  ADD COLUMN "productReference" TEXT,
  ADD COLUMN "processDescription" TEXT,
  ADD COLUMN "reviewIntervalMonths" INTEGER,
  ADD COLUMN "nextReviewDate" TIMESTAMP(3),
  ADD COLUMN "reviewRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "reviewRequiredReason" TEXT;
