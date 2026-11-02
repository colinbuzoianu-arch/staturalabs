-- P4 (§7.2): the document library's category enum. Enum-only first, per the
-- standing gotcha; the tables that use it land next.
CREATE TYPE "DocumentCategory" AS ENUM ('PROCEDURE', 'PERMIT', 'CERTIFICATE', 'SDS', 'INSPECTION_EVIDENCE', 'TRAINING_MATERIAL', 'EXTERNAL_REPORT', 'AUTHORITY_CORRESPONDENCE', 'OTHER');
