-- P15 S7 (SLD_P15_GEFAHRSTOFFE_EXTENDED_APPROVED.md §2 S7): AI drafting for
-- Betriebsanweisungen. The AI drafts the four free-text BA sections
-- (Schutzmaßnahmen und Verhaltensregeln, Verhalten im Gefahrfall, Erste Hilfe,
-- Sachgerechte Entsorgung) ONLY from the confirmed SDS sections (4/5/6/7/8/13) of
-- that product plus the P6 measure catalogue — no information from outside the
-- SDS. Each drafted section records which SDS sections it drew from. The output
-- stays a DRAFT until a user approves it (the existing P8 flow). Stored as JSON
-- on the OperatingInstruction.
ALTER TABLE "OperatingInstruction" ADD COLUMN "aiDraft"       JSONB;
ALTER TABLE "OperatingInstruction" ADD COLUMN "draftedByAiAt" TIMESTAMP(3);
ALTER TABLE "OperatingInstruction" ADD COLUMN "draftModel"    TEXT;
