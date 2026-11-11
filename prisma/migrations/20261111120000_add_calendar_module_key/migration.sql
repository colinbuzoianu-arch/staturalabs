-- P14 G2: the Aktivitätenkalender is a first-class Übersicht module. Baseline
-- (no entitlement row needed), so this only adds the enum value — nothing in
-- this migration references it (standing gotcha), it is wired into the registry
-- in code.
ALTER TYPE "ModuleKey" ADD VALUE 'CALENDAR';
