-- P9 Begehungen & Audits — tables, the fourth Action source, RLS, and a
-- generic (NON-legal) system walk-through template. Every FK is ON DELETE
-- RESTRICT except the template/inspection internal children (Cascade), matching
-- §3.9's "no accidental cross-entity cascade" with one exception: a template's
-- own sections/questions and an inspection's own answers/team/observations are
-- composed parts, deleted with their parent.

-- CreateTable: InspectionTemplate
CREATE TABLE "InspectionTemplate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "siteId" TEXT,
    "domain" "InspectionDomain" NOT NULL DEFAULT 'OSH',
    "type" "InspectionType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InspectionTemplate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "InspectionTemplate_companyId_idx" ON "InspectionTemplate"("companyId");
CREATE INDEX "InspectionTemplate_siteId_idx" ON "InspectionTemplate"("siteId");
ALTER TABLE "InspectionTemplate" ADD CONSTRAINT "InspectionTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InspectionTemplate" ADD CONSTRAINT "InspectionTemplate_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InspectionTemplate" ENABLE ROW LEVEL SECURITY;

-- CreateTable: InspectionTemplateSection
CREATE TABLE "InspectionTemplateSection" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "InspectionTemplateSection_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "InspectionTemplateSection_templateId_idx" ON "InspectionTemplateSection"("templateId");
ALTER TABLE "InspectionTemplateSection" ADD CONSTRAINT "InspectionTemplateSection_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "InspectionTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InspectionTemplateSection" ENABLE ROW LEVEL SECURITY;

-- CreateTable: InspectionTemplateQuestion
CREATE TABLE "InspectionTemplateQuestion" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "answerType" "InspectionAnswerType" NOT NULL DEFAULT 'YES_NO_NA',
    "required" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "legalReferenceCode" TEXT,
    "unit" TEXT,
    "choiceOptions" TEXT[],
    CONSTRAINT "InspectionTemplateQuestion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "InspectionTemplateQuestion_sectionId_idx" ON "InspectionTemplateQuestion"("sectionId");
ALTER TABLE "InspectionTemplateQuestion" ADD CONSTRAINT "InspectionTemplateQuestion_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "InspectionTemplateSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InspectionTemplateQuestion" ENABLE ROW LEVEL SECURITY;

-- CreateTable: Inspection
CREATE TABLE "Inspection" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "templateId" TEXT,
    "templateVersion" INTEGER,
    "title" TEXT NOT NULL,
    "type" "InspectionType" NOT NULL,
    "domain" "InspectionDomain" NOT NULL DEFAULT 'OSH',
    "status" "InspectionStatus" NOT NULL DEFAULT 'PLANNED',
    "subjectWorkstationId" TEXT,
    "subjectOrgUnitId" TEXT,
    "plannedDate" TIMESTAMP(3),
    "performedDate" TIMESTAMP(3),
    "performedByUserId" UUID,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Inspection_siteId_status_idx" ON "Inspection"("siteId", "status");
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Inspection" ENABLE ROW LEVEL SECURITY;

-- CreateTable: InspectionTeamMember
CREATE TABLE "InspectionTeamMember" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "platformUserId" UUID NOT NULL,
    CONSTRAINT "InspectionTeamMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InspectionTeamMember_inspectionId_platformUserId_key" ON "InspectionTeamMember"("inspectionId", "platformUserId");
CREATE INDEX "InspectionTeamMember_inspectionId_idx" ON "InspectionTeamMember"("inspectionId");
ALTER TABLE "InspectionTeamMember" ADD CONSTRAINT "InspectionTeamMember_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InspectionTeamMember" ENABLE ROW LEVEL SECURITY;

-- CreateTable: InspectionAnswer
CREATE TABLE "InspectionAnswer" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "sectionTitle" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "answerType" "InspectionAnswerType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "legalReferenceCode" TEXT,
    "unit" TEXT,
    "choiceOptions" TEXT[],
    "valueYesNoNa" "YesNoNa",
    "valueNumber" DOUBLE PRECISION,
    "valueText" TEXT,
    "valueChoice" TEXT,
    "documentId" TEXT,
    "answeredAt" TIMESTAMP(3),
    CONSTRAINT "InspectionAnswer_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "InspectionAnswer_inspectionId_idx" ON "InspectionAnswer"("inspectionId");
