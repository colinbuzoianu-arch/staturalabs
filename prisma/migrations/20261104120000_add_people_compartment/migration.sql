-- P7a people compartment (SLD_P7_COMPARTMENT_DESIGN_NOTE.md, plan §3.2). The
-- first person data in the product. Two tables, RLS on (owner-bypass). The
-- ONLY FK is Person.companyId → Company (tenant root); orgUnitId /
-- workstationId / platformUserId are plain columns by design, so the
-- compartment cannot couple to the person-free assessment chain. PersonAssignment
-- carries a hand-added exactly-one-of(workstationId, orgUnitId) CHECK (Prisma
-- can't express it), mirroring the Action/RiskAssessment subject CHECKs. No new
-- enum, single migration.

-- CreateTable: Person
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "personnelNumber" TEXT,
    "orgUnitId" TEXT,
    "employmentStart" TIMESTAMP(3),
    "employmentEnd" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "platformUserId" UUID,
    "anonymisedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Person_companyId_idx" ON "Person"("companyId");
ALTER TABLE "Person" ADD CONSTRAINT "Person_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Person" ENABLE ROW LEVEL SECURITY;

-- CreateTable: PersonAssignment
CREATE TABLE "PersonAssignment" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "workstationId" TEXT,
    "orgUnitId" TEXT,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonAssignment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PersonAssignment_personId_idx" ON "PersonAssignment"("personId");
ALTER TABLE "PersonAssignment" ADD CONSTRAINT "PersonAssignment_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- exactly one of workstationId / orgUnitId is set
ALTER TABLE "PersonAssignment" ADD CONSTRAINT "PersonAssignment_exactly_one_subject_check"
  CHECK (("workstationId" IS NOT NULL)::int + ("orgUnitId" IS NOT NULL)::int = 1);
ALTER TABLE "PersonAssignment" ENABLE ROW LEVEL SECURITY;
