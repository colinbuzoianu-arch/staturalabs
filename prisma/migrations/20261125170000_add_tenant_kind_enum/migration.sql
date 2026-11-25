-- P18 A.1 (SLD_P18_TRIALS_AND_HANDBOOK_APPROVED.md): what KIND of tenant a
-- company is. Enum-only migration per the standing gotcha — the backfill that
-- marks the demo company DEMO cannot reference these values in the same
-- migration that creates them.
--
-- CUSTOMER = a paying/real tenant (the default for everything that exists).
-- DEMO     = the founder's own presentation tenant.
-- TRIAL    = a prospect's time-limited copy. Excluded from customer counts,
--            platform statistics and any future billing logic.

CREATE TYPE "TenantKind" AS ENUM ('CUSTOMER', 'DEMO', 'TRIAL');
