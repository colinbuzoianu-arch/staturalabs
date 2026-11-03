-- P6 §6: RiskAssessmentLegalReference join — the applicable legal references
-- an assessor marks on an assessment, chosen from the country catalogue
-- (reuses the P3 LegalReference rows; no new legal content). Additive join
-- table, both FKs onDelete Restrict (§3.9), RLS enabled (owner-bypass). No
-- enum, single migration.

CREATE TABLE "RiskAssessmentLegalReference" (
    "id" TEXT NOT NULL,
    "riskAssessmentId" TEXT NOT NULL,
    "legalReferenceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskAssessmentLegalReference_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RiskAssessmentLegalReference_riskAssessmentId_legalReferenc_key"
  ON "RiskAssessmentLegalReference"("riskAssessmentId", "legalReferenceId");
CREATE INDEX "RiskAssessmentLegalReference_riskAssessmentId_idx"
  ON "RiskAssessmentLegalReference"("riskAssessmentId");
CREATE INDEX "RiskAssessmentLegalReference_legalReferenceId_idx"
  ON "RiskAssessmentLegalReference"("legalReferenceId");
ALTER TABLE "RiskAssessmentLegalReference"
  ADD CONSTRAINT "RiskAssessmentLegalReference_riskAssessmentId_fkey"
  FOREIGN KEY ("riskAssessmentId") REFERENCES "RiskAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RiskAssessmentLegalReference"
  ADD CONSTRAINT "RiskAssessmentLegalReference_legalReferenceId_fkey"
  FOREIGN KEY ("legalReferenceId") REFERENCES "LegalReference"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RiskAssessmentLegalReference" ENABLE ROW LEVEL SECURITY;
