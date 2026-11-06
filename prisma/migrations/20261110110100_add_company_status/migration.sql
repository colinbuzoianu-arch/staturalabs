-- P13 §2.1: Company gains a soft status + archive provenance. The statura_app
-- RLS policy on Company already exists (keyed on id); these columns don't
-- change it.
ALTER TABLE "Company" ADD COLUMN "status" "CompanyStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Company" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "Company" ADD COLUMN "archivedByUserId" UUID;
