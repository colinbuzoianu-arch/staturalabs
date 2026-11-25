-- P18 B.1: the Hilfe module (the in-app handbook). Enum-only migration per
-- the standing gotcha; P2 already reserved the sidebar's bottom slot for it.
--
-- Baseline (no entitlement row needed) and readable by every tenant role: a
-- handbook nobody is allowed to open would be a strange thing to ship.

ALTER TYPE "ModuleKey" ADD VALUE 'HELP';