ALTER TABLE "InspectionAnswer" ADD CONSTRAINT "InspectionAnswer_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InspectionAnswer" ENABLE ROW LEVEL SECURITY;

-- CreateTable: InspectionObservation
CREATE TABLE "InspectionObservation" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "answerId" TEXT,
    "description" TEXT NOT NULL,
    "severity" "RiskBand",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InspectionObservation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "InspectionObservation_inspectionId_idx" ON "InspectionObservation"("inspectionId");
ALTER TABLE "InspectionObservation" ADD CONSTRAINT "InspectionObservation_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InspectionObservation" ENABLE ROW LEVEL SECURITY;

-- Action: the fourth source. Add the column, then widen the exactly-one-source
-- CHECK to one OF FOUR. Existing rows each already have exactly one of the
-- other three, so they satisfy it.
ALTER TABLE "Action" ADD COLUMN "inspectionObservationId" TEXT;
ALTER TABLE "Action" ADD CONSTRAINT "Action_inspectionObservationId_fkey" FOREIGN KEY ("inspectionObservationId") REFERENCES "InspectionObservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Action" DROP CONSTRAINT "Action_exactly_one_source_check";
ALTER TABLE "Action" ADD CONSTRAINT "Action_exactly_one_source_check" CHECK (
  (
    (CASE WHEN "riskFindingId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "assessmentSessionId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "environmentalFindingId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "inspectionObservationId" IS NOT NULL THEN 1 ELSE 0 END)
  ) = 1
);

-- Seed: one generic system walk-through template (companyId/siteId NULL,
-- isSystem true). Questions are plain condition checks — NO legal reference
-- codes (legalReferenceCode left NULL), so no legal text is introduced here;
-- country-specific legal checklists are a founder-gated follow-up. A company
-- clones/edits this into its own template.
INSERT INTO "InspectionTemplate" ("id","companyId","siteId","domain","type","title","description","version","isActive","isSystem","updatedAt")
VALUES ('it-sys-walk-1', NULL, NULL, 'OSH', 'WALKTHROUGH', 'Allgemeine Sicherheitsbegehung', 'Allgemeine Begehung des Arbeitsbereichs: Ordnung, Verkehrswege, Erste Hilfe, Brandschutz, Maschinen und PSA. Als Vorlage gedacht — vom Unternehmen anpassbar.', 1, true, true, CURRENT_TIMESTAMP);

INSERT INTO "InspectionTemplateSection" ("id","templateId","title","order") VALUES
  ('its-walk-1','it-sys-walk-1','Ordnung & Verkehrswege',0),
  ('its-walk-2','it-sys-walk-1','Erste Hilfe & Brandschutz',1),
  ('its-walk-3','it-sys-walk-1','Maschinen & PSA',2);

INSERT INTO "InspectionTemplateQuestion" ("id","sectionId","prompt","answerType","required","order","choiceOptions") VALUES
  ('itq-1','its-walk-1','Sind Verkehrs- und Fluchtwege frei und gekennzeichnet?','YES_NO_NA',true,0,'{}'),
  ('itq-2','its-walk-1','Ist der Arbeitsbereich sauber und aufgeräumt (keine Stolperstellen)?','YES_NO_NA',true,1,'{}'),
  ('itq-3','its-walk-1','Allgemeiner Ordnungszustand (1 = schlecht, 5 = sehr gut)','SCALE',false,2,'{}'),
  ('itq-4','its-walk-2','Sind Erste-Hilfe-Einrichtungen vorhanden und zugänglich?','YES_NO_NA',true,0,'{}'),
  ('itq-5','its-walk-2','Sind Feuerlöscher geprüft und frei zugänglich?','YES_NO_NA',true,1,'{}'),
  ('itq-6','its-walk-2','Anzahl der kontrollierten Feuerlöscher','NUMBER',false,2,'{}'),
  ('itq-7','its-walk-3','Sind Schutzeinrichtungen an Maschinen vorhanden und wirksam?','YES_NO_NA',true,0,'{}'),
  ('itq-8','its-walk-3','Wird die erforderliche PSA getragen?','YES_NO_NA',true,1,'{}'),
  ('itq-9','its-walk-3','Bemerkungen zum Maschinenzustand','TEXT',false,2,'{}');
