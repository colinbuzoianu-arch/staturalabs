-- Migration B of 5: OrgUnit, a self-referencing tree rooted at Site
-- (PLANT -> DEPARTMENT -> AREA -> LINE), plus Workstation.orgUnitId.
--
-- The load-bearing decision (see schema.prisma doc comment on
-- Workstation.orgUnitId, and CLAUDE.md): Workstation.siteId stays NOT NULL
-- and untouched, orgUnitId is nullable and additive only. canAccessSite,
-- requireSiteAccess/requireWorkstationAccess/requireTaskAccess, and
-- getAccessibleSites() all keep working unchanged — no backfill, no RBAC
-- regression risk. The org tree is grouping/presentation layered on an
-- access model that already works; it must never become load-bearing for
-- authorization. Do not later "tidy this up" by making orgUnitId required
-- or deriving site from the tree.
-- CreateTable
CREATE TABLE "OrgUnit" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "parentId" TEXT,
    "type" "OrgUnitType" NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgUnit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrgUnit_siteId_idx" ON "OrgUnit"("siteId");

-- CreateIndex
CREATE INDEX "OrgUnit_parentId_idx" ON "OrgUnit"("parentId");

-- AddForeignKey
ALTER TABLE "OrgUnit" ADD CONSTRAINT "OrgUnit_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgUnit" ADD CONSTRAINT "OrgUnit_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "OrgUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: Workstation.orgUnitId, nullable, additive only. No backfill —
-- there is no correct org-unit value to infer for existing workstations,
-- and nullable is the intended steady-state (a workstation may legitimately
-- have no org-unit grouping).
ALTER TABLE "Workstation" ADD COLUMN "orgUnitId" TEXT;

-- CreateIndex
CREATE INDEX "Workstation_orgUnitId_idx" ON "Workstation"("orgUnitId");

-- AddForeignKey
ALTER TABLE "Workstation" ADD CONSTRAINT "Workstation_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enable RLS, no policies — consistent with every existing table (see
-- CLAUDE.md gotcha: the owning DB role in DATABASE_URL/DIRECT_URL bypasses
-- RLS, so this is defense-in-depth against the Supabase-managed
-- PostgREST/realtime access paths, not the application's own access
-- control).
ALTER TABLE "OrgUnit" ENABLE ROW LEVEL SECURITY;
