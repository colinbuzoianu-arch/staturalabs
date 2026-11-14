-- P17 §4: training-session planning + attendance roster.
-- TrainingSession gains a lifecycle (PLANNED → COMPLETED / CANCELLED), a place,
-- the planner, and a completion timestamp. Existing rows were all created by
-- recordTrainingSession (an after-the-fact record), so they are COMPLETED with
-- completedAt = their session date. TrainingSessionParticipant is the invited/
-- attendance roster; on completion each ATTENDED participant yields a
-- TrainingRecord (in the lib gate, not here). Person-compartment data (person
-- names), audited by the lib; no FK into the assessment chain.

-- 1) TrainingSession lifecycle columns. Add status nullable, backfill, then
--    set NOT NULL + default PLANNED (new sessions start planned).
ALTER TABLE "TrainingSession" ADD COLUMN "status" "TrainingSessionStatus";
ALTER TABLE "TrainingSession" ADD COLUMN "location" TEXT;
ALTER TABLE "TrainingSession" ADD COLUMN "plannedByUserId" UUID;
ALTER TABLE "TrainingSession" ADD COLUMN "completedAt" TIMESTAMP(3);
UPDATE "TrainingSession" SET "status" = 'COMPLETED', "completedAt" = "date" WHERE "status" IS NULL;
ALTER TABLE "TrainingSession" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "TrainingSession" ALTER COLUMN "status" SET DEFAULT 'PLANNED';

-- 2) Attendance roster.
CREATE TABLE "TrainingSessionParticipant" (
    "id"                 TEXT NOT NULL,
    "trainingSessionId"  TEXT NOT NULL,
    "personId"           TEXT NOT NULL,
    "status"             "TrainingParticipantStatus" NOT NULL DEFAULT 'INVITED',
    "signatureConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "invitedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedAt"         TIMESTAMP(3),
    CONSTRAINT "TrainingSessionParticipant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TrainingSessionParticipant_session_person_key"
  ON "TrainingSessionParticipant"("trainingSessionId", "personId");
CREATE INDEX "TrainingSessionParticipant_trainingSessionId_idx"
  ON "TrainingSessionParticipant"("trainingSessionId");
CREATE INDEX "TrainingSessionParticipant_personId_idx"
  ON "TrainingSessionParticipant"("personId");
ALTER TABLE "TrainingSessionParticipant" ADD CONSTRAINT "TrainingSessionParticipant_trainingSessionId_fkey"
  FOREIGN KEY ("trainingSessionId") REFERENCES "TrainingSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrainingSessionParticipant" ADD CONSTRAINT "TrainingSessionParticipant_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Child of TrainingSession → company-scoped via the parent (parent-EXISTS RLS).
ALTER TABLE "TrainingSessionParticipant" ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_rls ON "TrainingSessionParticipant" FOR ALL TO statura_app
  USING (EXISTS (SELECT 1 FROM "TrainingSession" p WHERE p.id = "TrainingSessionParticipant"."trainingSessionId"))
  WITH CHECK (EXISTS (SELECT 1 FROM "TrainingSession" p WHERE p.id = "TrainingSessionParticipant"."trainingSessionId"));
