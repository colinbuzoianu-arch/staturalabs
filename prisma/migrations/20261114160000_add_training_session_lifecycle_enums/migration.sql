-- P17 §4 slice 4: a leader plans a training session ahead of time, invites
-- people from their own units, then records attendance. Two new enums; the
-- columns/table that reference them land in the next migration (enum-first).
CREATE TYPE "TrainingSessionStatus" AS ENUM ('PLANNED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "TrainingParticipantStatus" AS ENUM ('INVITED', 'ATTENDED', 'ABSENT');
