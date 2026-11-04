-- P7c Unterweisungen (SLD_P7_COMPARTMENT_DESIGN_NOTE.md, plan §7.6). Enum
-- only, per the standing gotcha — the tables that use these land next.
CREATE TYPE "TrainingDeliveryMethod" AS ENUM ('IN_PERSON', 'ELEARNING', 'DOCUMENT_READ_CONFIRMATION');
CREATE TYPE "TrainingConfirmation" AS ENUM ('SIGNATURE', 'SELF_CONFIRMED');
