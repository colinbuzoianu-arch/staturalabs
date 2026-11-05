-- P10c: the health sub-compartment table + the PlatformRole CHECK fix.

-- Fix the PlatformUser role/companyId CHECK. It only ever listed the original
-- four roles, so the P7 provisionable roles (EHS_SPECIALIST/MANAGER/EMPLOYEE)
-- could not actually be inserted — a latent gap. Widen the company-scoped group
-- to every provisionable role, including the two P10c roles. SUPER_ADMIN/
-- L3_SUPPORT stay company-less; everyone else is company-scoped.
ALTER TABLE "PlatformUser" DROP CONSTRAINT "PlatformUser_role_companyId_check";
ALTER TABLE "PlatformUser" ADD CONSTRAINT "PlatformUser_role_companyId_check" CHECK (
  (role IN ('SUPER_ADMIN', 'L3_SUPPORT') AND "companyId" IS NULL) OR
  (role IN (
    'COMPANY_ADMIN', 'SITE_ADMIN', 'EHS_SPECIALIST', 'MANAGER', 'EMPLOYEE',
    'OCCUPATIONAL_PHYSICIAN', 'WORKS_COUNCIL'
  ) AND "companyId" IS NOT NULL)
);

-- CreateTable: IncidentHealthDetail (the health sub-compartment). RLS on.
-- 1:1 with an injured involved-person row (Cascade — composed child). Free-text
-- medical fields are the `*Enc` columns (AES-256-GCM ciphertext); coarse
-- structured fields stay plaintext for the data sheet and KPIs (D2). No FK to
-- PlatformUser (createdByUserId is a plain uuid), no assessment-chain FK.
CREATE TABLE "IncidentHealthDetail" (
    "id" TEXT NOT NULL,
    "incidentInvolvedPersonId" TEXT NOT NULL,
    "injuryType" "InjuryType",
    "bodyRegion" "BodyRegionCoarse",
    "incapacityDays" INTEGER,
    "fatal" BOOLEAN NOT NULL DEFAULT false,
    "medicalTreatmentGiven" BOOLEAN NOT NULL DEFAULT false,
    "diagnosisEnc" TEXT,
    "treatmentNotesEnc" TEXT,
    "medicalHistoryNoteEnc" TEXT,
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IncidentHealthDetail_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "IncidentHealthDetail_incidentInvolvedPersonId_key" ON "IncidentHealthDetail"("incidentInvolvedPersonId");
ALTER TABLE "IncidentHealthDetail" ADD CONSTRAINT "IncidentHealthDetail_incidentInvolvedPersonId_fkey" FOREIGN KEY ("incidentInvolvedPersonId") REFERENCES "IncidentInvolvedPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IncidentHealthDetail" ENABLE ROW LEVEL SECURITY;
