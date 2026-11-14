-- P17 §2 slice 2: a leader (Führungskraft, ORG_UNIT scope) may PROPOSE a new
-- action rather than open it directly; EHS staff confirm the proposal, which
-- moves it into the normal OPEN lifecycle. New entry state on ActionStatus.
-- Enum-first per the standing rule (a new enum value can't be referenced in a
-- CHECK/seed in the same migration; nothing references it here). The existing
-- exactly-one-source CHECK is unaffected — PROPOSED is about status, not source.
ALTER TYPE "ActionStatus" ADD VALUE 'PROPOSED' BEFORE 'OPEN';
