-- P11 Rechtskataster spine. RLS on; FKs Restrict (person-free module; no FK
-- into the people compartment). Site gains a plain employeeCount figure.
-- Action gains the SIXTH source (complianceEvaluationId); the exactly-one-source
-- CHECK widens one-of-five → one-of-six.

ALTER TABLE "Site" ADD COLUMN "employeeCount" INTEGER;

-- CreateTable: LegalRequirementCatalogVersion (single-active, partial unique index)
CREATE TABLE "LegalRequirementCatalogVersion" (
    "version" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LegalRequirementCatalogVersion_pkey" PRIMARY KEY ("version")
);
CREATE UNIQUE INDEX "LegalRequirementCatalogVersion_isActive_unique_when_true" ON "LegalRequirementCatalogVersion"("isActive") WHERE "isActive" = true;
ALTER TABLE "LegalRequirementCatalogVersion" ENABLE ROW LEVEL SECURITY;

-- CreateTable: LegalRequirement
CREATE TABLE "LegalRequirement" (
    "id" TEXT NOT NULL,
    "catalogVersion" TEXT NOT NULL,
    "companyId" TEXT,
    "country" "CountryCode" NOT NULL,
    "domain" "LegalDomain" NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "obligationSummary" TEXT NOT NULL,
    "legalReferenceId" TEXT,
    "applicability" JSONB NOT NULL,
    "defaultReviewInterval" TEXT NOT NULL DEFAULT 'P1Y',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LegalRequirement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LegalRequirement_catalogVersion_country_code_key" ON "LegalRequirement"("catalogVersion", "country", "code");
CREATE INDEX "LegalRequirement_catalogVersion_country_domain_idx" ON "LegalRequirement"("catalogVersion", "country", "domain");
CREATE INDEX "LegalRequirement_companyId_idx" ON "LegalRequirement"("companyId");
CREATE INDEX "LegalRequirement_legalReferenceId_idx" ON "LegalRequirement"("legalReferenceId");
ALTER TABLE "LegalRequirement" ADD CONSTRAINT "LegalRequirement_catalogVersion_fkey" FOREIGN KEY ("catalogVersion") REFERENCES "LegalRequirementCatalogVersion"("version") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LegalRequirement" ADD CONSTRAINT "LegalRequirement_legalReferenceId_fkey" FOREIGN KEY ("legalReferenceId") REFERENCES "LegalReference"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LegalRequirement" ENABLE ROW LEVEL SECURITY;

-- CreateTable: SiteLegalRequirement (rationale required for NOT_APPLICABLE)
CREATE TABLE "SiteLegalRequirement" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "legalRequirementId" TEXT NOT NULL,
    "status" "SiteLegalRequirementStatus" NOT NULL DEFAULT 'OPEN',
    "rationale" TEXT,
    "assignedByUserId" UUID,
    "assignedAt" TIMESTAMP(3),
    "reviewRequired" BOOLEAN NOT NULL DEFAULT false,
    "reviewDiff" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SiteLegalRequirement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SiteLegalRequirement_siteId_legalRequirementId_key" ON "SiteLegalRequirement"("siteId", "legalRequirementId");
CREATE INDEX "SiteLegalRequirement_siteId_status_idx" ON "SiteLegalRequirement"("siteId", "status");
CREATE INDEX "SiteLegalRequirement_legalRequirementId_idx" ON "SiteLegalRequirement"("legalRequirementId");
ALTER TABLE "SiteLegalRequirement" ADD CONSTRAINT "SiteLegalRequirement_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SiteLegalRequirement" ADD CONSTRAINT "SiteLegalRequirement_legalRequirementId_fkey" FOREIGN KEY ("legalRequirementId") REFERENCES "LegalRequirement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- NOT_APPLICABLE requires a one-line rationale (same pattern as
-- HazardCategoryCheck_rationale_check). OPEN/APPLICABLE need none.
ALTER TABLE "SiteLegalRequirement" ADD CONSTRAINT "SiteLegalRequirement_rationale_check" CHECK (
  "status" <> 'NOT_APPLICABLE' OR "rationale" IS NOT NULL
);
ALTER TABLE "SiteLegalRequirement" ENABLE ROW LEVEL SECURITY;

-- CreateTable: ComplianceEvaluation (1:1 with the site link)
CREATE TABLE "ComplianceEvaluation" (
    "id" TEXT NOT NULL,
    "siteLegalRequirementId" TEXT NOT NULL,
    "state" "ComplianceState" NOT NULL DEFAULT 'NOT_EVALUATED',
    "evaluatedByUserId" UUID,
    "evaluatedAt" TIMESTAMP(3),
    "evidence" JSONB,
    "note" TEXT,
    "nextReviewDue" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ComplianceEvaluation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ComplianceEvaluation_siteLegalRequirementId_key" ON "ComplianceEvaluation"("siteLegalRequirementId");
ALTER TABLE "ComplianceEvaluation" ADD CONSTRAINT "ComplianceEvaluation_siteLegalRequirementId_fkey" FOREIGN KEY ("siteLegalRequirementId") REFERENCES "SiteLegalRequirement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplianceEvaluation" ENABLE ROW LEVEL SECURITY;

-- CreateTable: ComplianceEvaluationEvent (append-only)
CREATE TABLE "ComplianceEvaluationEvent" (
    "id" TEXT NOT NULL,
    "siteLegalRequirementId" TEXT NOT NULL,
    "fromState" "ComplianceState",
    "toState" "ComplianceState" NOT NULL,
    "byUserId" UUID NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ComplianceEvaluationEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ComplianceEvaluationEvent_siteLegalRequirementId_idx" ON "ComplianceEvaluationEvent"("siteLegalRequirementId");
ALTER TABLE "ComplianceEvaluationEvent" ADD CONSTRAINT "ComplianceEvaluationEvent_siteLegalRequirementId_fkey" FOREIGN KEY ("siteLegalRequirementId") REFERENCES "SiteLegalRequirement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplianceEvaluationEvent" ENABLE ROW LEVEL SECURITY;

-- Action: the SIXTH source. Add the column + FK, widen the CHECK to one-of-six.
ALTER TABLE "Action" ADD COLUMN "complianceEvaluationId" TEXT;
ALTER TABLE "Action" ADD CONSTRAINT "Action_complianceEvaluationId_fkey" FOREIGN KEY ("complianceEvaluationId") REFERENCES "ComplianceEvaluation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Action" DROP CONSTRAINT "Action_exactly_one_source_check";
ALTER TABLE "Action" ADD CONSTRAINT "Action_exactly_one_source_check" CHECK (
  (
    (CASE WHEN "riskFindingId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "assessmentSessionId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "environmentalFindingId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "inspectionObservationId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "incidentId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "complianceEvaluationId" IS NOT NULL THEN 1 ELSE 0 END)
  ) = 1
);
